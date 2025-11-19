const AWS = require('aws-sdk');

// WebSocket connection handler
exports.connect = async (event) => {
  console.log('=== WEBSOCKET CONNECT ===');
  console.log('Connection ID:', event.requestContext.connectionId);
  console.log('Event:', JSON.stringify(event, null, 2));

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Connected successfully' })
  };
};

// WebSocket disconnect handler
exports.disconnect = async (event) => {
  console.log('=== WEBSOCKET DISCONNECT ===');
  console.log('Connection ID:', event.requestContext.connectionId);
  console.log('Event:', JSON.stringify(event, null, 2));

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Disconnected successfully' })
  };
};

// Default WebSocket message handler
exports.default = async (event) => {
  console.log('=== WEBSOCKET DEFAULT MESSAGE ===');
  console.log('Connection ID:', event.requestContext.connectionId);
  console.log('Body:', event.body);
  
  try {
    const message = JSON.parse(event.body);
    console.log('Parsed Message:', message);
  } catch (error) {
    console.log('Raw Message (not JSON):', event.body);
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Message received' })
  };
};

// Heart rate WebSocket handler
exports.sendHeartRate = async (event) => {
  console.log('=== WEBSOCKET HEART RATE ===');
  console.log('Connection ID:', event.requestContext.connectionId);
  
  try {
    const heartRateData = JSON.parse(event.body);
    console.log('Heart Rate WebSocket Data:', {
      connectionId: event.requestContext.connectionId,
      heartRate: heartRateData.heartRate,
      timestamp: heartRateData.timestamp,
      sessionId: heartRateData.sessionId,
      zone: heartRateData.zone
    });

    // TODO: Forward this to coach connections
    console.log('TODO: Forward heart rate to coach connections');

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Heart rate received',
        heartRate: heartRateData.heartRate
      })
    };
  } catch (error) {
    console.error('Error processing heart rate WebSocket:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// Coach instruction WebSocket handler
exports.coachInstruction = async (event) => {
  console.log('=== WEBSOCKET COACH INSTRUCTION ===');
  console.log('Connection ID:', event.requestContext.connectionId);
  
  try {
    const instruction = JSON.parse(event.body);
    console.log('Coach Instruction:', {
      connectionId: event.requestContext.connectionId,
      type: instruction.type,
      message: instruction.message,
      targetSessionId: instruction.sessionId
    });

    // TODO: Forward this to athlete connections
    console.log('TODO: Forward instruction to athlete connections');

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Instruction received',
        instruction: instruction.message
      })
    };
  } catch (error) {
    console.error('Error processing coach instruction:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// Sampling interval update WebSocket handler
exports.updateSampling = async (event) => {
  console.log('=== WEBSOCKET UPDATE SAMPLING ===');
  console.log('Connection ID:', event.requestContext.connectionId);
  
  try {
    const samplingUpdate = JSON.parse(event.body);
    console.log('Sampling Update:', {
      connectionId: event.requestContext.connectionId,
      interval: samplingUpdate.interval,
      phase: samplingUpdate.phase,
      sessionId: samplingUpdate.sessionId
    });

    // TODO: Forward this to athlete connections
    console.log('TODO: Forward sampling update to athlete connections');

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: 'Sampling interval updated',
        interval: samplingUpdate.interval,
        phase: samplingUpdate.phase
      })
    };
  } catch (error) {
    console.error('Error processing sampling update:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
