import Fastify from "fastify";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const fastify = Fastify({
    logger: true,
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
    last_minute: { interval: '1 hour', bucketSeconds: 60 },
    last_day: { interval: '24 hours', bucketSeconds: 300 },
    last_month: { interval: '30 days', bucketSeconds: 7200 },
    last_year: { interval: '1 year', bucketSeconds: 43200 },
};

// ## API Endpoint: GET /api/vitals?range=[last_minute|last_day|last_month|last_year]
fastify.get("/api/vitals", async (request, reply) => {
    try {
        const { range = 'last_day' } = request.query;
        const settings = rangeSettings[range];

        if (!settings) {
            return reply.code(400).send({ error: "Invalid range. Use one of: last_minute, last_day, last_month, last_year." });
        }

        const { interval, bucketSeconds } = settings;
        const trimPercent = 0.1;

        const query = `
      WITH time_buckets AS (
        SELECT
          to_timestamp(floor(EXTRACT(EPOCH FROM ts) / $2) * $2) AS time_bucket,
          hr,
          rr
        FROM
          readings_vital
        WHERE
          ts >= NOW() - $1::interval
      ),
      bucket_aggregates AS (
        SELECT
          time_bucket,
          array_agg(hr ORDER BY hr) AS hr_values,
          array_agg(rr ORDER BY rr) AS rr_values
        FROM
          time_buckets
        GROUP BY
          time_bucket
      )
      SELECT
        time_bucket,
        (SELECT AVG(val) FROM unnest(hr_values[ceil(array_length(hr_values, 1) * ${trimPercent}):(array_length(hr_values, 1) - floor(array_length(hr_values, 1) * ${trimPercent}))]) AS val) AS trimmed_hr,
        (SELECT AVG(val) FROM unnest(rr_values[ceil(array_length(rr_values, 1) * ${trimPercent}):(array_length(rr_values, 1) - floor(array_length(rr_values, 1) * ${trimPercent}))]) AS val) AS trimmed_rr
      FROM
        bucket_aggregates
      ORDER BY
        time_bucket;
    `;

        const { rows } = await pool.query(query, [interval, bucketSeconds]);

        // ## THIS IS THE FIX ##
        // It now correctly handles cases where trimmed_hr or trimmed_rr might be null or non-numeric
        const formattedResponse = rows.map(row => ({
            timestamp: row.time_bucket.toISOString(),
            heartRate: row.trimmed_hr !== null && !isNaN(row.trimmed_hr) ? parseFloat(parseFloat(row.trimmed_hr).toFixed(2)) : null,
            respirationRate: row.trimmed_rr !== null && !isNaN(row.trimmed_rr) ? parseFloat(parseFloat(row.trimmed_rr).toFixed(2)) : null,
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
