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
      
      // Convert Float32 to PCM16 format for Deepgram
      const pcm16Data = new Int16Array(inputChannel.length);
      for (let i = 0; i < inputChannel.length; i++) {
        // Convert float32 (-1 to 1) to int16 (-32768 to 32767)
        const sample = Math.max(-1, Math.min(1, inputChannel[i]));
        pcm16Data[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
      }
      
      this.port.postMessage({
        type: 'audioData',
        audioData: pcm16Data
      });
    }

    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor);
