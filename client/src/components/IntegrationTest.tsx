import { useState } from 'react';
import { Play, CheckCircle, XCircle, Clock, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TestResult {
  service: string;
  status: 'success' | 'error';
  latency?: number;
  error?: string;
  details?: any;
}

interface IntegrationTestProps {
  onRunTest: () => void;
  testResults: {
    success: boolean;
    results: TestResult[];
    totalLatency: number;
  } | null;
  isRunning: boolean;
}

export function IntegrationTest({ onRunTest, testResults, isRunning }: IntegrationTestProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getLatencyColor = (latency: number) => {
    if (latency < 500) return 'text-green-600';
    if (latency < 1000) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Zap className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-gray-900">Integration Test</h3>
        </div>
        <Button
          onClick={onRunTest}
          disabled={isRunning}
          size="sm"
          className="flex items-center space-x-2"
        >
          <Play className="w-4 h-4" />
          <span>{isRunning ? 'Testing...' : 'Run Test'}</span>
        </Button>
      </div>

      {isRunning && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-blue-700">Running end-to-end integration test...</span>
          </div>
        </div>
      )}

      {testResults && (
        <div className="space-y-4">
          {/* Overall Status */}
          <div className={`p-3 rounded-lg ${
            testResults.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {testResults.success ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-500" />
                )}
                <span className={`font-medium ${
                  testResults.success ? 'text-green-800' : 'text-red-800'
                }`}>
                  {testResults.success ? 'All tests passed' : 'Some tests failed'}
                </span>
              </div>
              <span className={`text-sm font-mono ${getLatencyColor(testResults.totalLatency)}`}>
                {testResults.totalLatency}ms total
              </span>
            </div>
          </div>

          {/* Individual Test Results */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-700">Service Tests</h4>
            {testResults.results.map((result, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex items-center space-x-2">
                  {getStatusIcon(result.status)}
                  <span className="text-sm text-gray-700">{result.service}</span>
                </div>
                <div className="flex items-center space-x-2">
                  {result.latency && (
                    <span className={`text-xs font-mono ${getLatencyColor(result.latency)}`}>
                      {result.latency}ms
                    </span>
                  )}
                  {result.error && (
                    <span className="text-xs text-red-600 max-w-32 truncate">
                      {result.error}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Performance Summary */}
          <div className="pt-3 border-t border-gray-200">
            <div className="text-xs text-gray-500 space-y-1">
              <div className="flex justify-between">
                <span>Target Latency:</span>
                <span className="font-mono">&lt;300ms</span>
              </div>
              <div className="flex justify-between">
                <span>Actual Total:</span>
                <span className={`font-mono ${getLatencyColor(testResults.totalLatency)}`}>
                  {testResults.totalLatency}ms
                </span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className={testResults.totalLatency < 300 ? 'text-green-600' : 'text-red-600'}>
                  {testResults.totalLatency < 300 ? 'Meeting target' : 'Above target'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-600">
          This test validates the complete voice processing pipeline: 
          <span className="font-medium"> Deepgram STT → Groq LLM → ElevenLabs TTS</span>
        </p>
      </div>
    </div>
  );
}