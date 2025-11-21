exports.handler = async (event) => {
  console.log("=== GET USER PREFERENCES ===");
  console.log("User ID:", event.pathParameters?.userId);
  console.log("Event:", JSON.stringify(event, null, 2));

  try {
    const userId = event.pathParameters?.userId || "default-user";

    // Mock user data based on role
    const mockUserData = {
      profile: {
        id: userId,
        name: userId === "coach-123" ? "Coach Hector" : "Runner Mime",
        email:
          userId === "coach-123" ? "coach@example.com" : "runner@example.com",
        role: userId === "coach-123" ? "coach" : "athlete",
        createdAt: "2024-01-01T00:00:00Z",
      },
      preferences: {
        defaultTerrain: "road",
        units: "metric",
        maxHeartRate: 190,
        restingHeartRate: 65,
        zones: {
          zone1: [65, 114], // Recovery
          zone2: [114, 133], // Aerobic
          zone3: [133, 152], // Tempo
          zone4: [152, 171], // Threshold
          zone5: [171, 190], // VO2 Max
        },
      },
      relationships:
        userId === "coach-123"
          ? {
              athletes: [
                { id: "athlete-456", name: "Runner Mime", status: "active" },
                { id: "athlete-789", name: "Runner Luz", status: "active" },
              ],
            }
          : {
              coaches: [
                { id: "coach-123", name: "Coach Hector", status: "active" },
              ],
            },
      pendingInvitations: [
        {
          id: "inv-001",
          sessionId: "session-abc123",
          fromUser: "coach-123",
          fromName: "Coach Hector",
          sessionDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
          sessionDescription: "Interval Training Session",
          terrain: "track",
          estimatedDuration: 45,
          status: "pending",
        },
      ],
      activeSessions: [],
    };

    console.log("Returning user data:", mockUserData);

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: true,
        data: mockUserData,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error("Error fetching user preferences:", error);

    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        success: false,
        error: error.message,
      }),
    };
  }
};
