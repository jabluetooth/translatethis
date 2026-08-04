"use client";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { JARGON_LEVELS, OUTPUT_FORMATS, TONES, type JargonLevel, type OutputFormat, type Tone } from "@/lib/types";

interface TranslateControlsProps {
  level: JargonLevel;
  tone: Tone;
  format: OutputFormat;
  onLevelChange: (value: JargonLevel) => void;
  onToneChange: (value: Tone) => void;
  onFormatChange: (value: OutputFormat) => void;
  disabled?: boolean;
}

export function TranslateControls({
  level,
  tone,
  format,
  onLevelChange,
  onToneChange,
  onFormatChange,
  disabled,
}: TranslateControlsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor="level-select">Audience level</Label>
        <Select value={level} onValueChange={(v) => onLevelChange(v as JargonLevel)} disabled={disabled}>
          <SelectTrigger id="level-select" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {JARGON_LEVELS.map((l) => (
              <SelectItem key={l.value} value={l.value}>
                {l.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tone-select">Tone</Label>
        <Select value={tone} onValueChange={(v) => onToneChange(v as Tone)} disabled={disabled}>
          <SelectTrigger id="tone-select" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TONES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="format-select">Output format</Label>
        <Select value={format} onValueChange={(v) => onFormatChange(v as OutputFormat)} disabled={disabled}>
          <SelectTrigger id="format-select" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OUTPUT_FORMATS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
