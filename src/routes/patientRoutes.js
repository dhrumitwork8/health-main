import { createPatientController } from "../controllers/patientController.js";

export const registerPatientRoutes = (fastify) => {
    const controller = createPatientController(fastify);

    // Test database connection
    fastify.get("/api/test/database", controller.testDatabase);

    // Get all patients with calculated vitals
    fastify.get("/api/patients", controller.getAllPatients);

    // Get specific patient details with calculated vitals
    fastify.get("/api/patients/:patientId", controller.getPatientDetails);
};