class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.isRecording = false;
    this.port.onmessage = this.handleMessage.bind(this);
  }

  handleMessage(event) {
    if (event.data.type === 'start') {
      this.isRecording = true;
    } else if (event.data.type === 'stop') {
      this.isRecording = false;
    }
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    
    if (input && input.length > 0 && this.isRecording) {
      const inputChannel = input[0];
      
      // Ensure we have sufficient audio data before processing
      if (inputChannel.length >= 128) {
        // Convert Float32 to PCM16 format for Deepgram with proper scaling
        const pcm16Data = new Int16Array(inputChannel.length);
        for (let i = 0; i < inputChannel.length; i++) {
          // Clamp to valid range and convert to 16-bit signed integer
          const clamped = Math.max(-1, Math.min(1, inputChannel[i]));
          // Apply proper scaling and avoid distortion
          pcm16Data[i] = Math.round(clamped * 32767);
        }
        
        this.port.postMessage({
          type: 'audioData',
          audioData: pcm16Data
        });
      }
    }

    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor);
