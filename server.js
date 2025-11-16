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
  
  // Test database connection before starting server
  const dbConnected = await testConnection();
  if (!dbConnected) {
    fastify.log.warn("⚠️  Database connection test failed. Server will start but API calls may fail.");
    fastify.log.warn("Please check your database configuration (DB_HOST, DB_PORT, etc.)");
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
