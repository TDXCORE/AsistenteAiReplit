import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface LanguageIndicatorProps {
  detectedLanguage: string;
  languageHistory: Array<{ language: string; confidence: number; timestamp: number }>;
  isRecording: boolean;
}

const languageNames: { [key: string]: { name: string; flag: string } } = {
  'en': { name: 'English', flag: '🇺🇸' },
  'es': { name: 'Español', flag: '🇪🇸' },
  'fr': { name: 'Français', flag: '🇫🇷' },
  'de': { name: 'Deutsch', flag: '🇩🇪' },
  'it': { name: 'Italiano', flag: '🇮🇹' },
  'pt': { name: 'Português', flag: '🇵🇹' },
};

export function LanguageIndicator({ detectedLanguage, languageHistory, isRecording }: LanguageIndicatorProps) {
  const currentLanguage = languageNames[detectedLanguage] || { name: detectedLanguage, flag: '🌐' };
  const recentConfidence = languageHistory.length > 0 ? languageHistory[languageHistory.length - 1]?.confidence : 0;
  
  return (
    <div className="flex items-center gap-2 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-lg">{currentLanguage.flag}</span>
        <div className="flex flex-col">
          <Badge 
            variant={isRecording ? "default" : "secondary"}
            className={cn(
              "text-xs font-medium transition-colors",
              isRecording && "animate-pulse"
            )}
          >
            {currentLanguage.name}
          </Badge>
          {recentConfidence > 0 && (
            <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {(recentConfidence * 100).toFixed(0)}% confidence
            </span>
          )}
        </div>
      </div>
      
      {languageHistory.length > 1 && (
        <div className="flex gap-1 ml-2">
          {languageHistory.slice(-3).map((entry, index) => (
            <div 
              key={index}
              className={cn(
                "w-2 h-2 rounded-full transition-colors",
                entry.confidence > 0.8 ? "bg-green-500" : 
                entry.confidence > 0.6 ? "bg-yellow-500" : "bg-red-500"
              )}
              title={`${languageNames[entry.language]?.name || entry.language}: ${(entry.confidence * 100).toFixed(0)}%`}
            />
          ))}
        </div>
      )}
    </div>
  );
}