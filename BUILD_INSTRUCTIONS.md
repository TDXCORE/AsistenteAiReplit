# Vercel Deployment Fix Instructions

## Current Status
- ✅ Local development: Fully working with sub-1000ms voice processing
- ❌ Vercel deployment: API functions returning HTML instead of JSON

## Root Cause
The Vercel serverless functions in `/api/` directory aren't being deployed correctly. The deployment is falling back to serving the static frontend for all routes.

## Solution Steps

### 1. Fix Vercel Configuration
The current `vercel.json` needs to be updated to properly handle serverless functions:

```json
{
  "version": 2,
  "functions": {
    "api/**/*.js": {
      "runtime": "@vercel/node@18"
    }
  },
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### 2. Update API Function Structure
Each API function needs proper module.exports structure:

```javascript
// api/messages/[clientId].js
module.exports = async function handler(req, res) {
  // Function implementation
};
```

### 3. Environment Variables
Ensure these are set in Vercel dashboard:
- `GROQ_API_KEY`
- `ELEVENLABS_API_KEY`

### 4. Deployment Process
1. Push code changes to GitHub
2. Vercel will auto-deploy
3. Test API endpoints: `https://your-app.vercel.app/api/messages/test`

## Verification Commands

Test after deployment:
```bash
# Test initialization
curl -X POST https://your-app.vercel.app/api/messages/test \
  -H "Content-Type: application/json" \
  -d '{"type":"init","timestamp":1749430000000}'

# Test voice processing
curl -X POST https://your-app.vercel.app/api/messages/test \
  -H "Content-Type: application/json" \
  -d '{"type":"voice_input","text":"Hola mundo","timestamp":1749430000000}'
```

## Expected Results
- Should return JSON responses, not HTML
- Voice processing should complete in <2000ms on Vercel
- Audio responses should be available via `/api/audio/[clientId]`

## Fallback Option
If Vercel continues having issues, the local development environment provides full functionality:
```bash
npm run dev
# Access at http://localhost:5000
```