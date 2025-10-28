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
        MODE() WITHIN GROUP (ORDER BY bed_status) AS most_common_bed_status,
        COUNT(*) as sample_count
      FROM
        time_buckets
      GROUP BY
        time_bucket
    )
    SELECT
      time_bucket,
      sample_count,
      CASE 
        WHEN sample_count < 3 THEN 
          (SELECT AVG(unnest) FROM unnest(hr_values))
        ELSE 
          (SELECT AVG(val) FROM unnest(hr_values[
            GREATEST(1, ceil(array_length(hr_values, 1) * ${trimPercent})):
            LEAST(array_length(hr_values, 1), array_length(hr_values, 1) - floor(array_length(hr_values, 1) * ${trimPercent}))
          ]) AS val)
      END AS trimmed_hr,
      CASE 
        WHEN sample_count < 3 THEN 
          (SELECT AVG(unnest) FROM unnest(rr_values))
        ELSE 
          (SELECT AVG(val) FROM unnest(rr_values[
            GREATEST(1, ceil(array_length(rr_values, 1) * ${trimPercent})):
            LEAST(array_length(rr_values, 1), array_length(rr_values, 1) - floor(array_length(rr_values, 1) * ${trimPercent}))
          ]) AS val)
      END AS trimmed_rr,
      (fft_values[1]) AS fft_value,
      most_common_bed_status
    FROM
      bucket_aggregates
    ORDER BY
      time_bucket;
  `;

  return pool.query(query, [interval, bucketSeconds]);
};

export const getHrvByRange = (interval, bucketSeconds, trimPercent) => {
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
    bucket_aggregates AS (
      SELECT
        time_bucket,
        array_agg(hrv ORDER BY hrv) AS hrv_values,
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
          (SELECT AVG(unnest) FROM unnest(hrv_values))
        ELSE 
          (SELECT AVG(val) FROM unnest(hrv_values[
            GREATEST(1, ceil(array_length(hrv_values, 1) * ${trimPercent})):
            LEAST(array_length(hrv_values, 1), array_length(hrv_values, 1) - floor(array_length(hrv_values, 1) * ${trimPercent}))
          ]) AS val)
      END AS trimmed_hrv
    FROM
      bucket_aggregates
    ORDER BY
      time_bucket;
  `;

  return pool.query(query, [interval, bucketSeconds]);
};

export const getSvByRange = (interval, bucketSeconds, trimPercent) => {
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
    bucket_aggregates AS (
      SELECT
        time_bucket,
        array_agg(sv ORDER BY sv) AS sv_values,
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
          (SELECT AVG(unnest) FROM unnest(sv_values))
        ELSE 
          (SELECT AVG(val) FROM unnest(sv_values[
            GREATEST(1, ceil(array_length(sv_values, 1) * ${trimPercent})):
            LEAST(array_length(sv_values, 1), array_length(sv_values, 1) - floor(array_length(sv_values, 1) * ${trimPercent}))
          ]) AS val)
      END AS trimmed_sv
    FROM
      bucket_aggregates
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
