// import Fastify from "fastify";
// import pg from "pg";
// import dotenv from "dotenv";

// dotenv.config();

// const { Pool } = pg;

// const fastify = Fastify({
//     logger: true,
// });

// // PostgreSQL connection
// const pool = new Pool({
//     user: process.env.DB_USER,
//     host: process.env.DB_HOST,
//     database: process.env.DB_NAME,
//     password: process.env.DB_PASSWORD,
//     port: process.env.DB_PORT,
//     ssl: {
//         rejectUnauthorized: false, // for self-signed certs
//     },
// });

// // Utility: Map selection to interval + granularity
// const getQueryParams = (selection) => {
//     switch (selection) {
//         case "last_minute":
//             return { interval: "1 minute", granularity: "second" };
//         case "last_day":
//             return { interval: "1 day", granularity: "minute" };
//         case "last_month":
//             return { interval: "1 month", granularity: "hour" };
//         case "last_year":
//             return { interval: "1 year", granularity: "day" };
//         default:
//             return { interval: "1 day", granularity: "minute" }; // fallback
//     }
// };

// // API: GET /api/vitals?selection=last_day


// // fastify.get("/api/vitals", async (request, reply) => {
// //     try {
// //         const { selection = "last_day" } = request.query;
// //         const { interval, granularity } = getQueryParams(selection);

// //         // Validate granularity and interval to avoid SQL injection
// //         const allowedGranularities = ["second", "minute", "hour", "day"];
// //         const allowedIntervals = ["1 minute", "1 day", "1 month", "1 year"];

// //         if (!allowedGranularities.includes(granularity) || !allowedIntervals.includes(interval)) {
// //             return reply.code(400).send({ error: "Invalid selection" });
// //         }

// //         const query = `
// //       SELECT DATE_TRUNC('${granularity}', ts) AS time_bucket,
// //        AVG(hr) AS avg_hr,
// //        AVG(rr) AS avg_rr
// // FROM readings_vital_test_poc
// // WHERE ts >= NOW() - INTERVAL '${interval}'
// // GROUP BY time_bucket
// // ORDER BY time_bucket;
// //     `;

// //         const { rows } = await pool.query(query);
// //         return rows;
// //     } catch (err) {
// //         fastify.log.error(err);
// //         reply.code(500).send({ error: "Internal Server Error" });
// //     }
// // });


// // Run server
// const start = async () => {
//     try {
//         await fastify.listen({ port: process.env.PORT || 3000, host: "0.0.0.0" });
//         fastify.log.info(`Server running on http://localhost:${process.env.PORT}`);
//     } catch (err) {
//         fastify.log.error(err);
//         process.exit(1);
//     }
// };

// start();

import Fastify from "fastify";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const fastify = Fastify({
  logger: true,
});

// PostgreSQL connection
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: {
    rejectUnauthorized: false, // for self-signed certs
  },
});

// Utility: Map selection to interval + granularity
const getQueryParams = (selection) => {
  switch (selection) {
    case "last_minute":
      return { interval: "1 minute", granularity: "second" };
    case "last_day":
      return { interval: "1 day", granularity: "minute" };
    case "last_month":
      return { interval: "1 month", granularity: "hour" };
    case "last_year":
      return { interval: "1 year", granularity: "day" };
    default:
      return { interval: "1 day", granularity: "minute" }; // fallback
  }
};

// ✅ API: GET /api/vitals?selection=last_day
fastify.get("/api/vitals", async (request, reply) => {
  try {
    const { selection = "last_day" } = request.query;
    let query;
    let formatted;

    if (selection === "last_month" || selection === "30_days") {
      // 30-day graph: group by hour, compute median, min, max
      query = `
        SELECT time_bucket,
               percentile_cont(0.5) WITHIN GROUP (ORDER BY hr) AS median_hr,
               MIN(hr) AS min_hr,
               MAX(hr) AS max_hr,
               percentile_cont(0.5) WITHIN GROUP (ORDER BY rr) AS median_rr,
               MIN(rr) AS min_rr,
               MAX(rr) AS max_rr
        FROM (
          SELECT DATE_TRUNC('hour', ts) AS time_bucket, hr, rr
          FROM readings_vital_test_poc
          WHERE ts >= NOW() - INTERVAL '30 days'
        ) sub
        GROUP BY time_bucket
        ORDER BY time_bucket;
      `;
      const { rows } = await pool.query(query);
      let timeFormat = (d) => d instanceof Date ? d.toISOString().slice(0, 19) : d;
      formatted = rows.map(r => ({
        time: timeFormat(r.time_bucket),
        avg_hr: parseFloat(r.median_hr),
        avg_rr: parseFloat(r.median_rr),
        min_hr: parseFloat(r.min_hr),
        max_hr: parseFloat(r.max_hr),
        min_rr: parseFloat(r.min_rr),
        max_rr: parseFloat(r.max_rr)
      }));
      return formatted;
    } else {
      if (selection === "last_day") {
        // Always return 24 hourly points for last day
        query = `
          WITH hours AS (
            SELECT generate_series(
              date_trunc('hour', NOW() - INTERVAL '23 hours'),
              date_trunc('hour', NOW()),
              INTERVAL '1 hour'
            ) AS time_bucket
          )
          SELECT h.time_bucket,
                 AVG(r.hr) AS avg_hr,
                 AVG(r.rr) AS avg_rr
          FROM hours h
          LEFT JOIN readings_vital_test_poc r
            ON date_trunc('hour', r.ts) = h.time_bucket
            AND r.ts >= NOW() - INTERVAL '24 hours' AND r.ts < NOW()
          GROUP BY h.time_bucket
          ORDER BY h.time_bucket;
        `;
        const { rows } = await pool.query(query);
        let timeFormat = (d) => d instanceof Date ? d.toISOString().slice(0, 19) : d;
        formatted = rows.map(r => ({
          time: timeFormat(r.time_bucket),
          avg_hr: r.avg_hr !== null ? parseFloat(r.avg_hr) : null,
          avg_rr: r.avg_rr !== null ? parseFloat(r.avg_rr) : null
        }));
        return formatted;
      } else if (selection === "last_minute") {
        // Data for the current day, averaged per minute (1440 points)
        query = `
          WITH minutes AS (
            SELECT generate_series(
              date_trunc('day', NOW()),
              date_trunc('day', NOW()) + INTERVAL '23 hours 59 minutes',
              INTERVAL '1 minute'
            ) AS time_bucket
          )
          SELECT m.time_bucket,
                 AVG(r.hr) AS avg_hr,
                 AVG(r.rr) AS avg_rr
          FROM minutes m
          LEFT JOIN readings_vital_test_poc r
            ON date_trunc('minute', r.ts) = m.time_bucket
            AND r.ts >= date_trunc('day', NOW()) AND r.ts < date_trunc('day', NOW()) + INTERVAL '1 day'
          GROUP BY m.time_bucket
          ORDER BY m.time_bucket;
        `;
        const { rows } = await pool.query(query);
        let timeFormat = (d) => d instanceof Date ? d.toISOString().slice(0, 19) : d;
        formatted = rows.map(r => ({
          time: timeFormat(r.time_bucket),
          avg_hr: r.avg_hr !== null ? parseFloat(r.avg_hr) : null,
          avg_rr: r.avg_rr !== null ? parseFloat(r.avg_rr) : null
        }));
        return formatted;
      } else if (selection === "last_year") {
        // Always return 12 monthly points for last year
        query = `
          WITH months AS (
            SELECT generate_series(
              date_trunc('month', NOW() - INTERVAL '11 months'),
              date_trunc('month', NOW()),
              INTERVAL '1 month'
            ) AS time_bucket
          )
          SELECT m.time_bucket,
                 AVG(r.hr) AS avg_hr,
                 AVG(r.rr) AS avg_rr
          FROM months m
          LEFT JOIN readings_vital_test_poc r
            ON date_trunc('month', r.ts) = m.time_bucket
            AND r.ts >= NOW() - INTERVAL '1 year' AND r.ts < NOW()
          GROUP BY m.time_bucket
          ORDER BY m.time_bucket;
        `;
        const { rows } = await pool.query(query);
        let timeFormat = (d) => d instanceof Date ? d.toISOString().slice(0, 10) : d; // YYYY-MM-DD
        formatted = rows.map(r => ({
          time: timeFormat(r.time_bucket),
          avg_hr: r.avg_hr !== null ? parseFloat(r.avg_hr) : null,
          avg_rr: r.avg_rr !== null ? parseFloat(r.avg_rr) : null
        }));
        return formatted;
      } else {
        // ...existing code...
        const { interval, granularity } = getQueryParams(selection);
        const allowedGranularities = ["second", "minute", "hour", "day"];
        const allowedIntervals = ["1 minute", "1 day", "1 month", "1 year"];
        if (!allowedGranularities.includes(granularity) || !allowedIntervals.includes(interval)) {
          return reply.code(400).send({ error: "Invalid selection" });
        }
        query = `
          SELECT DATE_TRUNC('${granularity}', ts) AS time_bucket,
                 AVG(hr) AS avg_hr,
                 AVG(rr) AS avg_rr
          FROM readings_vital_test_poc
          WHERE ts >= NOW() - INTERVAL '${interval}'
          GROUP BY time_bucket
          ORDER BY time_bucket;
        `;
        const { rows } = await pool.query(query);
        let timeFormat = (d) => d instanceof Date ? d.toISOString().slice(0, 19) : d;
        formatted = rows.map(r => ({
          time: timeFormat(r.time_bucket),
          avg_hr: parseFloat(r.avg_hr),
          avg_rr: parseFloat(r.avg_rr)
        }));
        return formatted;
      }
    }
  } catch (err) {
    fastify.log.error(err);
    reply.code(500).send({ error: "Internal Server Error" });
  }
});

// Run server
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
