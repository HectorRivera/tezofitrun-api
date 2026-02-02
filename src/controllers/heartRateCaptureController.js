// src/controllers/heartRateCaptureController.js

const { v4: uuidv4 } = require("uuid");
const db = require("../config/database");

class HeartRateCaptureController {
  // Start new heart rate capture session
  static async startCapture(req, res) {
    const { sessionId } = req.params;

    try {
      // Check if session exists and is active
      const session = await db.query(
        "SELECT id, status FROM sessions WHERE id = $1",
        [sessionId]
      );

      if (session.rows.length === 0) {
        return res.status(404).json({ error: "Session not found" });
      }

      if (session.rows[0].status !== "active") {
        return res
          .status(400)
          .json({
            error: "Session must be active to start heart rate capture",
          });
      }

      // Check if there's already an active capture session
      const existingCapture = await db.query(
        "SELECT time_capture_session_id FROM heart_rate_capture_events WHERE session_id = $1 AND status = $2",
        [sessionId, "active"]
      );

      if (existingCapture.rows.length > 0) {
        return res.status(400).json({
          error: "Heart rate capture already active",
          activeCaptureId: existingCapture.rows[0].time_capture_session_id,
        });
      }

      // Create new capture event
      const timeCaptureSessionId = uuidv4();

      await db.query(
        `INSERT INTO heart_rate_capture_events 
         (time_capture_session_id, session_id, start_time, status) 
         VALUES ($1, $2, NOW(), $3)`,
        [timeCaptureSessionId, sessionId, "active"]
      );

      console.log(
        `💓 Started heart rate capture: ${timeCaptureSessionId} for session: ${sessionId}`
      );

      res.status(201).json({
        success: true,
        timeCaptureSessionId,
        sessionId,
        status: "active",
        startTime: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error starting heart rate capture:", error);
      res.status(500).json({ error: "Failed to start heart rate capture" });
    }
  }

  // Pause current heart rate capture
  static async pauseCapture(req, res) {
    const { sessionId } = req.params;

    try {
      // Find active capture session
      const activeCapture = await db.query(
        "SELECT time_capture_session_id FROM heart_rate_capture_events WHERE session_id = $1 AND status = $2",
        [sessionId, "active"]
      );

      if (activeCapture.rows.length === 0) {
        return res
          .status(404)
          .json({ error: "No active heart rate capture found" });
      }

      const timeCaptureSessionId =
        activeCapture.rows[0].time_capture_session_id;

      // Update capture event status to paused
      await db.query(
        "UPDATE heart_rate_capture_events SET status = $1, end_time = NOW() WHERE time_capture_session_id = $2",
        ["paused", timeCaptureSessionId]
      );

      console.log(`⏸️ Paused heart rate capture: ${timeCaptureSessionId}`);

      res.json({
        success: true,
        timeCaptureSessionId,
        sessionId,
        status: "paused",
        endTime: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error pausing heart rate capture:", error);
      res.status(500).json({ error: "Failed to pause heart rate capture" });
    }
  }

  // Resume heart rate capture (creates new capture event)
  static async resumeCapture(req, res) {
    const { sessionId } = req.params;

    try {
      // End any existing active captures (safety check)
      await db.query(
        "UPDATE heart_rate_capture_events SET status = $1, end_time = NOW() WHERE session_id = $2 AND status = $3",
        ["paused", sessionId, "active"]
      );

      // Create new capture event
      const timeCaptureSessionId = uuidv4();

      await db.query(
        `INSERT INTO heart_rate_capture_events 
         (time_capture_session_id, session_id, start_time, status) 
         VALUES ($1, $2, NOW(), $3)`,
        [timeCaptureSessionId, sessionId, "active"]
      );

      console.log(
        `▶️ Resumed heart rate capture: ${timeCaptureSessionId} for session: ${sessionId}`
      );

      res.status(201).json({
        success: true,
        timeCaptureSessionId,
        sessionId,
        status: "active",
        startTime: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error resuming heart rate capture:", error);
      res.status(500).json({ error: "Failed to resume heart rate capture" });
    }
  }

  // Get current active capture session
  static async getCurrentCapture(req, res) {
    const { sessionId } = req.params;

    try {
      const result = await db.query(
        `
        SELECT 
          time_capture_session_id,
          session_id,
          start_time,
          status,
          EXTRACT(EPOCH FROM (NOW() - start_time)) as duration_seconds
        FROM heart_rate_capture_events 
        WHERE session_id = $1 AND status = $2
      `,
        [sessionId, "active"]
      );

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json({ error: "No active heart rate capture found" });
      }

      res.json({
        success: true,
        ...result.rows[0],
      });
    } catch (error) {
      console.error("Error getting current capture:", error);
      res
        .status(500)
        .json({ error: "Failed to get current heart rate capture" });
    }
  }

  // Store heart rate data point
  static async storeHeartRateData(req, res) {
    const { sessionId, timeCaptureSessionId, heartRate, zone, deviceId } =
      req.body;

    try {
      // Verify capture session exists and is active
      const captureSession = await db.query(
        "SELECT status FROM heart_rate_capture_events WHERE time_capture_session_id = $1",
        [timeCaptureSessionId]
      );

      if (captureSession.rows.length === 0) {
        return res
          .status(404)
          .json({ error: "Heart rate capture session not found" });
      }

      if (captureSession.rows[0].status !== "active") {
        return res
          .status(400)
          .json({ error: "Cannot store data to inactive capture session" });
      }

      // Insert heart rate data
      const dataId = uuidv4();
      await db.query(
        `
        INSERT INTO session_heart_rate_data 
        (id, session_id, time_capture_session_id, heart_rate, zone, device_id, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
      `,
        [dataId, sessionId, timeCaptureSessionId, heartRate, zone, deviceId]
      );

      res.status(201).json({
        success: true,
        dataId,
        sessionId,
        timeCaptureSessionId,
        heartRate,
        zone,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error storing heart rate data:", error);
      res.status(500).json({ error: "Failed to store heart rate data" });
    }
  }
}

module.exports = HeartRateCaptureController;
