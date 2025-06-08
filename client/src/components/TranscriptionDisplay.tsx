import { useEffect, useRef } from 'react';
import { User, Bot, Globe } from 'lucide-react';
import { ConversationMessage } from '../types/voice';

interface TranscriptionDisplayProps {
  messages: ConversationMessage[];
  currentTranscript: string;
  isRecording: boolean;
}

export function TranscriptionDisplay({ 
  messages, 
  currentTranscript, 
  isRecording 
}: TranscriptionDisplayProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentTranscript]);

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <h2 className="text-lg font-medium text-gray-900">Live Transcript</h2>
          </div>
          <div className="flex items-center space-x-2">
            <Globe className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-600">Auto-detect</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="p-6 space-y-4 max-h-96 overflow-y-auto">
        {messages.map((message) => (
          <div key={message.id} className="flex space-x-3">
            <div className="flex-shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                message.type === 'user' 
                  ? 'bg-primary text-white' 
                  : 'bg-green-100 text-green-700'
              }`}>
                {message.type === 'user' ? (
                  <User className="w-4 h-4" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-sm font-medium text-gray-900">
                  {message.type === 'user' ? 'You' : 'Assistant'}
                </span>
                <span className="text-xs text-gray-500 font-mono">
                  {formatTimestamp(message.timestamp)}
                </span>
                {message.type === 'user' && message.language && (
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                    {message.language.toUpperCase()}
                  </span>
                )}
                {message.type === 'assistant' && message.latency && (
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                    {Math.round(message.latency)}ms
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{message.content}</p>
              {message.confidence && (
                <div className="text-xs text-gray-500 mt-1">
                  Confidence: {Math.round(message.confidence * 100)}%
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Current transcript (live) */}
        {(currentTranscript || isRecording) && (
          <div className="flex space-x-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-sm font-medium text-gray-900">You</span>
                <span className="text-xs text-gray-500 font-mono">Live</span>
                <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded animate-pulse">
                  Recording
                </span>
              </div>
              <p className="text-sm text-primary leading-relaxed">
                {currentTranscript || "Listening..."}
                {isRecording && (
                  <span className="inline-block w-2 h-4 bg-primary ml-1 animate-pulse" />
                )}
              </p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Footer */}
      <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          <span>{messages.length} messages</span> • Auto-scroll: 
          <span className="text-green-600 ml-1">ON</span>
        </div>
        <button className="text-sm text-primary hover:text-primary/80 font-medium">
          Clear History
        </button>
      </div>
    </div>
  );
}
