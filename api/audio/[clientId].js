// Shared global storage with messages endpoint
const audioQueues = new Map();

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
      const audioQueue = audioQueues.get(clientId) || [];
      if (audioQueue.length > 0) {
        const audioData = audioQueue.shift();
        res.setHeader('Content-Type', 'audio/mpeg');
        res.send(Buffer.from(audioData));
      } else {
        res.status(204).send(); // No content
      }
    } catch (error) {
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