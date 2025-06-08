import { Activity, Zap, Network } from 'lucide-react';
import { PerformanceMetrics as MetricsType } from '../types/voice';

interface PerformanceMetricsProps {
  metrics: MetricsType;
}

export function PerformanceMetrics({ metrics }: PerformanceMetricsProps) {
  const getLatencyColor = (latency: number) => {
    if (latency < 300) return 'text-green-600';
    if (latency < 400) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getLatencyProgress = (latency: number) => {
    return Math.min((500 - latency) / 500 * 100, 100);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Activity className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold text-gray-900">Performance</h3>
      </div>
      
      <div className="space-y-4">
        {/* Overall Latency */}
        <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">End-to-End Latency</span>
            <span className={`text-lg font-bold font-mono ${getLatencyColor(metrics.totalLatency)}`}>
              {Math.round(metrics.totalLatency)}ms
            </span>
          </div>
          <div className="w-full bg-green-200 rounded-full h-2">
            <div 
              className="bg-green-500 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${getLatencyProgress(metrics.totalLatency)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>0ms</span>
            <span className="font-medium">Target: &lt;300ms</span>
            <span>500ms</span>
          </div>
        </div>

        {/* Component Breakdown */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-gray-700">Component Latency</h4>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Audio Capture</span>
              <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                {Math.round(metrics.audioCaptureLatency)}ms
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Network Upload</span>
              <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                {Math.round(metrics.networkUpLatency)}ms
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">STT Processing</span>
              <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                {Math.round(metrics.sttLatency)}ms
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">LLM Inference</span>
              <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                {Math.round(metrics.llmLatency)}ms
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">TTS Synthesis</span>
              <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                {Math.round(metrics.ttsLatency)}ms
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Network Download</span>
              <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                {Math.round(metrics.networkDownLatency)}ms
              </span>
            </div>
          </div>
        </div>

        {/* Network Quality */}
        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Network Quality</span>
            <div className="flex items-center space-x-1">
              {[...Array(5)].map((_, i) => (
                <div 
                  key={i}
                  className={`w-2 h-2 rounded-full ${
                    i < metrics.connectionQuality ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>
          <div className="text-xs text-gray-500 space-y-1">
            <div className="flex justify-between">
              <span>Uptime:</span>
              <span className="font-mono text-green-600">{metrics.uptime}%</span>
            </div>
            <div className="flex justify-between">
              <span>Ping:</span>
              <span className="font-mono text-green-600">{Math.round(metrics.ping)}ms</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
