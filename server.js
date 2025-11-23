import { buildServer } from "./src/app.js";
import { testConnection } from "./src/db/pool.js";

// ## Run the server
const start = async () => {
  const fastify = await buildServer();

  fastify.get("/", async () => {
    return {
      status: "ok",
      message: "server(zh-graph-server) is running 🚀",
    };
  });

  // Test database connection before starting server (with timeout)
  let dbConnected = false;
  try {
    const connectionPromise = testConnection();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Connection test timeout')), 5000)
    );
    dbConnected = await Promise.race([connectionPromise, timeoutPromise]);
  } catch (err) {
    fastify.log.warn("⚠️  Database connection test failed or timed out:", err.message);
    fastify.log.warn("Server will start but API calls may fail.");
    fastify.log.warn(`Check database: ${process.env.DB_HOST}:${process.env.DB_PORT}`);
  }

  try {
    await fastify.listen({ port: process.env.PORT || 3000, host: "0.0.0.0" });
    fastify.log.info(`Server running on http://localhost:${process.env.PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
