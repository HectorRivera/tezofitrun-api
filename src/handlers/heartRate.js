const AWS = require("aws-sdk");
const { getConnectedCoaches, removeCoachConnection } = require("./websocket");
const { v4: uuidv4 } = require("uuid"); // Add this for generating IDs

// Initialize API Gateway Management API for WebSocket
let apigatewaymanagementapi;
const { Pool } = require("pg");

// Initialize PostgreSQL pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test connection
pool.on("connect", () => {
  console.log("🐘 HeartRate handler connected to PostgreSQL");
});

// Main handler - route based on path
exports.handler = async (event) => {
  console.log("=== HEART RATE API CALLED ===");

  // Initialize WebSocket API client
  if (!apigatewaymanagementapi) {
    apigatewaymanagementapi = new AWS.ApiGatewayManagementApi({
      endpoint: process.env.WEBSOCKET_ENDPOINT || "http://localhost:3001",
    });
  }

  try {
    const { httpMethod, path } = event;
    const body = JSON.parse(event.body || "{}");

    console.log(`${httpMethod} ${path}`, body);

    // Route to appropriate function based on path
    if (path.includes("/capture/start")) {
      return await startCapture(event);
    } else if (path.includes("/capture/pause")) {
      return await pauseCapture(event);
    } else if (path.includes("/capture/resume")) {
      return await resumeCapture(event);
    } else if (path.includes("/current")) {
      return await getCurrentCapture(event);
    } else if (path.includes("/data")) {
      return await storeHeartRateDataHandler(event);
    } else {
      // Legacy heart rate data endpoint (existing functionality)
      return await legacyHeartRateHandler(event);
    }
  } catch (error) {
    console.error("Error in heart rate handler:", error);
    return createErrorResponse(error.message);
  }
};

// Start heart rate capture session
const startCapture = async (event) => {
  try {
    const pathParams = event.pathParameters || {};
    const sessionId = pathParams.sessionId;

    if (!sessionId) {
      return createErrorResponse("Session ID is required", 400);
    }

    // Check if session exists and is active
    const sessionResult = await pool.query(
      "SELECT id, status FROM sessions WHERE id = $1",
      [sessionId]
    );

    if (sessionResult.rows.length === 0) {
      return createErrorResponse("Session not found", 404);
    }

    if (sessionResult.rows[0].status !== "active") {
      return createErrorResponse(
        "Session must be active to start heart rate capture",
        400
      );
    }

    // Check for existing active capture
    const existingCapture = await pool.query(
      "SELECT time_capture_session_id FROM heart_rate_capture_events WHERE session_id = $1 AND status = $2",
      [sessionId, "active"]
    );

    if (existingCapture.rows.length > 0) {
      return createErrorResponse("Heart rate capture already active", 400);
    }

    // Create new capture event
    const timeCaptureSessionId = uuidv4();

    await pool.query(
      `INSERT INTO heart_rate_capture_events 
       (time_capture_session_id, session_id, start_time, status) 
       VALUES ($1, $2, NOW(), $3)`,
      [timeCaptureSessionId, sessionId, "active"]
    );

    console.log(
      `💓 Started heart rate capture: ${timeCaptureSessionId} for session: ${sessionId}`
    );

    return createSuccessResponse({
      timeCaptureSessionId,
      sessionId,
      status: "active",
      startTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error starting heart rate capture:", error);
    return createErrorResponse("Failed to start heart rate capture");
  }
};

// Pause heart rate capture
const pauseCapture = async (event) => {
  try {
    const pathParams = event.pathParameters || {};
    const sessionId = pathParams.sessionId;

    if (!sessionId) {
      return createErrorResponse("Session ID is required", 400);
    }

    // Find active capture session
    const activeCapture = await pool.query(
      "SELECT time_capture_session_id FROM heart_rate_capture_events WHERE session_id = $1 AND status = $2",
      [sessionId, "active"]
    );

    if (activeCapture.rows.length === 0) {
      return createErrorResponse("No active heart rate capture found", 404);
    }

    const timeCaptureSessionId = activeCapture.rows[0].time_capture_session_id;

    // Update capture event status to paused
    await pool.query(
      "UPDATE heart_rate_capture_events SET status = $1, end_time = NOW() WHERE time_capture_session_id = $2",
      ["paused", timeCaptureSessionId]
    );

    console.log(`⏸️ Paused heart rate capture: ${timeCaptureSessionId}`);

    return createSuccessResponse({
      timeCaptureSessionId,
      sessionId,
      status: "paused",
      endTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error pausing heart rate capture:", error);
    return createErrorResponse("Failed to pause heart rate capture");
  }
};

// Resume heart rate capture (creates new capture event)
const resumeCapture = async (event) => {
  try {
    const pathParams = event.pathParameters || {};
    const sessionId = pathParams.sessionId;

    if (!sessionId) {
      return createErrorResponse("Session ID is required", 400);
    }

    // End any existing active captures (safety check)
    await pool.query(
      "UPDATE heart_rate_capture_events SET status = $1, end_time = NOW() WHERE session_id = $2 AND status = $3",
      ["paused", sessionId, "active"]
    );

    // Create new capture event
    const timeCaptureSessionId = uuidv4();

    await pool.query(
      `INSERT INTO heart_rate_capture_events 
       (time_capture_session_id, session_id, start_time, status) 
       VALUES ($1, $2, NOW(), $3)`,
      [timeCaptureSessionId, sessionId, "active"]
    );

    console.log(
      `▶️ Resumed heart rate capture: ${timeCaptureSessionId} for session: ${sessionId}`
    );

    return createSuccessResponse({
      timeCaptureSessionId,
      sessionId,
      status: "active",
      startTime: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error resuming heart rate capture:", error);
    return createErrorResponse("Failed to resume heart rate capture");
  }
};

// Get current active capture session
const getCurrentCapture = async (event) => {
  try {
    const pathParams = event.pathParameters || {};
    const sessionId = pathParams.sessionId;

    if (!sessionId) {
      return createErrorResponse("Session ID is required", 400);
    }

    const result = await pool.query(
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
      return createErrorResponse("No active heart rate capture found", 404);
    }

    return createSuccessResponse(result.rows[0]);
  } catch (error) {
    console.error("Error getting current capture:", error);
    return createErrorResponse("Failed to get current heart rate capture");
  }
};

// Store heart rate data with capture session ID
const storeHeartRateDataHandler = async (event) => {
  try {
    const body = JSON.parse(event.body || "{}");
    const { sessionId, timeCaptureSessionId, heartRate, zone, deviceId } = body;

    if (!sessionId || !timeCaptureSessionId || !heartRate) {
      return createErrorResponse(
        "sessionId, timeCaptureSessionId, and heartRate are required",
        400
      );
    }

    // Verify capture session exists and is active
    const captureSession = await pool.query(
      "SELECT status FROM heart_rate_capture_events WHERE time_capture_session_id = $1",
      [timeCaptureSessionId]
    );

    if (captureSession.rows.length === 0) {
      return createErrorResponse("Heart rate capture session not found", 404);
    }

    if (captureSession.rows[0].status !== "active") {
      return createErrorResponse(
        "Cannot store data to inactive capture session",
        400
      );
    }

    // Store heart rate data
    await storeHeartRateData({
      sessionId,
      timeCaptureSessionId,
      heartRate,
      zone: zone || calculateHeartRateZone(heartRate),
      deviceId,
      timestamp: Date.now(),
    });

    // Broadcast to WebSocket subscribers (coaches)
    await broadcastHeartRateToCoaches({
      sessionId,
      timeCaptureSessionId,
      heartRate,
      zone: zone || calculateHeartRateZone(heartRate),
      deviceId,
      timestamp: Date.now(),
    });

    return createSuccessResponse({
      sessionId,
      timeCaptureSessionId,
      heartRate,
      zone,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error storing heart rate data:", error);
    return createErrorResponse("Failed to store heart rate data");
  }
};

// Legacy heart rate handler (existing functionality)
const legacyHeartRateHandler = async (event) => {
  const body = JSON.parse(event.body || "{}");
  console.log("Legacy Heart Rate Data Received:", body);

  // Store in session database
  await storeHeartRateData(body);

  // Broadcast to WebSocket subscribers (coaches)
  await broadcastHeartRateToCoaches(body);

  return createSuccessResponse({
    message: "Heart rate data received and broadcasted",
    receivedAt: new Date().toISOString(),
    data: {
      heartRate: body.heartRate,
      processed: true,
      broadcastSent: true,
    },
  });
};

// Updated store function to handle new capture session ID
const storeHeartRateData = async (heartRateData) => {
  if (!heartRateData.sessionId) {
    console.log("⚠️ No sessionId provided, skipping database storage");
    return;
  }

  try {
    const query = heartRateData.timeCaptureSessionId
      ? `INSERT INTO session_heart_rate_data (session_id, time_capture_session_id, heart_rate, zone, timestamp, device_id)
         VALUES ($1, $2, $3, $4, to_timestamp($5 / 1000.0), $6)`
      : `INSERT INTO session_heart_rate_data (session_id, heart_rate, timestamp, device_id)
         VALUES ($1, $2, to_timestamp($3 / 1000.0), $4)`;

    const values = heartRateData.timeCaptureSessionId
      ? [
          heartRateData.sessionId,
          heartRateData.timeCaptureSessionId,
          heartRateData.heartRate,
          heartRateData.zone,
          heartRateData.timestamp,
          heartRateData.deviceId,
        ]
      : [
          heartRateData.sessionId,
          heartRateData.heartRate,
          heartRateData.timestamp,
          heartRateData.deviceId,
        ];

    await pool.query(query, values);

    console.log(
      `💾 Stored HR data: ${heartRateData.heartRate} BPM for session ${
        heartRateData.sessionId
      }${
        heartRateData.timeCaptureSessionId
          ? ` (capture: ${heartRateData.timeCaptureSessionId})`
          : ""
      }`
    );
  } catch (error) {
    console.error("Error storing heart rate data:", error);
  }
};

// Broadcast heart rate data to all connected coaches (existing function - unchanged)
const broadcastHeartRateToCoaches = async (heartRateData) => {
  console.log("📡 Broadcasting heart rate to coaches...");

  try {
    const coachConnections = await getConnectedCoaches();

    const broadcastMessage = {
      type: "HEART_RATE_UPDATE", // Updated to match Redux message type
      payload: {
        sessionId: heartRateData.sessionId,
        athleteId: heartRateData.userId,
        heartRate: heartRateData.heartRate,
        heartRateZone:
          heartRateData.zone || calculateHeartRateZone(heartRateData.heartRate),
        timestamp: new Date().toISOString(),
        timeCaptureSessionId: heartRateData.timeCaptureSessionId,
      },
      timestamp: new Date().toISOString(),
    };

    const broadcastPromises = coachConnections.map(async (connectionId) => {
      try {
        await apigatewaymanagementapi
          .postToConnection({
            ConnectionId: connectionId,
            Data: JSON.stringify(broadcastMessage),
          })
          .promise();

        console.log(`✅ Sent HR data to coach connection: ${connectionId}`);
      } catch (error) {
        if (error.statusCode === 410) {
          console.log(`🧹 Removing stale connection: ${connectionId}`);
          removeCoachConnection(connectionId);
        } else {
          console.error(`❌ Failed to send to ${connectionId}:`, error);
        }
      }
    });

    await Promise.all(broadcastPromises);
    console.log(`📡 Broadcast completed to ${coachConnections.length} coaches`);
  } catch (error) {
    console.error("Broadcast error:", error);
  }
};

// Simple heart rate zone calculation (existing function - unchanged)
const calculateHeartRateZone = (heartRate) => {
  if (heartRate < 120) return 1;
  if (heartRate < 140) return 2;
  if (heartRate < 160) return 3;
  if (heartRate < 180) return 4;
  return 5;
};

// Helper functions for consistent responses
const createSuccessResponse = (data) => ({
  statusCode: 200,
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    success: true,
    ...data,
  }),
});

const createErrorResponse = (message, statusCode = 500) => ({
  statusCode,
  headers: {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    success: false,
    error: message,
    timestamp: new Date().toISOString(),
  }),
});
