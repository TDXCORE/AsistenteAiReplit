// Import shared storage - this needs to be synchronized with messages endpoint
// For serverless functions, we'll use a simple file-based approach or external storage
const fs = require('fs');
const path = require('path');

// Use temporary directory for audio storage in serverless environment
const tempDir = '/tmp';

function getAudioFilePath(clientId) {
  return path.join(tempDir, `audio_${clientId}.json`);
}

function getAudioQueue(clientId) {
  try {
    const filePath = getAudioFilePath(clientId);
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading audio queue:', error);
  }
  return [];
}

function setAudioQueue(clientId, queue) {
  try {
    const filePath = getAudioFilePath(clientId);
    fs.writeFileSync(filePath, JSON.stringify(queue));
  } catch (error) {
    console.error('Error writing audio queue:', error);
  }
}

module.exports = async function handler(req, res) {
  const { clientId } = req.query;
  
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method === 'GET') {
    try {
      const audioQueue = getAudioQueue(clientId);
      if (audioQueue.length > 0) {
        const audioData = audioQueue.shift();
        setAudioQueue(clientId, audioQueue); // Update the queue after removing item
        res.setHeader('Content-Type', 'audio/mpeg');
        res.send(Buffer.from(audioData));
      } else {
        res.status(204).send(); // No content
      }
    } catch (error) {
      console.error('Audio endpoint error:', error);
      res.status(500).json({ error: 'Failed to get audio' });
    }
  }
  
  if (req.method === 'POST') {
    // Handle audio upload for processing (future implementation)
    try {
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to process audio' });
    }
  }
};