export class AudioProcessor {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private audioWorkletNode: AudioWorkletNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private isRecording = false;
  private onAudioData?: (data: Float32Array) => void;
  private onAudioLevel?: (level: number) => void;

  async initialize() {
    try {
      // Create AudioContext
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000,
        latencyHint: 'interactive',
      });

      // Resume audio context if suspended (requires user interaction)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Load audio worklet processor
      await this.audioContext.audioWorklet.addModule('/audio-processor.js');

      // Get microphone stream with fallback options
      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (error) {
        console.warn('Failed with preferred audio settings, trying fallback:', error);
        // Fallback to basic audio constraints
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: true
        });
      }

      // Create audio nodes
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.audioWorkletNode = new AudioWorkletNode(this.audioContext, 'audio-processor');
      this.analyserNode = this.audioContext.createAnalyser();

      // Configure analyser
      this.analyserNode.fftSize = 256;
      this.analyserNode.smoothingTimeConstant = 0.8;

      // Connect audio graph
      this.sourceNode.connect(this.audioWorkletNode);
      this.sourceNode.connect(this.analyserNode);
      this.audioWorkletNode.connect(this.audioContext.destination);

      // Handle audio data from worklet
      this.audioWorkletNode.port.onmessage = (event) => {
        if (event.data.type === 'audioData' && this.isRecording) {
          // PCM16 data is ready for transmission
          const pcm16Array = event.data.audioData; // Int16Array
          // Convert to Float32Array for onAudioData callback
          const float32Array = new Float32Array(pcm16Array.length);
          for (let i = 0; i < pcm16Array.length; i++) {
            float32Array[i] = pcm16Array[i] / 32768.0; // Convert back to float for processing
          }
          this.onAudioData?.(float32Array);
        }
      };

      console.log('Audio processor initialized successfully');
    } catch (error) {
      console.error('Failed to initialize audio processor:', error);
      throw error;
    }
  }

  async startRecording(onAudioData: (data: Float32Array) => void, onAudioLevel?: (level: number) => void) {
    try {
      if (!this.audioContext || !this.audioWorkletNode) {
        await this.initialize();
      }

      // Resume audio context if suspended (requires user gesture)
      if (this.audioContext && this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      if (!this.audioContext || !this.audioWorkletNode) {
        throw new Error('Audio processor failed to initialize');
      }

      this.isRecording = true;
      this.onAudioData = onAudioData;
      this.onAudioLevel = onAudioLevel;

      // Start audio worklet processing
      this.audioWorkletNode.port.postMessage({ type: 'start' });

      // Start audio level monitoring
      if (onAudioLevel) {
        this.startAudioLevelMonitoring();
      }
      
      console.log('Recording started successfully');
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw error;
    }
  }

  stopRecording() {
    this.isRecording = false;
    
    if (this.audioWorkletNode) {
      this.audioWorkletNode.port.postMessage({ type: 'stop' });
    }
  }

  private startAudioLevelMonitoring() {
    if (!this.analyserNode) return;

    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
    
    const updateLevel = () => {
      if (!this.isRecording || !this.analyserNode) return;

      this.analyserNode.getByteFrequencyData(dataArray);
      
      // Calculate RMS level
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / dataArray.length);
      const level = (rms / 255) * 100;

      this.onAudioLevel?.(level);
      
      if (this.isRecording) {
        requestAnimationFrame(updateLevel);
      }
    };

    updateLevel();
  }

  getAnalyserData(): Uint8Array | null {
    if (!this.analyserNode) return null;
    
    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
    this.analyserNode.getByteFrequencyData(dataArray);
    return dataArray;
  }

  cleanup() {
    this.stopRecording();

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
    }

    if (this.audioContext) {
      this.audioContext.close();
    }

    this.audioContext = null;
    this.mediaStream = null;
    this.audioWorkletNode = null;
    this.sourceNode = null;
    this.analyserNode = null;
  }
}

export const audioProcessor = new AudioProcessor();
