import Fastify from "fastify";
import cors from "@fastify/cors";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const fastify = Fastify({
  logger: true,
});

// ✅ Enable CORS properly
await fastify.register(cors, {
  origin: "*", // or specify your frontend: "https://your-frontend.com"
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

// ## PostgreSQL Connection
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: {
    rejectUnauthorized: false,
  },
});

// ## OPTIMIZED Configuration for different time ranges
const rangeSettings = {
  last_minute: { interval: '1 minute', bucketSeconds: 1 },      // 1 second buckets for real-time
  last_hour: { interval: '1 hour', bucketSeconds: 60 },         // 1 minute buckets
  last_day: { interval: '1 day', bucketSeconds: 300 },          // 5 minute buckets (288 points)
  last_week: { interval: '7 days', bucketSeconds: 1800 },       // 30 minute buckets (336 points)
  last_month: { interval: '30 days', bucketSeconds: 7200 },     // 2 hour buckets (360 points)
  last_year: { interval: '1 year', bucketSeconds: 86400 },      // 1 day buckets (365 points)
};
// ## API Endpoint: GET /api/vitals/live - Get the most recent raw data
fastify.get("/api/vitals/live", async (request, reply) => {
  try {
    const { limit = 100 } = request.query; // Default to last 100 records

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

    const { rows } = await pool.query(query, [limit]);

    const formattedResponse = rows.map(row => ({
      timestamp: row.timestamp.toISOString(),
      heartRate: row.heartrate !== null && !isNaN(row.heartrate) ? parseFloat(parseFloat(row.heartrate).toFixed(2)) : null,
      respirationRate: row.respirationrate !== null && !isNaN(row.respirationrate) ? parseFloat(parseFloat(row.respirationrate).toFixed(2)) : null,
      signalStrength: row.signalstrength !== null && !isNaN(row.signalstrength) ? parseInt(row.signalstrength) : 0,
      signalQuality: row.signalstrength !== null && !isNaN(row.signalstrength) ?
        (row.signalstrength < 1000 ? 'poor' : row.signalstrength < 2000 ? 'fair' : 'good') : 'poor',
      bedStatus: row.bedstatus !== null && !isNaN(row.bedstatus) ? parseInt(row.bedstatus) : null,
      bedStatusText: row.bedstatus !== null && !isNaN(row.bedstatus) ?
        (row.bedstatus === 0 ? 'out of bed' : row.bedstatus === 1 ? 'in bed' : 'movement') : null,
      hrReliable: row.signalstrength !== null && !isNaN(row.signalstrength) ? row.signalstrength >= 1000 : false
    })).reverse(); // Reverse to show oldest first

    return formattedResponse;

  } catch (err) {
    fastify.log.error(err);
    reply.code(500).send({ error: "Internal Server Error" });
  }
});

// ## API Endpoint: GET /api/vitals?range=[last_minute|last_hour|last_day|last_week|last_month|last_year]
fastify.get("/api/vitals", async (request, reply) => {
  try {
    const { range = 'last_day' } = request.query;
    const settings = rangeSettings[range];

    if (!settings) {
      return reply.code(400).send({ error: "Invalid range. Use one of: last_minute, last_hour, last_day, last_week, last_month, last_year." });
    }

    const { interval, bucketSeconds } = settings;
    const trimPercent = 0.1;

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

    const { rows } = await pool.query(query, [interval, bucketSeconds]);

    // Format response with proper handling of numeric values
    const formattedResponse = rows.map(row => ({
      timestamp: row.time_bucket.toISOString(),
      heartRate: (row.trimmed_hr !== null && row.trimmed_hr !== undefined && typeof row.trimmed_hr === 'number')
        ? parseFloat(row.trimmed_hr.toFixed(2))
        : null,
      respirationRate: (row.trimmed_rr !== null && row.trimmed_rr !== undefined && typeof row.trimmed_rr === 'number')
        ? parseFloat(row.trimmed_rr.toFixed(2))
        : null,
      signalStrength: (row.fft_value !== null && row.fft_value !== undefined)
        ? Math.round(row.fft_value)
        : 0,
      signalQuality: (row.fft_value !== null && row.fft_value !== undefined)
        ? (row.fft_value < 1000 ? 'poor' : row.fft_value < 2000 ? 'fair' : 'good')
        : 'poor',
      bedStatus: (row.most_common_bed_status !== null && row.most_common_bed_status !== undefined)
        ? parseInt(row.most_common_bed_status)
        : null,
      bedStatusText: (row.most_common_bed_status !== null && row.most_common_bed_status !== undefined)
        ? (row.most_common_bed_status === 0 ? 'out of bed' : row.most_common_bed_status === 1 ? 'in bed' : 'movement')
        : null,
      hrReliable: (row.fft_value !== null && row.fft_value !== undefined)
        ? row.fft_value >= 1000
        : false,
      sampleCount: row.sample_count || 0
    }));

    return formattedResponse;

  } catch (err) {
    fastify.log.error(err);
    reply.code(500).send({ error: "Internal Server Error" });
  }
});

// ## Run the server
const start = async () => {
  try {
    await fastify.listen({ port: process.env.PORT || 3000, host: "0.0.0.0" });
    fastify.log.info(`Server running on http://localhost:${process.env.PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();