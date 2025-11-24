import { rangeSettings } from "../config/rangeSettings.js";
import {
  getVitalsLive,
  getHrvLive,
  getSvLive,
  getVitalsByRange,
  getHrvByRange,
  getSvByRange,
  getStrByRange,
  getRsByRange,
  getColumns,
} from "../models/readingsVitalModel.js";
import { sendDbErrorResponse } from "../utils/dbErrorHandler.js";
import { cache } from "../utils/cache.js";

const trimPercent = 0.1;

// Cache TTLs based on range
const getCacheTTL = (range) => {
  switch (range) {
    case 'last_minute':
    case 'last_hour':
      return 30000; // 30 seconds
    case 'last_day':
      return 60000; // 1 minute
    case 'last_week':
      return 120000; // 2 minutes
    case 'last_month':
    case 'last_year':
      return 300000; // 5 minutes
    default:
      return 60000; // 1 minute default
  }
};

export const createVitalsController = (fastify) => ({
  getVitalsLive: async (request, reply) => {
    try {
      const { limit = 100 } = request.query;
      const { rows } = await getVitalsLive(limit);

      const formattedResponse = rows
        .map((row) => ({
          timestamp: row.timestamp.toISOString(),
          heartRate:
            row.heartrate !== null && !isNaN(row.heartrate)
              ? parseFloat(parseFloat(row.heartrate).toFixed(2))
              : null,
          respirationRate:
            row.respirationrate !== null && !isNaN(row.respirationrate)
              ? parseFloat(parseFloat(row.respirationrate).toFixed(2))
              : null,
          signalStrength:
            row.signalstrength !== null && !isNaN(row.signalstrength)
              ? parseInt(row.signalstrength)
              : 0,
          signalQuality:
            row.signalstrength !== null && !isNaN(row.signalstrength)
              ? row.signalstrength < 1000
                ? "poor"
                : row.signalstrength < 2000
                  ? "fair"
                  : "good"
              : "poor",
          bedStatus:
            row.bedstatus !== null && !isNaN(row.bedstatus)
              ? parseInt(row.bedstatus)
              : null,
          bedStatusText:
            row.bedstatus !== null && !isNaN(row.bedstatus)
              ? row.bedstatus === 0
                ? "out of bed"
                : row.bedstatus === 1
                  ? "in bed"
                  : "movement"
              : null,
          hrReliable:
            row.signalstrength !== null && !isNaN(row.signalstrength)
              ? row.signalstrength >= 1000
              : false,
        }))
        .reverse();

      return formattedResponse;
    } catch (err) {
      // Check if it's a database connection error
      if (err.code && (err.code.startsWith("E") || err.code.startsWith("28") || err.code.startsWith("3D"))) {
        return sendDbErrorResponse(reply, err, fastify);
      }

      fastify.log.error(err);
      reply.code(500).send({ error: "Internal Server Error", details: err.message });
    }
  },

  getHrvLive: async (request, reply) => {
    try {
      const { limit = 100 } = request.query;
      const { rows } = await getHrvLive(limit);

      const formattedResponse = rows
        .map((row) => ({
          timestamp: row.timestamp.toISOString(),
          hrv:
            row.hrv !== null && !isNaN(row.hrv)
              ? parseFloat(parseFloat(row.hrv).toFixed(2))
              : null,
          signalStrength:
            row.signalstrength !== null && !isNaN(row.signalstrength)
              ? parseInt(row.signalstrength)
              : 0,
          signalQuality:
            row.signalstrength !== null && !isNaN(row.signalstrength)
              ? row.signalstrength < 1000
                ? "poor"
                : row.signalstrength < 2000
                  ? "fair"
                  : "good"
              : "poor",
          bedStatus:
            row.bedstatus !== null && !isNaN(row.bedstatus)
              ? parseInt(row.bedstatus)
              : null,
          bedStatusText:
            row.bedstatus !== null && !isNaN(row.bedstatus)
              ? row.bedstatus === 0
                ? "out of bed"
                : row.bedstatus === 1
                  ? "in bed"
                  : "movement"
              : null,
          hrvReliable:
            row.signalstrength !== null && !isNaN(row.signalstrength)
              ? row.signalstrength >= 1000
              : false,
        }))
        .reverse();

      return formattedResponse;
    } catch (err) {
      // Check if it's a database connection error
      if (err.code && (err.code.startsWith("E") || err.code.startsWith("28") || err.code.startsWith("3D"))) {
        return sendDbErrorResponse(reply, err, fastify);
      }

      fastify.log.error(err);
      reply.code(500).send({ error: "Internal Server Error", details: err.message });
    }
  },

  getSvLive: async (request, reply) => {
    try {
      const { limit = 100 } = request.query;
      const { rows } = await getSvLive(limit);

      const formattedResponse = rows
        .map((row) => ({
          timestamp: row.timestamp.toISOString(),
          sv:
            row.sv !== null && !isNaN(row.sv)
              ? parseFloat(parseFloat(row.sv).toFixed(2))
              : null,
          signalStrength:
            row.signalstrength !== null && !isNaN(row.signalstrength)
              ? parseInt(row.signalstrength)
              : 0,
          signalQuality:
            row.signalstrength !== null && !isNaN(row.signalstrength)
              ? row.signalstrength < 1000
                ? "poor"
                : row.signalstrength < 2000
                  ? "fair"
                  : "good"
              : "poor",
          bedStatus:
            row.bedstatus !== null && !isNaN(row.bedstatus)
              ? parseInt(row.bedstatus)
              : null,
          bedStatusText:
            row.bedstatus !== null && !isNaN(row.bedstatus)
              ? row.bedstatus === 0
                ? "out of bed"
                : row.bedstatus === 1
                  ? "in bed"
                  : "movement"
              : null,
          svReliable:
            row.signalstrength !== null && !isNaN(row.signalstrength)
              ? row.signalstrength >= 1000
              : false,
        }))
        .reverse();

      return formattedResponse;
    } catch (err) {
      // Check if it's a database connection error
      if (err.code && (err.code.startsWith("E") || err.code.startsWith("28") || err.code.startsWith("3D"))) {
        return sendDbErrorResponse(reply, err, fastify);
      }

      fastify.log.error(err);
      reply.code(500).send({ error: "Internal Server Error", details: err.message });
    }
  },

  getVitalsByRange: async (request, reply) => {
    try {
      const { range = "last_day" } = request.query;

      // Check cache first
      const cacheKey = `vitals:${range}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        reply.header('X-Cache', 'HIT');
        return cached;
      }

      const settings = rangeSettings[range];

      if (!settings) {
        return reply
          .code(400)
          .send({
            error:
              "Invalid range. Use one of: last_minute, last_hour, last_day, last_week, last_month, last_year.",
          });
      }

      const { interval, bucketSeconds } = settings;
      const { rows } = await getVitalsByRange(interval, bucketSeconds, trimPercent);

      const formattedResponse = rows.map((row) => ({
        timestamp: row.time_bucket.toISOString(),
        heartRate:
          row.trimmed_hr !== null && row.trimmed_hr !== undefined && typeof row.trimmed_hr === "number"
            ? parseFloat(row.trimmed_hr.toFixed(2))
            : null,
        respirationRate:
          row.trimmed_rr !== null && row.trimmed_rr !== undefined && typeof row.trimmed_rr === "number"
            ? parseFloat(row.trimmed_rr.toFixed(2))
            : null,
        signalStrength:
          row.fft_value !== null && row.fft_value !== undefined ? Math.round(row.fft_value) : 0,
        signalQuality:
          row.fft_value !== null && row.fft_value !== undefined
            ? row.fft_value < 1000
              ? "poor"
              : row.fft_value < 2000
                ? "fair"
                : "good"
            : "poor",
        bedStatus:
          row.most_common_bed_status !== null && row.most_common_bed_status !== undefined
            ? parseInt(row.most_common_bed_status)
            : null,
        bedStatusText:
          row.most_common_bed_status !== null && row.most_common_bed_status !== undefined
            ? row.most_common_bed_status === 0
              ? "out of bed"
              : row.most_common_bed_status === 1
                ? "in bed"
                : "movement"
            : null,
        hrReliable:
          row.fft_value !== null && row.fft_value !== undefined ? row.fft_value >= 1000 : false,
        sampleCount: row.sample_count || 0,
      }));

      // Cache the response
      const ttl = getCacheTTL(range);
      cache.set(cacheKey, formattedResponse, ttl);
      reply.header('X-Cache', 'MISS');

      return formattedResponse;
    } catch (err) {
      // Check if it's a database connection error
      if (err.code && (err.code.startsWith("E") || err.code.startsWith("28") || err.code.startsWith("3D"))) {
        return sendDbErrorResponse(reply, err, fastify);
      }

      fastify.log.error(err);
      reply.code(500).send({ error: "Internal Server Error", details: err.message });
    }
  },

  getHrvByRange: async (request, reply) => {
    try {
      const { range = "last_day" } = request.query;
      
      // Check cache first
      const cacheKey = `hrv:${range}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        reply.header('X-Cache', 'HIT');
        return cached;
      }
      
      const settings = rangeSettings[range];

      if (!settings) {
        return reply
          .code(400)
          .send({
            error:
              "Invalid range. Use one of: last_minute, last_hour, last_day, last_week, last_month, last_year.",
          });
      }

      const { interval, bucketSeconds } = settings;
      const { rows } = await getHrvByRange(interval, bucketSeconds, trimPercent);

      const formattedResponse = rows.map((row) => ({
        timestamp: row.time_bucket.toISOString(),
        hrv:
          row.trimmed_hrv !== null && row.trimmed_hrv !== undefined && typeof row.trimmed_hrv === "number"
            ? parseFloat(row.trimmed_hrv.toFixed(2))
            : null,
      }));

      // Cache the response
      const ttl = getCacheTTL(range);
      cache.set(cacheKey, formattedResponse, ttl);
      reply.header('X-Cache', 'MISS');

      return formattedResponse;
    } catch (err) {
      // Check if it's a database connection error
      if (err.code && (err.code.startsWith("E") || err.code.startsWith("28") || err.code.startsWith("3D"))) {
        return sendDbErrorResponse(reply, err, fastify);
      }

      fastify.log.error("HRV API Error:", err);
      reply.code(500).send({
        error: "Internal Server Error",
        details: err.message,
        hint: "Check if 'hrv' column exists in readings_vital table",
      });
    }
  },

  getSvByRange: async (request, reply) => {
    try {
      const { range = "last_day" } = request.query;
      
      // Check cache first
      const cacheKey = `sv:${range}`;
      const cached = cache.get(cacheKey);
      if (cached) {
        reply.header('X-Cache', 'HIT');
        return cached;
      }
      
      const settings = rangeSettings[range];

      if (!settings) {
        return reply
          .code(400)
          .send({
            error:
              "Invalid range. Use one of: last_minute, last_hour, last_day, last_week, last_month, last_year.",
          });
      }

      const { interval, bucketSeconds } = settings;
      const { rows } = await getSvByRange(interval, bucketSeconds, trimPercent);

      const formattedResponse = rows.map((row) => ({
        timestamp: row.time_bucket.toISOString(),
        sv:
          row.trimmed_sv !== null && row.trimmed_sv !== undefined && typeof row.trimmed_sv === "number"
            ? parseFloat(row.trimmed_sv.toFixed(2))
            : null,
      }));

      // Cache the response
      const ttl = getCacheTTL(range);
      cache.set(cacheKey, formattedResponse, ttl);
      reply.header('X-Cache', 'MISS');

      return formattedResponse;
    } catch (err) {
      // Check if it's a database connection error
      if (err.code && (err.code.startsWith("E") || err.code.startsWith("28") || err.code.startsWith("3D"))) {
        return sendDbErrorResponse(reply, err, fastify);
      }

      fastify.log.error("SV API Error:", err);
      reply.code(500).send({
        error: "Internal Server Error",
        details: err.message,
        hint: "Check if 'sv' column exists in readings_vital table",
      });
    }
  },

  getHrvSvByRange: async (request, reply) => {
    try {
      const { range = "last_day" } = request.query;
      const settings = rangeSettings[range];

      if (!settings) {
        return reply
          .code(400)
          .send({
            error:
              "Invalid range. Use one of: last_minute, last_hour, last_day, last_week, last_month, last_year.",
          });
      }

      const { interval, bucketSeconds } = settings;
      const [hrvResult, svResult] = await Promise.all([
        getHrvByRange(interval, bucketSeconds, trimPercent),
        getSvByRange(interval, bucketSeconds, trimPercent),
      ]);

      const hrv = hrvResult.rows.map((row) => ({
        timestamp: row.time_bucket.toISOString(),
        hrv:
          row.trimmed_hrv !== null && row.trimmed_hrv !== undefined && typeof row.trimmed_hrv === "number"
            ? parseFloat(row.trimmed_hrv.toFixed(2))
            : null,
      }));

      const sv = svResult.rows.map((row) => ({
        timestamp: row.time_bucket.toISOString(),
        sv:
          row.trimmed_sv !== null && row.trimmed_sv !== undefined && typeof row.trimmed_sv === "number"
            ? parseFloat(row.trimmed_sv.toFixed(2))
            : null,
      }));

      const mergedMap = new Map();

      hrv.forEach((entry) => {
        mergedMap.set(entry.timestamp, { timestamp: entry.timestamp, hrv: entry.hrv, sv: null });
      });

      sv.forEach((entry) => {
        if (mergedMap.has(entry.timestamp)) {
          mergedMap.get(entry.timestamp).sv = entry.sv;
        } else {
          mergedMap.set(entry.timestamp, { timestamp: entry.timestamp, hrv: null, sv: entry.sv });
        }
      });

      const combined = Array.from(mergedMap.values()).sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      );

      return combined;
    } catch (err) {
      // Check if it's a database connection error
      if (err.code && (err.code.startsWith("E") || err.code.startsWith("28") || err.code.startsWith("3D"))) {
        return sendDbErrorResponse(reply, err, fastify);
      }

      fastify.log.error("HRV/SV API Error:", err);
      reply.code(500).send({
        error: "Internal Server Error",
        details: err.message,
      });
    }
  },

  getStrByRange: async (request, reply) => {
    try {
      const { range = "last_day" } = request.query;
      const settings = rangeSettings[range];

      if (!settings) {
        return reply
          .code(400)
          .send({
            error:
              "Invalid range. Use one of: last_minute, last_hour, last_day, last_week, last_month, last_year.",
          });
      }

      const { interval, bucketSeconds } = settings;
      const { rows } = await getStrByRange(interval, bucketSeconds, trimPercent);

      const formattedResponse = rows.map((row) => ({
        timestamp: row.time_bucket.toISOString(),
        str:
          row.trimmed_str !== null && row.trimmed_str !== undefined && typeof row.trimmed_str === "number"
            ? parseFloat(row.trimmed_str.toFixed(2))
            : null,
      }));

      return formattedResponse;
    } catch (err) {
      // Check if it's a database connection error
      if (err.code && (err.code.startsWith("E") || err.code.startsWith("28") || err.code.startsWith("3D"))) {
        return sendDbErrorResponse(reply, err, fastify);
      }

      fastify.log.error("STR API Error:", err);
      reply.code(500).send({
        error: "Internal Server Error",
        details: err.message,
        hint: "Check if 'str' column exists in readings_vital table",
      });
    }
  },

  getRsByRange: async (request, reply) => {
    try {
      const { range = "last_day" } = request.query;
      const settings = rangeSettings[range];

      if (!settings) {
        return reply
          .code(400)
          .send({
            error:
              "Invalid range. Use one of: last_minute, last_hour, last_day, last_week, last_month, last_year.",
          });
      }

      const { interval, bucketSeconds } = settings;
      const { rows } = await getRsByRange(interval, bucketSeconds, trimPercent);

      const formattedResponse = rows.map((row) => ({
        timestamp: row.time_bucket.toISOString(),
        rs:
          row.trimmed_rs !== null && row.trimmed_rs !== undefined && typeof row.trimmed_rs === "number"
            ? parseFloat(row.trimmed_rs.toFixed(2))
            : null,
      }));

      return formattedResponse;
    } catch (err) {
      // Check if it's a database connection error
      if (err.code && (err.code.startsWith("E") || err.code.startsWith("28") || err.code.startsWith("3D"))) {
        return sendDbErrorResponse(reply, err, fastify);
      }

      fastify.log.error("RS API Error:", err);
      reply.code(500).send({
        error: "Internal Server Error",
        details: err.message,
        hint: "Check if 'rs' column exists in readings_vital table",
      });
    }
  },

  getColumns: async (request, reply) => {
    try {
      const { rows } = await getColumns();
      return { columns: rows };
    } catch (err) {
      // Check if it's a database connection error
      if (err.code && (err.code.startsWith("E") || err.code.startsWith("28") || err.code.startsWith("3D"))) {
        return sendDbErrorResponse(reply, err, fastify);
      }

      fastify.log.error("Columns test error:", err);
      reply.code(500).send({ error: "Internal Server Error", details: err.message });
    }
  },
});
