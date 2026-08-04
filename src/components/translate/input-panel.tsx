"use client";

import { ClipboardPaste } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { FileDropzone } from "@/components/translate/file-dropzone";
import { EXAMPLE_PROMPTS } from "@/lib/examples";
import { MAX_TEXT_CHARS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface InputPanelProps {
  mode: "text" | "file";
  onModeChange: (mode: "text" | "file") => void;
  text: string;
  onTextChange: (text: string) => void;
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
}

export function InputPanel({ mode, onModeChange, text, onTextChange, file, onFileChange, disabled }: InputPanelProps) {
  const overLimit = text.length > MAX_TEXT_CHARS;

  const handlePaste = async () => {
    try {
      const clipboardText = await navigator.clipboard.readText();
      if (clipboardText) onTextChange(clipboardText.slice(0, MAX_TEXT_CHARS));
    } catch {
      // Clipboard permission denied or unavailable — user can paste manually with Ctrl/Cmd+V.
    }
  };

  return (
    <Tabs value={mode} onValueChange={(v) => onModeChange(v as "text" | "file")}>
      <div className="flex items-center justify-between gap-2">
        <TabsList>
          <TabsTrigger value="text">Paste text</TabsTrigger>
          <TabsTrigger value="file">Upload file</TabsTrigger>
        </TabsList>

        <Select onValueChange={(id) => {
          const example = EXAMPLE_PROMPTS.find((e) => e.id === id);
          if (example) {
            onModeChange("text");
            onTextChange(example.text);
          }
        }}>
          <SelectTrigger className="h-8 w-[180px] text-xs" size="sm">
            <SelectValue placeholder="Load an example…" />
          </SelectTrigger>
          <SelectContent>
            {EXAMPLE_PROMPTS.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <TabsContent value="text" className="mt-3 space-y-2">
        <div className="relative">
          <Textarea
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder="Paste your incident report, PR description, ADR, CVE notes, or retro notes here…"
            className="min-h-48 resize-y pr-10"
            disabled={disabled}
            aria-describedby="char-count"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-2 top-2 size-7"
            onClick={handlePaste}
            title="Paste from clipboard"
            disabled={disabled}
          >
            <ClipboardPaste className="size-4" />
          </Button>
        </div>
        <p id="char-count" className={cn("text-right text-xs text-muted-foreground", overLimit && "text-destructive")}>
          {text.length.toLocaleString()} / {MAX_TEXT_CHARS.toLocaleString()} characters
        </p>
      </TabsContent>

      <TabsContent value="file" className="mt-3">
        <FileDropzone file={file} onFileChange={onFileChange} disabled={disabled} />
      </TabsContent>
    </Tabs>
  );
}
