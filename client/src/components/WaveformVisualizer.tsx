import { useEffect, useRef } from 'react';
import { Mic, MicOff, Hand, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { audioProcessor } from '../lib/audio';

interface WaveformVisualizerProps {
  isRecording: boolean;
  audioLevel: number;
  assistantStatus: string;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onInterrupt: () => void;
  onReset: () => void;
}

export function WaveformVisualizer({
  isRecording,
  audioLevel,
  assistantStatus,
  onStartRecording,
  onStopRecording,
  onInterrupt,
  onReset,
}: WaveformVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const setCanvasSize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };

    setCanvasSize();
    window.addEventListener('resize', setCanvasSize);

    const animate = () => {
      const width = canvas.width / window.devicePixelRatio;
      const height = canvas.height / window.devicePixelRatio;

      // Clear canvas
      ctx.clearRect(0, 0, width, height);

      // Draw waveform
      if (isRecording) {
        drawWaveform(ctx, width, height);
      } else {
        drawIdleState(ctx, width, height);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', setCanvasSize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRecording, audioLevel]);

  const drawWaveform = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const analyserData = audioProcessor.getAnalyserData();
    if (!analyserData) return;

    const barWidth = width / analyserData.length;
    const centerY = height / 2;

    ctx.fillStyle = 'hsl(207, 90%, 54%)';

    for (let i = 0; i < analyserData.length; i++) {
      const barHeight = (analyserData[i] / 255) * height * 0.8;
      const x = i * barWidth;
      const y = centerY - barHeight / 2;

      ctx.fillRect(x, y, barWidth - 1, barHeight);
    }
  };

  const drawIdleState = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const centerY = height / 2;
    const barCount = 50;
    const barWidth = 3;
    const spacing = width / barCount;

    ctx.fillStyle = 'hsl(240, 3.7%, 15.9%)';

    for (let i = 0; i < barCount; i++) {
      const x = i * spacing + spacing / 2 - barWidth / 2;
      const baseHeight = 8;
      const variation = Math.sin((Date.now() * 0.002) + (i * 0.2)) * 4;
      const barHeight = baseHeight + variation;
      const y = centerY - barHeight / 2;

      ctx.fillRect(x, y, barWidth, barHeight);
    }
  };

  const getStatusIcon = () => {
    switch (assistantStatus) {
      case 'listening':
        return '🎤';
      case 'processing':
        return '⏳';
      case 'responding':
        return '🔊';
      case 'interrupted':
        return '✋';
      default:
        return '🎯';
    }
  };

  const getStatusText = () => {
    switch (assistantStatus) {
      case 'listening':
        return 'Listening...';
      case 'processing':
        return 'Processing...';
      case 'responding':
        return 'Assistant responding...';
      case 'interrupted':
        return 'Interrupted - Ready to continue';
      default:
        return 'Ready to listen - Press and hold to speak';
    }
  };

  return (
    <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-medium text-gray-900">Audio Waveform</h2>
        <div className="flex items-center space-x-2">
          <span className="text-xs text-gray-500 font-mono">{Math.round(audioLevel)} dB</span>
          <div className="w-12 h-1 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-100 rounded-full" 
              style={{ width: `${Math.min(audioLevel, 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Waveform Canvas */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <canvas 
          ref={canvasRef}
          className="w-full h-32 rounded"
          style={{ background: 'transparent' }}
        />
      </div>

      {/* Recording Controls */}
      <div className="flex items-center justify-center space-x-4 mb-6">
        <Button
          size="lg"
          className={`w-16 h-16 rounded-full ${
            isRecording 
              ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
              : 'bg-primary hover:bg-primary/90'
          }`}
          onClick={isRecording ? onStopRecording : onStartRecording}
        >
          {isRecording ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
        </Button>

        <Button
          size="lg"
          variant="outline"
          className="w-12 h-12 rounded-full"
          onClick={onInterrupt}
        >
          <Hand className="w-5 h-5" />
        </Button>

        <Button
          size="lg"
          variant="outline"
          className="w-12 h-12 rounded-full"
          onClick={onReset}
        >
          <RotateCcw className="w-5 h-5" />
        </Button>
      </div>

      {/* Status Display */}
      <div className="text-center">
        <div className="inline-flex items-center space-x-2 px-4 py-2 bg-gray-100 rounded-full">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          <span className="text-sm font-medium">
            {getStatusIcon()} {getStatusText()}
          </span>
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600 mb-2 font-medium">Keyboard Shortcuts:</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs text-gray-500">
          <div><kbd className="bg-white px-2 py-1 rounded border font-mono">Space</kbd> Start/Stop</div>
          <div><kbd className="bg-white px-2 py-1 rounded border font-mono">Esc</kbd> Interrupt</div>
          <div><kbd className="bg-white px-2 py-1 rounded border font-mono">Ctrl+R</kbd> Reset</div>
        </div>
      </div>
    </section>
  );
}
