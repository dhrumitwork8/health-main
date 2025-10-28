import { createVitalsController } from "../controllers/vitalsController.js";

export const registerVitalsRoutes = (fastify) => {
  const controller = createVitalsController(fastify);

  fastify.get("/api/vitals/live", controller.getVitalsLive);
  fastify.get("/api/hrv/live", controller.getHrvLive);
  fastify.get("/api/sv/live", controller.getSvLive);

  fastify.get("/api/vitals", controller.getVitalsByRange);
  fastify.get("/api/hrv", controller.getHrvByRange);
  fastify.get("/api/sv", controller.getSvByRange);
  fastify.get("/api/str", controller.getStrByRange);
  fastify.get("/api/rs", controller.getRsByRange);

  fastify.get("/api/test/columns", controller.getColumns);
};
