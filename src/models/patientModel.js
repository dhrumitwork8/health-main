import { pool } from "../db/pool.js";

// Get current vitals (last 20 seconds for HR, last 60 seconds for RR)
export const getCurrentVitals = (sensorId) => {
  const query = `
    SELECT 
      hr,
      rr,
      bed_status,
      ts
    FROM readings_vital
    WHERE sensor_id = $1 
      AND ts >= NOW() - INTERVAL '60 seconds'
    ORDER BY ts DESC
  `;

  return pool.query(query, [sensorId]);
};

// Get last night data (10 PM - 6 AM)
export const getLastNightData = (sensorId) => {
  const query = `
    SELECT 
      hr,
      rr,
      bed_status,
      ts
    FROM readings_vital
    WHERE sensor_id = $1 
      AND (
        (DATE(ts) = CURRENT_DATE AND EXTRACT(HOUR FROM ts) >= 22) OR
        (DATE(ts) = CURRENT_DATE + INTERVAL '1 day' AND EXTRACT(HOUR FROM ts) < 6)
      )
    ORDER BY ts DESC
  `;

  return pool.query(query, [sensorId]);
};

// Get all patients with their sensors
export const getAllPatientsWithSensors = () => {
  const query = `
    SELECT 
      p.id as patient_id,
      p.first_name,
      p.last_name,
      s.id as sensor_id
    FROM patients p
    LEFT JOIN sensors s ON p.id = s.patient_id
    ORDER BY p.id
  `;

  return pool.query(query);
};

// Get specific patient with sensor
export const getPatientWithSensor = (patientId) => {
  const query = `
    SELECT 
      p.id as patient_id,
      p.first_name,
      p.last_name,
      s.id as sensor_id
    FROM patients p
    LEFT JOIN sensors s ON p.id = s.patient_id
    WHERE p.id = $1
  `;

  return pool.query(query, [patientId]);
};