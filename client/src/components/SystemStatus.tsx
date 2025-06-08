import { Monitor, Wifi, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { ConnectionStatus } from '../types/voice';

interface SystemStatusProps {
  connectionStatus: ConnectionStatus;
  isRecording: boolean;
  isPlaying: boolean;
}

export function SystemStatus({ connectionStatus, isRecording, isPlaying }: SystemStatusProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-2 h-2 text-green-500" />;
      case 'connecting':
        return <AlertCircle className="w-2 h-2 text-yellow-500" />;
      case 'error':
      case 'disconnected':
        return <XCircle className="w-2 h-2 text-red-500" />;
      default:
        return <div className="w-2 h-2 bg-gray-400 rounded-full" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting';
      case 'error':
        return 'Error';
      case 'disconnected':
        return 'Disconnected';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected':
        return 'text-green-600';
      case 'connecting':
        return 'text-yellow-600';
      case 'error':
      case 'disconnected':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Monitor className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold text-gray-900">System Status</h3>
      </div>
      
      <div className="space-y-3">
        {/* Service Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {getStatusIcon(connectionStatus)}
              <span className="text-sm text-gray-700">WebSocket Control</span>
            </div>
            <span className={`text-xs font-medium ${getStatusColor(connectionStatus)}`}>
              {getStatusText(connectionStatus)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {getStatusIcon(connectionStatus)}
              <span className="text-sm text-gray-700">WebSocket Audio</span>
            </div>
            <span className={`text-xs font-medium ${getStatusColor(connectionStatus)}`}>
              {connectionStatus === 'connected' ? 'Streaming' : getStatusText(connectionStatus)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {getStatusIcon('connected')}
              <span className="text-sm text-gray-700">Microphone</span>
            </div>
            <span className={`text-xs font-medium ${isRecording ? 'text-red-600' : 'text-green-600'}`}>
              {isRecording ? 'Recording' : 'Ready'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {getStatusIcon('connected')}
              <span className="text-sm text-gray-700">Audio Context</span>
            </div>
            <span className="text-xs text-green-600 font-medium">Running</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {getStatusIcon('connected')}
              <span className="text-sm text-gray-700">VAD Engine</span>
            </div>
            <span className="text-xs text-green-600 font-medium">Active</span>
          </div>
        </div>

        <div className="pt-3 border-t border-gray-200">
          <button className="w-full text-sm text-primary hover:text-primary/80 font-medium py-2 px-3 rounded-md hover:bg-primary/5 transition-colors">
            Run Diagnostics
          </button>
        </div>
      </div>
    </div>
  );
}
