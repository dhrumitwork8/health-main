import {
    getCurrentVitals,
    getLastNightData,
    getAllPatientsWithSensors,
    getPatientWithSensor,
} from "../models/patientModel.js";
import { pool } from "../db/pool.js";

// Helper function to calculate median
const calculateMedian = (values) => {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
};

// Helper function to calculate average
const calculateAverage = (values) => {
    if (values.length === 0) return null;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
};

// Helper function to count minutes for bed status
const countMinutesWithStatus = (readings, status) => {
    const statusReadings = readings.filter(r => r.bed_status === status);
    // Assuming readings are every few seconds, estimate minutes
    return Math.round(statusReadings.length * 0.1); // Adjust multiplier based on your data frequency
};

export const createPatientController = (fastify) => ({
    // Test endpoint to check database tables
    testDatabase: async (request, reply) => {
        try {
            // Check if tables exist
            const tablesQuery = `
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public'
            `;
            const { rows: tables } = await pool.query(tablesQuery);

            return {
                message: "Database connection successful",
                tables: tables.map(t => t.table_name)
            };
        } catch (err) {
            fastify.log.error("Database test error:", err);
            reply.code(500).send({
                error: "Database connection failed",
                details: err.message
            });
        }
    },

    getAllPatients: async (request, reply) => {
        try {
            const { rows: patients } = await getAllPatientsWithSensors();

            const patientData = await Promise.all(
                patients.map(async (patient, index) => {
                    if (!patient.sensor_id) {
                        return {
                            id: index + 1,
                            name: `${patient.first_name} ${patient.last_name}`,
                            heartRate: 0,
                            respirationRate: 0,
                            bedStatus: "No sensor",
                            lastNightAverage: {
                                heartRate: 0,
                                respirationRate: 0,
                                outOfBedMinutes: 0,
                                movementMinutes: 0,
                            }
                        };
                    }

                    // Get current vitals
                    const { rows: currentReadings } = await getCurrentVitals(patient.sensor_id);

                    // Get last night data
                    const { rows: lastNightReadings } = await getLastNightData(patient.sensor_id);

                    // Calculate current HR (last 20 seconds)
                    const last20SecReadings = currentReadings.filter(r =>
                        new Date() - new Date(r.ts) <= 20000
                    );

                    // Calculate current RR (last 60 seconds) 
                    const last60SecReadings = currentReadings.filter(r =>
                        new Date() - new Date(r.ts) <= 60000
                    );

                    // Get latest bed status
                    const latestReading = currentReadings[0];
                    const currentBedStatus = latestReading ? latestReading.bed_status : null;

                    // Calculate current HR
                    let currentHR = 0;
                    if (currentBedStatus === 0) {
                        currentHR = 0; // Out of bed = 0
                    } else {
                        const hrValues = last20SecReadings
                            .filter(r => r.hr !== null && r.hr > 0 && r.bed_status !== 0)
                            .map(r => parseFloat(r.hr));
                        currentHR = hrValues.length > 0 ? calculateAverage(hrValues) : 0;
                    }

                    // Calculate current RR
                    let currentRR = 0;
                    if (currentBedStatus === 0) {
                        currentRR = 0; // Out of bed = 0
                    } else {
                        const rrValues = last60SecReadings
                            .filter(r => r.rr !== null && r.rr > 0 && r.bed_status !== 0)
                            .map(r => parseFloat(r.rr));
                        currentRR = rrValues.length > 0 ? calculateAverage(rrValues) : 0;
                    }

                    // Calculate last night averages (exclude out of bed readings)
                    const inBedReadings = lastNightReadings.filter(r => r.bed_status > 0);

                    const nightHrValues = inBedReadings
                        .filter(r => r.hr !== null && r.hr > 0)
                        .map(r => parseFloat(r.hr));
                    const nightRrValues = inBedReadings
                        .filter(r => r.rr !== null && r.rr > 0)
                        .map(r => parseFloat(r.rr));

                    const lastNightHR = calculateMedian(nightHrValues) || 0;
                    const lastNightRR = calculateMedian(nightRrValues) || 0;

                    // Calculate sleep metrics
                    const outOfBedMinutes = countMinutesWithStatus(lastNightReadings, 0);
                    const movementMinutes = countMinutesWithStatus(lastNightReadings, 2);

                    // Determine bed status text
                    let bedStatusText = "Unknown";
                    if (currentBedStatus === 0) bedStatusText = "Out of bed";
                    else if (currentBedStatus === 1) bedStatusText = "In bed";
                    else if (currentBedStatus === 2) bedStatusText = "Movement";

                    return {
                        id: index + 1,
                        name: `${patient.first_name} ${patient.last_name}`,
                        heartRate: currentHR !== null ? Math.round(currentHR * 100) / 100 : 0,
                        respirationRate: currentRR !== null ? Math.round(currentRR * 100) / 100 : 0,
                        bedStatus: bedStatusText,
                        lastNightAverage: {
                            heartRate: lastNightHR !== null ? Math.round(lastNightHR * 100) / 100 : 0,
                            respirationRate: lastNightRR !== null ? Math.round(lastNightRR * 100) / 100 : 0,
                            outOfBedMinutes: outOfBedMinutes || 0,
                            movementMinutes: movementMinutes || 0,
                        }
                    };
                })
            );

            return { patients: patientData };
        } catch (err) {
            fastify.log.error(err);
            reply.code(500).send({ error: "Internal Server Error" });
        }
    },

    getPatientDetails: async (request, reply) => {
        try {
            const { patientId } = request.params;
            const { rows: patientRows } = await getPatientWithSensor(patientId);

            if (patientRows.length === 0) {
                return reply.code(404).send({ error: "Patient not found" });
            }

            const patient = patientRows[0];

            if (!patient.sensor_id) {
                return {
                    patientId: patient.patient_id,
                    name: `${patient.first_name} ${patient.last_name}`,
                    sensorId: null,
                    currentVitals: {
                        heartRate: 0,
                        respirationRate: 0,
                        bedStatus: "No sensor"
                    },
                    lastNightData: {
                        heartRate: 0,
                        respirationRate: 0,
                        outOfBedMinutes: 0,
                        movementMinutes: 0
                    }
                };
            }

            // Get current vitals
            const { rows: currentReadings } = await getCurrentVitals(patient.sensor_id);

            // Get last night data
            const { rows: lastNightReadings } = await getLastNightData(patient.sensor_id);

            // Calculate current vitals (same logic as above)
            const last20SecReadings = currentReadings.filter(r =>
                new Date() - new Date(r.ts) <= 20000
            );

            const last60SecReadings = currentReadings.filter(r =>
                new Date() - new Date(r.ts) <= 60000
            );

            const latestReading = currentReadings[0];
            const currentBedStatus = latestReading ? latestReading.bed_status : null;

            let currentHR = 0;
            if (currentBedStatus === 0) {
                currentHR = 0;
            } else {
                const hrValues = last20SecReadings
                    .filter(r => r.hr !== null && r.hr > 0 && r.bed_status !== 0)
                    .map(r => parseFloat(r.hr));
                currentHR = hrValues.length > 0 ? calculateAverage(hrValues) : 0;
            }

            let currentRR = 0;
            if (currentBedStatus === 0) {
                currentRR = 0;
            } else {
                const rrValues = last60SecReadings
                    .filter(r => r.rr !== null && r.rr > 0 && r.bed_status !== 0)
                    .map(r => parseFloat(r.rr));
                currentRR = rrValues.length > 0 ? calculateAverage(rrValues) : 0;
            }

            // Calculate last night data
            const inBedReadings = lastNightReadings.filter(r => r.bed_status > 0);

            const nightHrValues = inBedReadings
                .filter(r => r.hr !== null && r.hr > 0)
                .map(r => parseFloat(r.hr));
            const nightRrValues = inBedReadings
                .filter(r => r.rr !== null && r.rr > 0)
                .map(r => parseFloat(r.rr));

            const lastNightHR = calculateMedian(nightHrValues) || 0;
            const lastNightRR = calculateMedian(nightRrValues) || 0;

            const outOfBedMinutes = countMinutesWithStatus(lastNightReadings, 0);
            const movementMinutes = countMinutesWithStatus(lastNightReadings, 2);

            let bedStatusText = "Unknown";
            if (currentBedStatus === 0) bedStatusText = "Out of bed";
            else if (currentBedStatus === 1) bedStatusText = "In bed";
            else if (currentBedStatus === 2) bedStatusText = "Movement";

            return {
                patientId: patient.patient_id,
                name: `${patient.first_name} ${patient.last_name}`,
                sensorId: patient.sensor_id,
                currentVitals: {
                    heartRate: currentHR !== null ? Math.round(currentHR * 100) / 100 : 0,
                    respirationRate: currentRR !== null ? Math.round(currentRR * 100) / 100 : 0,
                    bedStatus: bedStatusText
                },
                lastNightData: {
                    heartRate: lastNightHR !== null ? Math.round(lastNightHR * 100) / 100 : 0,
                    respirationRate: lastNightRR !== null ? Math.round(lastNightRR * 100) / 100 : 0,
                    outOfBedMinutes: outOfBedMinutes || 0,
                    movementMinutes: movementMinutes || 0
                }
            };
        } catch (err) {
            fastify.log.error(err);
            reply.code(500).send({ error: "Internal Server Error" });
        }
    },
});