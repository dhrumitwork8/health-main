import Fastify from "fastify";
import cors from "@fastify/cors";
import "./config/env.js";
import { registerVitalsRoutes } from "./routes/vitalsRoutes.js";

export const buildServer = async () => {
  const fastify = Fastify({
    logger: true,
  });

  await fastify.register(cors, {
    origin: "*",
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  registerVitalsRoutes(fastify);

  return fastify;
};
