import pg from "pg";
import "../config/env.js";

const { Pool } = pg;

// Validate required environment variables
const requiredEnvVars = ["DB_USER", "DB_HOST", "DB_NAME", "DB_PASSWORD", "DB_PORT"];
const missingVars = requiredEnvVars.filter((varName) => !process.env[varName]);

if (missingVars.length > 0) {
  console.error(
    `❌ Missing required database environment variables: ${missingVars.join(", ")}`
  );
}

export const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: {
    rejectUnauthorized: false,
  },
  // Add connection timeout
  connectionTimeoutMillis: 10000,
  // Add idle timeout
  idleTimeoutMillis: 30000,
});

// Test database connection on startup
pool.on("connect", () => {
  console.log("✅ Database connection established");
});

pool.on("error", (err) => {
  console.error("❌ Unexpected database pool error:", err.message);
  console.error("Database host:", process.env.DB_HOST);
  console.error("Database port:", process.env.DB_PORT);
});

// Test connection function
export const testConnection = async () => {
  try {
    const result = await pool.query("SELECT NOW()");
    console.log("✅ Database connection test successful:", result.rows[0].now);
    return true;
  } catch (err) {
    console.error("❌ Database connection test failed:", err.message);
    console.error("Attempted to connect to:", `${process.env.DB_HOST}:${process.env.DB_PORT}`);
    return false;
  }
};
