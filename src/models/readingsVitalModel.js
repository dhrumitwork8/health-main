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
    SELECT
      to_timestamp(floor(EXTRACT(EPOCH FROM ts) / $2) * $2) AS time_bucket,
      COUNT(*) as sample_count,
      AVG(hr) AS trimmed_hr,
      AVG(rr) AS trimmed_rr,
      AVG(fft) AS fft_value,
      MAX(bed_status) AS most_common_bed_status
    FROM (
      SELECT ts, hr, rr, fft, bed_status
      FROM readings_vital
      WHERE ts >= NOW() - $1::interval
        AND hr IS NOT NULL
        AND rr IS NOT NULL
      ORDER BY ts DESC
      LIMIT 50000
    ) sub
    GROUP BY time_bucket
    ORDER BY time_bucket DESC
    LIMIT 500;
  `;

  return pool.query(query, [interval, bucketSeconds]);
};

export const getHrvByRange = (interval, bucketSeconds, trimPercent) => {
  const query = `
    SELECT
      to_timestamp(floor(EXTRACT(EPOCH FROM ts) / $2) * $2) AS time_bucket,
      AVG(hrv) as trimmed_hrv
    FROM (
      SELECT ts, hrv
      FROM readings_vital
      WHERE ts >= NOW() - $1::interval
        AND hrv IS NOT NULL
      ORDER BY ts DESC
      LIMIT 50000
    ) sub
    GROUP BY time_bucket
    ORDER BY time_bucket DESC
    LIMIT 500;
  `;

  return pool.query(query, [interval, bucketSeconds]);
};

export const getSvByRange = (interval, bucketSeconds, trimPercent) => {
  const query = `
    SELECT
      to_timestamp(floor(EXTRACT(EPOCH FROM ts) / $2) * $2) AS time_bucket,
      AVG(sv) as trimmed_sv
    FROM (
      SELECT ts, sv
      FROM readings_vital
      WHERE ts >= NOW() - $1::interval
        AND sv IS NOT NULL
      ORDER BY ts DESC
      LIMIT 50000
    ) sub
    GROUP BY time_bucket
    ORDER BY time_bucket DESC
    LIMIT 500;
  `;

  return pool.query(query, [interval, bucketSeconds]);
};

export const getStrByRange = (interval, bucketSeconds, trimPercent) => {
  const query = `
    SELECT
      to_timestamp(floor(EXTRACT(EPOCH FROM ts) / $2) * $2) AS time_bucket,
      AVG(str) as trimmed_str
    FROM (
      SELECT ts, str
      FROM readings_vital
      WHERE ts >= NOW() - $1::interval
        AND str IS NOT NULL
      ORDER BY ts DESC
      LIMIT 50000
    ) sub
    GROUP BY time_bucket
    ORDER BY time_bucket DESC
    LIMIT 500;
  `;

  return pool.query(query, [interval, bucketSeconds]);
};

export const getRsByRange = (interval, bucketSeconds, trimPercent) => {
  const query = `
    SELECT
      to_timestamp(floor(EXTRACT(EPOCH FROM ts) / $2) * $2) AS time_bucket,
      AVG(rs) as trimmed_rs
    FROM (
      SELECT ts, rs
      FROM readings_vital
      WHERE ts >= NOW() - $1::interval
        AND rs IS NOT NULL
      ORDER BY ts DESC
      LIMIT 50000
    ) sub
    GROUP BY time_bucket
    ORDER BY time_bucket DESC
    LIMIT 500;
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
