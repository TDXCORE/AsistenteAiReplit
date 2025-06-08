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
      
      // Send audio data in 20ms chunks (320 samples at 16kHz)
      if (inputChannel.length >= 320) {
        const audioData = new Float32Array(320);
        for (let i = 0; i < 320; i++) {
          audioData[i] = inputChannel[i];
        }
        
        this.port.postMessage({
          type: 'audioData',
          audioData: audioData
        });
      }
    }

    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor);
