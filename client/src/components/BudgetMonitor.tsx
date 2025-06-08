import { DollarSign, TrendingUp } from 'lucide-react';
import { UsageStats } from '../types/voice';

interface BudgetMonitorProps {
  usage: UsageStats;
}

export function BudgetMonitor({ usage }: BudgetMonitorProps) {
  const budgetPercentage = (usage.monthlySpend / usage.budgetLimit) * 100;
  
  const getBudgetColor = () => {
    if (budgetPercentage < 70) return 'text-green-600 bg-green-500';
    if (budgetPercentage < 90) return 'text-yellow-600 bg-yellow-500';
    return 'text-red-600 bg-red-500';
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center space-x-2 mb-4">
        <DollarSign className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold text-gray-900">Usage & Budget</h3>
      </div>
      
      <div className="space-y-4">
        {/* Monthly Usage */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">Monthly Spend</span>
            <span className="text-lg font-bold text-gray-900 font-mono">
              ${usage.monthlySpend.toFixed(2)}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${getBudgetColor().split(' ')[1]}`}
              style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>Budget: ${usage.budgetLimit}/month</span>
            <span>${(usage.budgetLimit - usage.monthlySpend).toFixed(2)} remaining</span>
          </div>
        </div>

        {/* Service Breakdown */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Service Costs</h4>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 text-sm">STT (Deepgram)</span>
              <span className="font-mono text-sm">${usage.sttCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 text-sm">LLM (Groq)</span>
              <span className="font-mono text-sm">${usage.llmCost.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 text-sm">TTS (ElevenLabs)</span>
              <span className="font-mono text-sm">${usage.ttsCost.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Usage Stats */}
        <div className="pt-4 border-t border-gray-200 space-y-2 text-xs text-gray-500">
          <div className="flex justify-between">
            <span>Total Conversations</span>
            <span className="font-mono">{usage.totalSessions}</span>
          </div>
          <div className="flex justify-between">
            <span>Audio Minutes</span>
            <span className="font-mono">{usage.totalMinutes.toFixed(1)} min</span>
          </div>
          <div className="flex justify-between">
            <span>Avg. Cost/Conversation</span>
            <span className="font-mono">${usage.avgCostPerConversation.toFixed(3)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
