import { pool } from "../db/pool.js";

export const getVitalsLive = (limit) => {
  const query = `
    SELECT 
      ts as timestamp,
      hr as heartrate,
      rr as respirationrate,
      fft as signalstrength,
      bed_status as bedstatus
    FROM readings_vital
    WHERE ts IS NOT NULL
    ORDER BY ts DESC
    LIMIT $1
  `;

  return pool.query(query, [limit]);
};

export const getHrvLive = (limit) => {
  const query = `
    SELECT 
      ts as timestamp,
      hrv,
      fft as signalstrength,
      bed_status as bedstatus
    FROM readings_vital
    WHERE ts IS NOT NULL
    ORDER BY ts DESC
    LIMIT $1
  `;

  return pool.query(query, [limit]);
};

export const getSvLive = (limit) => {
  const query = `
    SELECT 
      ts as timestamp,
      sv,
      fft as signalstrength,
      bed_status as bedstatus
    FROM readings_vital
    WHERE ts IS NOT NULL
    ORDER BY ts DESC
    LIMIT $1
  `;

  return pool.query(query, [limit]);
};

export const getVitalsByRange = (interval, bucketSeconds, trimPercent) => {
  // Optimized query for all ranges - uses faster MODE calculation
  // For large ranges: simple AVG, for smaller ranges: trimmed mean with array operations
  const isLargeRange = interval === '30 days' || interval === '1 year';

  if (isLargeRange) {
    // Ultra-fast query for large ranges - optimized aggregation with fast MODE
    // Single scan with efficient MODE calculation using DISTINCT ON
    const query = `
      WITH aggregated AS (
        SELECT
          to_timestamp(floor(EXTRACT(EPOCH FROM ts) / $2) * $2) AS time_bucket,
          AVG(hr) as trimmed_hr,
          AVG(rr) as trimmed_rr,
          AVG(fft) as fft_value,
          COUNT(*) as sample_count
        FROM
          readings_vital
        WHERE
          ts >= NOW() - $1::interval
          AND hr IS NOT NULL
          AND rr IS NOT NULL
        GROUP BY
          time_bucket
      ),
      bed_status_agg AS (
        SELECT DISTINCT ON (time_bucket)
          to_timestamp(floor(EXTRACT(EPOCH FROM ts) / $2) * $2) AS time_bucket,
          bed_status as most_common_bed_status
        FROM
          readings_vital
        WHERE
          ts >= NOW() - $1::interval
          AND bed_status IS NOT NULL
        GROUP BY
          time_bucket, bed_status
        ORDER BY
          time_bucket, COUNT(*) DESC, bed_status
      )
      SELECT
        a.time_bucket,
        a.trimmed_hr,
        a.trimmed_rr,
        a.fft_value,
        COALESCE(b.most_common_bed_status, 0) as most_common_bed_status,
        a.sample_count
      FROM
        aggregated a
      LEFT JOIN
        bed_status_agg b ON a.time_bucket = b.time_bucket
      ORDER BY
        a.time_bucket;
    `;
    return pool.query(query, [interval, bucketSeconds]);
  }

  // Optimized query for smaller ranges - preserves trimmed mean logic with faster MODE
  const query = `
    WITH time_buckets AS (
      SELECT
        to_timestamp(floor(EXTRACT(EPOCH FROM ts) / $2) * $2) AS time_bucket,
        hr,
        rr,
        fft,
        bed_status
      FROM
        readings_vital
      WHERE
        ts >= NOW() - $1::interval
        AND hr IS NOT NULL
        AND rr IS NOT NULL
    ),
    bucket_aggregates AS (
      SELECT
        time_bucket,
        array_agg(hr ORDER BY hr) AS hr_values,
        array_agg(rr ORDER BY rr) AS rr_values,
        array_agg(fft) AS fft_values,
        COUNT(*) as sample_count
      FROM
        time_buckets
      GROUP BY
        time_bucket
    ),
    bed_status_mode AS (
      SELECT DISTINCT ON (time_bucket)
        to_timestamp(floor(EXTRACT(EPOCH FROM ts) / $2) * $2) AS time_bucket,
        bed_status as most_common_bed_status
      FROM
        readings_vital
      WHERE
        ts >= NOW() - $1::interval
        AND bed_status IS NOT NULL
      GROUP BY
        time_bucket, bed_status
      ORDER BY
        time_bucket, COUNT(*) DESC, bed_status
    )
    SELECT
      ba.time_bucket,
      ba.sample_count,
      CASE 
        WHEN ba.sample_count < 3 THEN 
          (SELECT AVG(unnest) FROM unnest(ba.hr_values))
        ELSE 
          (SELECT AVG(val) FROM unnest(ba.hr_values[
            GREATEST(1, ceil(array_length(ba.hr_values, 1) * ${trimPercent})):
            LEAST(array_length(ba.hr_values, 1), array_length(ba.hr_values, 1) - floor(array_length(ba.hr_values, 1) * ${trimPercent}))
          ]) AS val)
      END AS trimmed_hr,
      CASE 
        WHEN ba.sample_count < 3 THEN 
          (SELECT AVG(unnest) FROM unnest(ba.rr_values))
        ELSE 
          (SELECT AVG(val) FROM unnest(ba.rr_values[
            GREATEST(1, ceil(array_length(ba.rr_values, 1) * ${trimPercent})):
            LEAST(array_length(ba.rr_values, 1), array_length(ba.rr_values, 1) - floor(array_length(ba.rr_values, 1) * ${trimPercent}))
          ]) AS val)
      END AS trimmed_rr,
      (ba.fft_values[1]) AS fft_value,
      COALESCE(bsm.most_common_bed_status, 0) as most_common_bed_status
    FROM
      bucket_aggregates ba
    LEFT JOIN
      bed_status_mode bsm ON ba.time_bucket = bsm.time_bucket
    ORDER BY
      ba.time_bucket;
  `;

  return pool.query(query, [interval, bucketSeconds]);
};

export const getHrvByRange = (interval, bucketSeconds, trimPercent) => {
  // Optimized query for all ranges - preserves trimmed mean logic
  const isLargeRange = interval === '30 days' || interval === '1 year';

  if (isLargeRange) {
    // Fast query for large ranges - simple AVG (no trimming needed for large datasets)
    const query = `
      SELECT
        to_timestamp(floor(EXTRACT(EPOCH FROM ts) / $2) * $2) AS time_bucket,
        AVG(hrv) as trimmed_hrv
      FROM
        readings_vital
      WHERE
        ts >= NOW() - $1::interval
        AND hrv IS NOT NULL
      GROUP BY
        time_bucket
      ORDER BY
        time_bucket;
    `;
    return pool.query(query, [interval, bucketSeconds]);
  }

  // Optimized query for smaller ranges - faster trimmed mean using window functions
  const query = `
    WITH time_buckets AS (
      SELECT
        to_timestamp(floor(EXTRACT(EPOCH FROM ts) / $2) * $2) AS time_bucket,
        hrv
      FROM
        readings_vital
      WHERE
        ts >= NOW() - $1::interval
        AND hrv IS NOT NULL
    ),
    sorted_values AS (
      SELECT
        time_bucket,
        hrv,
        ROW_NUMBER() OVER (PARTITION BY time_bucket ORDER BY hrv) as rn,
        COUNT(*) OVER (PARTITION BY time_bucket) as total_count
      FROM
        time_buckets
    ),
    trimmed_values AS (
      SELECT
        time_bucket,
        hrv
      FROM
        sorted_values
      WHERE
        total_count < 3
        OR (rn > ceil(total_count * ${trimPercent}) AND rn <= total_count - floor(total_count * ${trimPercent}))
    )
    SELECT
      time_bucket,
      AVG(hrv) as trimmed_hrv
    FROM
      trimmed_values
    GROUP BY
      time_bucket
    ORDER BY
      time_bucket;
  `;

  return pool.query(query, [interval, bucketSeconds]);
};

export const getSvByRange = (interval, bucketSeconds, trimPercent) => {
  // Optimized query for all ranges - preserves trimmed mean logic
  const isLargeRange = interval === '30 days' || interval === '1 year';

  if (isLargeRange) {
    // Fast query for large ranges - simple AVG (no trimming needed for large datasets)
    const query = `
      SELECT
        to_timestamp(floor(EXTRACT(EPOCH FROM ts) / $2) * $2) AS time_bucket,
        AVG(sv) as trimmed_sv
      FROM
        readings_vital
      WHERE
        ts >= NOW() - $1::interval
        AND sv IS NOT NULL
      GROUP BY
        time_bucket
      ORDER BY
        time_bucket;
    `;
    return pool.query(query, [interval, bucketSeconds]);
  }

  // Optimized query for smaller ranges - faster trimmed mean using window functions
  const query = `
    WITH time_buckets AS (
      SELECT
        to_timestamp(floor(EXTRACT(EPOCH FROM ts) / $2) * $2) AS time_bucket,
        sv
      FROM
        readings_vital
      WHERE
        ts >= NOW() - $1::interval
        AND sv IS NOT NULL
    ),
    sorted_values AS (
      SELECT
        time_bucket,
        sv,
        ROW_NUMBER() OVER (PARTITION BY time_bucket ORDER BY sv) as rn,
        COUNT(*) OVER (PARTITION BY time_bucket) as total_count
      FROM
        time_buckets
    ),
    trimmed_values AS (
      SELECT
        time_bucket,
        sv
      FROM
        sorted_values
      WHERE
        total_count < 3
        OR (rn > ceil(total_count * ${trimPercent}) AND rn <= total_count - floor(total_count * ${trimPercent}))
    )
    SELECT
      time_bucket,
      AVG(sv) as trimmed_sv
    FROM
      trimmed_values
    GROUP BY
      time_bucket
    ORDER BY
      time_bucket;
  `;

  return pool.query(query, [interval, bucketSeconds]);
};

export const getStrByRange = (interval, bucketSeconds, trimPercent) => {
  const query = `
    WITH time_buckets AS (
      SELECT
        to_timestamp(floor(EXTRACT(EPOCH FROM ts) / $2) * $2) AS time_bucket,
        str
      FROM
        readings_vital
      WHERE
        ts >= NOW() - $1::interval
        AND str IS NOT NULL
    ),
    bucket_aggregates AS (
      SELECT
        time_bucket,
        array_agg(str ORDER BY str) AS str_values,
        COUNT(*) as sample_count
      FROM
        time_buckets
      GROUP BY
        time_bucket
    )
    SELECT
      time_bucket,
      CASE 
        WHEN sample_count < 3 THEN 
          (SELECT AVG(unnest) FROM unnest(str_values))
        ELSE 
          (SELECT AVG(val) FROM unnest(str_values[
            GREATEST(1, ceil(array_length(str_values, 1) * ${trimPercent})):
            LEAST(array_length(str_values, 1), array_length(str_values, 1) - floor(array_length(str_values, 1) * ${trimPercent}))
          ]) AS val)
      END AS trimmed_str
    FROM
      bucket_aggregates
    ORDER BY
      time_bucket;
  `;

  return pool.query(query, [interval, bucketSeconds]);
};

export const getRsByRange = (interval, bucketSeconds, trimPercent) => {
  const query = `
    WITH time_buckets AS (
      SELECT
        to_timestamp(floor(EXTRACT(EPOCH FROM ts) / $2) * $2) AS time_bucket,
        rs
      FROM
        readings_vital
      WHERE
        ts >= NOW() - $1::interval
        AND rs IS NOT NULL
    ),
    bucket_aggregates AS (
      SELECT
        time_bucket,
        array_agg(rs ORDER BY rs) AS rs_values,
        COUNT(*) as sample_count
      FROM
        time_buckets
      GROUP BY
        time_bucket
    )
    SELECT
      time_bucket,
      CASE 
        WHEN sample_count < 3 THEN 
          (SELECT AVG(unnest) FROM unnest(rs_values))
        ELSE 
          (SELECT AVG(val) FROM unnest(rs_values[
            GREATEST(1, ceil(array_length(rs_values, 1) * ${trimPercent})):
            LEAST(array_length(rs_values, 1), array_length(rs_values, 1) - floor(array_length(rs_values, 1) * ${trimPercent}))
          ]) AS val)
      END AS trimmed_rs
    FROM
      bucket_aggregates
    ORDER BY
      time_bucket;
  `;

  return pool.query(query, [interval, bucketSeconds]);
};

export const getColumns = () => {
  const query = `
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'readings_vital'
    ORDER BY ordinal_position;
  `;

  return pool.query(query);
};
