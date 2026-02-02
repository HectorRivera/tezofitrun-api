const AWS = require("aws-sdk");
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
// Test connection on handler load
pool.on("connect", () => {
  console.log("🐘 Connected to PostgreSQL");
});

let connectedCoaches = [];
let allConnections = []; // Instead of just connectedCoaches

const addConnection = async (connectionId, userType = "unknown") => {
  try {
    await pool.query(
      "INSERT INTO websocket_connections (connection_id, user_type) VALUES ($1, $2) ON CONFLICT (connection_id) DO UPDATE SET last_seen = CURRENT_TIMESTAMP",
      [connectionId, userType]
    );
    console.log(`➕ ${userType} connected to DB: ${connectionId}`);
  } catch (error) {
    console.error("Error adding connection:", error);
  }
};
const getAllConnections = async () => {
  try {
    const result = await pool.query(
      "SELECT connection_id FROM websocket_connections"
    );
    const connections = result.rows.map((row) => row.connection_id);
    console.log(`🔍 Found ${connections.length} total connections in DB`);
    return connections;
  } catch (error) {
    console.error("Error getting all connections:", error);
    return [];
  }
};

const addCoachConnection = async (connectionId) => {
  try {
    await pool.query(
      "INSERT INTO websocket_connections (connection_id, user_type) VALUES ($1, $2) ON CONFLICT (connection_id) DO UPDATE SET last_seen = CURRENT_TIMESTAMP",
      [connectionId, "coach"]
    );
    console.log(`➕ Coach connected to DB: ${connectionId}`);
  } catch (error) {
    console.error("Error adding coach connection:", error);
  }
};

const removeConnection = async (connectionId) => {
  try {
    const result = await pool.query(
      "DELETE FROM websocket_connections WHERE connection_id = $1",
      [connectionId]
    );
    console.log(`➖ Connection removed from DB: ${connectionId}`);
  } catch (error) {
    console.error("Error removing connection:", error);
  }
};

const getConnectedCoaches = async () => {
  try {
    const result = await pool.query(
      "SELECT connection_id FROM websocket_connections WHERE user_type = $1",
      ["coach"]
    );
    const connections = result.rows.map((row) => row.connection_id);
    console.log(`🔍 Found ${connections.length} connected coaches in DB`);
    return connections;
  } catch (error) {
    console.error("Error getting connected coaches:", error);
    return [];
  }
};

// WebSocket connection handler
exports.connect = async (event) => {
  console.log("=== WEBSOCKET CONNECT ===");
  const connectionId = event.requestContext.connectionId;
  console.log("Connection ID:", connectionId);

  // For now, default to 'athlete' - we can make this smarter later
  await addConnection(connectionId, "athlete");

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Connection established", connectionId }),
  };
};

// WebSocket disconnect handler
exports.disconnect = async (event) => {
  console.log("=== WEBSOCKET DISCONNECT ===");
  const connectionId = event.requestContext.connectionId;

  await removeConnection(connectionId);

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Disconnected successfully" }),
  };
};

// Default WebSocket message handler
exports.default = async (event) => {
  console.log("=== WEBSOCKET DEFAULT MESSAGE ===");
  console.log("Connection ID:", event.requestContext.connectionId);
  console.log("Body:", event.body);

  try {
    const message = JSON.parse(event.body);
    console.log("Parsed Message:", message);
  } catch (error) {
    console.log("Raw Message (not JSON):", event.body);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: "Message received" }),
  };
};

// Heart rate WebSocket handler
exports.sendHeartRate = async (event) => {
  console.log("=== WEBSOCKET HEART RATE ===");
  console.log("Connection ID:", event.requestContext.connectionId);

  try {
    const heartRateData = JSON.parse(event.body);
    console.log("Heart Rate WebSocket Data:", {
      connectionId: event.requestContext.connectionId,
      heartRate: heartRateData.heartRate,
      timestamp: heartRateData.timestamp,
      sessionId: heartRateData.sessionId,
      zone: heartRateData.zone,
    });

    // TODO: Forward this to coach connections
    console.log("TODO: Forward heart rate to coach connections");

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Heart rate received",
        heartRate: heartRateData.heartRate,
      }),
    };
  } catch (error) {
    console.error("Error processing heart rate WebSocket:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

// Coach instruction WebSocket handler
exports.coachInstruction = async (event) => {
  console.log("=== WEBSOCKET COACH INSTRUCTION ===");
  console.log("Connection ID:", event.requestContext.connectionId);

  try {
    const instruction = JSON.parse(event.body);
    console.log("Coach Instruction:", {
      connectionId: event.requestContext.connectionId,
      type: instruction.type,
      message: instruction.message,
      targetSessionId: instruction.sessionId,
    });

    // TODO: Forward this to athlete connections
    console.log("TODO: Forward instruction to athlete connections");

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Instruction received",
        instruction: instruction.message,
      }),
    };
  } catch (error) {
    console.error("Error processing coach instruction:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

// Sampling interval update WebSocket handler
exports.updateSampling = async (event) => {
  console.log("=== WEBSOCKET UPDATE SAMPLING ===");
  console.log("Connection ID:", event.requestContext.connectionId);

  try {
    const samplingUpdate = JSON.parse(event.body);
    console.log("Sampling Update:", {
      connectionId: event.requestContext.connectionId,
      interval: samplingUpdate.interval,
      phase: samplingUpdate.phase,
      sessionId: samplingUpdate.sessionId,
    });

    // TODO: Forward this to athlete connections
    console.log("TODO: Forward sampling update to athlete connections");

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Sampling interval updated",
        interval: samplingUpdate.interval,
        phase: samplingUpdate.phase,
      }),
    };
  } catch (error) {
    console.error("Error processing sampling update:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
// Export functions for heartRate handler to use
exports.getConnectedCoaches = getConnectedCoaches;
exports.addCoachConnection = addCoachConnection;
exports.removeCoachConnection = removeConnection;
exports.getAllConnections = getAllConnections;
