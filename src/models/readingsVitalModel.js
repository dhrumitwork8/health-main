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
        AVG(hr) as avg_hr,
        AVG(rr) as avg_rr,
        AVG(fft) as avg_fft,
        MODE() WITHIN GROUP (ORDER BY bed_status) AS most_common_bed_status,
        COUNT(*) as sample_count
      FROM
        readings_vital
      WHERE
        ts >= NOW() - $1::interval
        AND hr IS NOT NULL
        AND rr IS NOT NULL
      GROUP BY
        time_bucket
      ORDER BY
        time_bucket DESC
      LIMIT 1000
    )
    SELECT
      time_bucket,
      sample_count,
      avg_hr AS trimmed_hr,
      avg_rr AS trimmed_rr,
      avg_fft AS fft_value,
      most_common_bed_status
    FROM
      time_buckets
    ORDER BY
      time_bucket;
  `;

  return pool.query(query, [interval, bucketSeconds]);
};

export const getHrvByRange = (interval, bucketSeconds, trimPercent) => {
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
      time_bucket DESC
    LIMIT 1000;
  `;

  return pool.query(query, [interval, bucketSeconds]);
};

export const getSvByRange = (interval, bucketSeconds, trimPercent) => {
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
      time_bucket DESC
    LIMIT 1000;
  `;

  return pool.query(query, [interval, bucketSeconds]);
};

export const getStrByRange = (interval, bucketSeconds, trimPercent) => {
  const query = `
    SELECT
      to_timestamp(floor(EXTRACT(EPOCH FROM ts) / $2) * $2) AS time_bucket,
      AVG(str) as trimmed_str
    FROM
      readings_vital
    WHERE
      ts >= NOW() - $1::interval
      AND str IS NOT NULL
    GROUP BY
      time_bucket
    ORDER BY
      time_bucket DESC
    LIMIT 1000;
  `;

  return pool.query(query, [interval, bucketSeconds]);
};

export const getRsByRange = (interval, bucketSeconds, trimPercent) => {
  const query = `
    SELECT
      to_timestamp(floor(EXTRACT(EPOCH FROM ts) / $2) * $2) AS time_bucket,
      AVG(rs) as trimmed_rs
    FROM
      readings_vital
    WHERE
      ts >= NOW() - $1::interval
      AND rs IS NOT NULL
    GROUP BY
      time_bucket
    ORDER BY
      time_bucket DESC
    LIMIT 1000;
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
