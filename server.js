import { buildServer } from "./src/app.js";

// ## Run the server
const start = async () => {
  const fastify = await buildServer();

  fastify.get("/", async () => {
    return {
      status: "ok",
      message: "server(zh-graph-server) is running 🚀",
    };
  });
  
  try {
    await fastify.listen({ port: process.env.PORT || 3000, host: "0.0.0.0" });
    fastify.log.info(`Server running on http://localhost:${process.env.PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
