import { Settings, Mic, Volume2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VoiceSettings as VoiceSettingsType } from '../types/voice';

interface VoiceSettingsProps {
  settings: VoiceSettingsType;
  onUpdateSettings: (settings: Partial<VoiceSettingsType>) => void;
}

export function VoiceSettings({ settings, onUpdateSettings }: VoiceSettingsProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Settings className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold text-gray-900">Audio Settings</h3>
      </div>
      
      <div className="space-y-6">
        {/* Voice Selection */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-700">Voice Model</Label>
          <Select 
            value={settings.selectedVoice} 
            onValueChange={(value) => onUpdateSettings({ selectedVoice: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cloned">Your Cloned Voice</SelectItem>
              <SelectItem value="rachel">Rachel (Professional)</SelectItem>
              <SelectItem value="adam">Adam (Conversational)</SelectItem>
              <SelectItem value="bella">Bella (Friendly)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* VAD Sensitivity */}
        <div className="space-y-3">
          <Label className="text-sm font-medium text-gray-700">Voice Detection Sensitivity</Label>
          <div className="px-2">
            <Slider
              value={[settings.vadSensitivity]}
              onValueChange={([value]) => onUpdateSettings({ vadSensitivity: value })}
              max={100}
              min={0}
              step={5}
              className="w-full"
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>Conservative</span>
            <span>Balanced</span>
            <span>Aggressive</span>
          </div>
          <div className="text-xs text-gray-600 text-center">
            Current: {settings.vadSensitivity}%
          </div>
        </div>

        {/* Audio Quality */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-gray-700">Audio Quality</Label>
          <Select 
            value={settings.audioQuality} 
            onValueChange={(value: '16khz' | '24khz' | '48khz') => onUpdateSettings({ audioQuality: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="16khz">Standard (16kHz)</SelectItem>
              <SelectItem value="24khz">High (24kHz)</SelectItem>
              <SelectItem value="48khz">Ultra (48kHz)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Toggle Settings */}
        <div className="space-y-4 pt-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-700">Advanced Options</h4>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm text-gray-700">Auto Language Detection</Label>
                <p className="text-xs text-gray-500">Automatically detect and respond in the same language</p>
              </div>
              <Switch
                checked={settings.autoLanguage}
                onCheckedChange={(checked) => onUpdateSettings({ autoLanguage: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm text-gray-700">Smart Interruptions</Label>
                <p className="text-xs text-gray-500">Allow natural conversation interruptions</p>
              </div>
              <Switch
                checked={settings.smartInterruptions}
                onCheckedChange={(checked) => onUpdateSettings({ smartInterruptions: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm text-gray-700">Noise Suppression</Label>
                <p className="text-xs text-gray-500">Reduce background noise</p>
              </div>
              <Switch
                checked={settings.noiseSupression}
                onCheckedChange={(checked) => onUpdateSettings({ noiseSupression: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm text-gray-700">Echo Cancellation</Label>
                <p className="text-xs text-gray-500">Prevent audio feedback loops</p>
              </div>
              <Switch
                checked={settings.echoCancellation}
                onCheckedChange={(checked) => onUpdateSettings({ echoCancellation: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm text-gray-700">Auto Gain Control</Label>
                <p className="text-xs text-gray-500">Automatically adjust microphone level</p>
              </div>
              <Switch
                checked={settings.autoGainControl}
                onCheckedChange={(checked) => onUpdateSettings({ autoGainControl: checked })}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
