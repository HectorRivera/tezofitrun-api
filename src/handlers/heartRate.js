exports.handler = async (event) => {
  console.log("=== HEART RATE API CALLED ===");
  //console.log("Event:", JSON.stringify(event, null, 2));

  try {
    // Parse the request body
    const body = JSON.parse(event.body || "{}");

    // Log the heart rate data
    console.log("Heart Rate Data Received:", {
      heartRate: body.heartRate,
      timestamp: body.timestamp,
      deviceId: body.deviceId,
      sessionId: body.sessionId,
      userId: body.userId,
    });

    // Log headers for debugging
    //console.log('Request Headers:', event.headers);

    // Log query parameters if any
    if (event.queryStringParameters) {
      //console.log('Query Parameters:', event.queryStringParameters);
    }

    // Simulate some processing
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
        message: "Heart rate data received successfully",
        receivedAt: new Date().toISOString(),
        data: {
          heartRate: body.heartRate,
          processed: true,
        },
      }),
    };

    //console.log('Sending Response:', response);
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
