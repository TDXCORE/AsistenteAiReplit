import { useEffect } from 'react';
import { useVoiceAssistant } from '../hooks/useVoiceAssistant';
import { WaveformVisualizer } from '../components/WaveformVisualizer';
import { PerformanceMetrics } from '../components/PerformanceMetrics';
import { TranscriptionDisplay } from '../components/TranscriptionDisplay';
import { VoiceSettings } from '../components/VoiceSettings';
import { BudgetMonitor } from '../components/BudgetMonitor';
import { SystemStatus } from '../components/SystemStatus';
import { Mic, Settings } from 'lucide-react';

export default function VoiceAssistant() {
  const {
    connectionStatus,
    assistantStatus,
    isRecording,
    isPlaying,
    messages,
    currentTranscript,
    audioLevel,
    metrics,
    sessionStats,
    usageStats,
    voiceSettings,
    startRecording,
    stopRecording,
    interrupt,
    resetConversation,
    updateVoiceSettings,
  } = useVoiceAssistant();

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isRecording && !e.repeat) {
        e.preventDefault();
        startRecording();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        interrupt();
      } else if (e.code === 'KeyR' && e.ctrlKey) {
        e.preventDefault();
        resetConversation();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && isRecording) {
        e.preventDefault();
        stopRecording();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [isRecording, startRecording, stopRecording, interrupt, resetConversation]);

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
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

  const getConnectionStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'error':
        return 'Connection Error';
      case 'disconnected':
        return 'Disconnected';
      default:
        return 'Unknown';
    }
  };

  const formatSessionTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <Mic className="w-4 h-4 text-white" />
                </div>
                <h1 className="text-xl font-semibold text-gray-900">Ultra-Real Voice Assistant</h1>
              </div>
              
              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'connected' ? 'bg-green-500 animate-pulse' : 
                  connectionStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 
                  'bg-red-500'
                }`} />
                <span className={`text-sm font-medium ${getConnectionStatusColor()}`}>
                  {getConnectionStatusText()}
                </span>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Language Selector */}
              <select className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white focus:ring-2 focus:ring-primary focus:border-transparent">
                <option value="auto">Auto-detect</option>
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
              </select>
              
              {/* Settings Button */}
              <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Conversation Area */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status Bar */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${
                    assistantStatus === 'listening' ? 'bg-red-500 animate-pulse' :
                    assistantStatus === 'processing' ? 'bg-yellow-500 animate-pulse' :
                    assistantStatus === 'responding' ? 'bg-green-500 animate-pulse' :
                    'bg-gray-400'
                  }`} />
                  <span className="font-medium text-gray-900">
                    {assistantStatus === 'listening' && '🎤 Listening...'}
                    {assistantStatus === 'processing' && '⏳ Processing...'}
                    {assistantStatus === 'responding' && '🔊 Assistant responding...'}
                    {assistantStatus === 'interrupted' && '✋ Interrupted'}
                    {assistantStatus === 'ready' && '🎯 Ready to chat'}
                  </span>
                </div>
                
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <span>Session: {formatSessionTime(sessionStats.duration)}</span>
                  <span>•</span>
                  <span>{sessionStats.messageCount} messages</span>
                  {metrics.totalLatency > 0 && (
                    <>
                      <span>•</span>
                      <span className="font-mono">
                        Latency: {Math.round(metrics.totalLatency)}ms
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Waveform and Controls */}
            <WaveformVisualizer
              isRecording={isRecording}
              audioLevel={audioLevel}
              assistantStatus={assistantStatus}
              onStartRecording={startRecording}
              onStopRecording={stopRecording}
              onInterrupt={interrupt}
              onReset={resetConversation}
            />

            {/* Conversation Transcript */}
            <TranscriptionDisplay
              messages={messages}
              currentTranscript={currentTranscript}
              isRecording={isRecording}
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Performance Metrics */}
            <PerformanceMetrics metrics={metrics} />

            {/* Budget Monitor */}
            <BudgetMonitor usage={usageStats} />

            {/* Voice Settings */}
            <VoiceSettings 
              settings={voiceSettings}
              onUpdateSettings={updateVoiceSettings}
            />

            {/* System Status */}
            <SystemStatus
              connectionStatus={connectionStatus}
              isRecording={isRecording}
              isPlaying={isPlaying}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
