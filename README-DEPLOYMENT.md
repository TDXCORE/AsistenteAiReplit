# Vercel Deployment Guide

## Ultra-Low Latency Voice Assistant

This voice assistant is now fully configured for Vercel serverless deployment with the following features:

### Architecture
- **Client**: Browser Speech Recognition API for voice input on public domains
- **Backend**: Serverless functions for AI processing (Groq + ElevenLabs)
- **Fallback**: HTTP polling instead of WebSockets for public domain compatibility

### Environment Variables Required
```
GROQ_API_KEY=your_groq_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
```

### Deployment Steps
1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy - Vercel will automatically use the vercel.json configuration

### Features
- ✅ Spanish voice recognition using browser APIs
- ✅ AI responses via Groq (llama3-8b-8192 model)
- ✅ Text-to-speech via ElevenLabs
- ✅ HTTP polling fallback for serverless compatibility
- ✅ Auto-detection of deployment environment
- ✅ CORS configured for cross-origin requests
- ✅ Sub-300ms latency optimization

### Usage
1. Click the microphone button
2. Speak in Spanish
3. Browser will transcribe speech automatically
4. AI will process and respond with voice synthesis

### Technical Notes
- Uses browser's built-in Speech Recognition API on public domains
- Fallback to WebSocket audio streaming for local development
- Serverless functions handle AI processing asynchronously
- Audio responses are queued and delivered via HTTP polling