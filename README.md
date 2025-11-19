# TezoFitRun API

Serverless API for real-time heart rate coaching with WebSocket support.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure AWS credentials:**
   ```bash
   aws configure
   # or use AWS_PROFILE environment variable
   ```

## Development

**Local development:**
```bash
npm run local
# API: http://localhost:3000
# WebSocket: ws://localhost:3001
```

**Test the REST API:**
```bash
curl -X POST http://localhost:3000/dev/heartrate \
  -H "Content-Type: application/json" \
  -d '{"heartRate": 165, "timestamp": 1700123456, "deviceId": "test-device", "sessionId": "session-123"}'
```

## Deployment

**Deploy to AWS:**
```bash
npm run deploy
```

**Deploy to specific stage:**
```bash
serverless deploy --stage prod
```

**View logs:**
```bash
npm run logs
# or
serverless logs -f heartRate -t
```

## API Endpoints

### REST API
- `POST /heartrate` - Send heart rate data

### WebSocket Routes
- `$connect` - Client connects to WebSocket
- `$disconnect` - Client disconnects
- `$default` - Default message handler
- `sendHeartRate` - Send heart rate data via WebSocket
- `coachInstruction` - Send coaching instruction
- `updateSampling` - Update sampling interval

## Testing

**Test heart rate endpoint:**
```javascript
// React Native code example
const sendHeartRate = async (heartRate) => {
  const response = await fetch('https://your-api-url.com/dev/heartrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      heartRate,
      timestamp: Date.now(),
      deviceId: 'device-123',
      sessionId: 'session-456'
    })
  });
  return response.json();
};
```

**Test WebSocket:**
```javascript
// WebSocket connection example
const ws = new WebSocket('wss://your-websocket-url.com/dev');

// Send heart rate
ws.send(JSON.stringify({
  action: 'sendHeartRate',
  heartRate: 165,
  timestamp: Date.now(),
  sessionId: 'session-123'
}));
```

## CloudWatch Logs

All handlers log extensively to CloudWatch for debugging:
- Connection events
- Message payloads
- Error details
- Processing steps

View logs in AWS Console: CloudWatch → Log Groups → `/aws/lambda/tezofitrun-api-dev-*`
