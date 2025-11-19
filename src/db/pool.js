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

// Test connection function with detailed diagnostics
export const testConnection = async () => {
  const dbHost = process.env.DB_HOST;
  const dbPort = process.env.DB_PORT;
  
  try {
    const result = await pool.query("SELECT NOW()");
    console.log("✅ Database connection test successful:", result.rows[0].now);
    console.log(`   Connected to: ${dbHost}:${dbPort}`);
    return true;
  } catch (err) {
    console.error("❌ Database connection test failed");
    console.error(`   Error: ${err.message}`);
    console.error(`   Error code: ${err.code || "N/A"}`);
    console.error(`   Attempted to connect to: ${dbHost}:${dbPort}`);
    
    // Provide specific guidance based on error type
    if (err.code === "ENOTFOUND" || err.code === "EAI_AGAIN") {
      console.error("   ⚠️  DNS resolution failed. Try using an IP address instead of hostname.");
      console.error("   💡 Tip: Run 'nslookup " + dbHost + "' or 'ping " + dbHost + "' to test DNS resolution.");
    } else if (err.code === "EHOSTUNREACH") {
      console.error("   ⚠️  Host unreachable. Check network connectivity and firewall rules.");
      console.error("   💡 Tip: Run 'ping " + dbHost + "' or 'telnet " + dbHost + " " + dbPort + "' to test connectivity.");
    } else if (err.code === "ECONNREFUSED") {
      console.error("   ⚠️  Connection refused. PostgreSQL may not be running or not accepting connections.");
      console.error("   💡 Tip: Check if PostgreSQL is running and configured to accept connections from this host.");
    } else if (err.code === "ETIMEDOUT") {
      console.error("   ⚠️  Connection timeout. The server may be down or unreachable.");
    }
    
    return false;
  }
};
