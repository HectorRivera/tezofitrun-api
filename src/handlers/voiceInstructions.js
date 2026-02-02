// src/handlers/voiceInstructions.js
const AWS = require("aws-sdk");

let apigatewaymanagementapi;

// In the handler, initialize it:
if (!apigatewaymanagementapi) {
  apigatewaymanagementapi = new AWS.ApiGatewayManagementApi({
    endpoint: process.env.WEBSOCKET_ENDPOINT || "http://localhost:3001",
  });
}
const { getAllConnections } = require("./websocket");
const broadcastVoiceInstructionToAthlete = async (
  athleteId,
  instructionData
) => {
  // For now, broadcast to all connections (we'll filter by athlete later)

  const connections = await getAllConnections();
  console.log(`📡 Broadcasting to ${connections.length} connections`);
  const broadcastPromises = connections.map(async (connectionId) => {
    try {
      console.log(`📤 Attempting to send to connection: ${connectionId}`);
      await apigatewaymanagementapi
        .postToConnection({
          ConnectionId: connectionId,
          Data: JSON.stringify(instructionData),
        })
        .promise();
      console.log(`✅ Successfully sent to connection: ${connectionId}`);
    } catch (error) {
      console.error(
        `❌ Failed to send to connection ${connectionId}:`,
        error.statusCode,
        error.message
      );

      if (error.statusCode === 410) {
        console.log(`🧹 Removing stale connection: ${connectionId}`);
        // Remove stale connection
      }
    }
  });

  await Promise.all(broadcastPromises);
  console.log("📡 Broadcast batch completed");
};
exports.sendVoiceInstruction = async (event) => {
  console.log("=== SEND VOICE INSTRUCTION ===");

  try {
    const body = JSON.parse(event.body || "{}");
    const { sessionId, athleteId, message, instructionType, coachId } = body;

    console.log("🎙️ Broadcasting voice instruction to athlete:", athleteId);

    // Broadcast to WebSocket connections
    const broadcastMessage = {
      type: "COACH_VOICE_INSTRUCTION", // ← Singular (not INSTRUCTIONS)
      payload: {
        message,
        priority: "low",
        sessionId,
        voiceSettings: {
          // ← Plural (not voiceSetting)
          language: "en-US",
          voice: "com.apple.ttsbundle.Samantha-compact",
        },
      },
      timestamp: new Date().toISOString(), // ← ISO string format preferred
    };

    // Use existing WebSocket broadcast infrastructure
    await broadcastVoiceInstructionToAthlete(athleteId, broadcastMessage);

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        success: true,
        message: "Voice instruction sent",
        instruction: message,
      }),
    };
  } catch (error) {
    console.error("Error sending voice instruction:", error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};
