const AWS = require("aws-sdk");
const { getConnectedCoaches, removeCoachConnection } = require("./websocket");
// Initialize API Gateway Management API for WebSocket
let apigatewaymanagementapi;
const { Pool } = require("pg"); // Add this import

// Initialize PostgreSQL pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Test connection
pool.on("connect", () => {
  console.log("🐘 HeartRate handler connected to PostgreSQL");
});

exports.handler = async (event) => {
  console.log("=== HEART RATE API CALLED ===");
  //console.log("Event:", JSON.stringify(event, null, 2));

  // Initialize WebSocket API client
  if (!apigatewaymanagementapi) {
    apigatewaymanagementapi = new AWS.ApiGatewayManagementApi({
      endpoint: process.env.WEBSOCKET_ENDPOINT || "http://localhost:3001",
    });
  }

  try {
    const body = JSON.parse(event.body || "{}");
    console.log("Heart Rate Data Received:", body);

    // Store in session database
    await storeHeartRateData(body);

    // Broadcast to WebSocket subscribers (coaches)
    await broadcastHeartRateToCoaches(body);

    const response = {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: true,
        message: "Heart rate data received and broadcasted",
        receivedAt: new Date().toISOString(),
        data: {
          heartRate: body.heartRate,
          processed: true,
          broadcastSent: true,
        },
      }),
    };

    console.log("Sending Response:", response);
    return response;
  } catch (error) {
    console.error("Error processing heart rate data:", error);

    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
    };
  }
};

// Broadcast heart rate data to all connected coaches
const broadcastHeartRateToCoaches = async (heartRateData) => {
  console.log("📡 Broadcasting heart rate to coaches...");

  try {
    // TODO: Get list of connected coach WebSocket connections from storage
    // For now, we'll use a simple in-memory store (not production-ready)

    const coachConnections = await getConnectedCoaches(); // Now async!

    const broadcastMessage = {
      type: "heartRate",
      data: {
        heartRate: heartRateData.heartRate,
        timestamp: heartRateData.timestamp,
        deviceId: heartRateData.deviceId,
        sessionId: heartRateData.sessionId,
        userId: heartRateData.userId,
        zone: calculateHeartRateZone(heartRateData.heartRate),
      },
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

// Simple heart rate zone calculation
const calculateHeartRateZone = (heartRate) => {
  if (heartRate < 120) return 1;
  if (heartRate < 140) return 2;
  if (heartRate < 160) return 3;
  if (heartRate < 180) return 4;
  return 5;
};

// Add session HR data storage
const storeHeartRateData = async (heartRateData) => {
  if (!heartRateData.sessionId) {
    console.log("⚠️ No sessionId provided, skipping database storage");
    return;
  }

  try {
    await pool.query(
      `
      INSERT INTO session_heart_rate_data (session_id, heart_rate, timestamp, device_id)
      VALUES ($1, $2, to_timestamp($3 / 1000.0), $4)
    `,
      [
        heartRateData.sessionId,
        heartRateData.heartRate,
        heartRateData.timestamp,
        heartRateData.deviceId,
      ]
    );

    console.log(
      `💾 Stored HR data: ${heartRateData.heartRate} BPM for session ${heartRateData.sessionId}`
    );
  } catch (error) {
    console.error("Error storing heart rate data:", error);
  }
};

// Export helper functions for WebSocket handlers to use
//module.exports.addCoachConnection = addCoachConnection;
//module.exports.removeCoachConnection = removeCoachConnection;
