"use client";

import { Loader2, Wand2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InputPanel } from "@/components/translate/input-panel";
import { OutputPanel } from "@/components/translate/output-panel";
import { QuotaHint } from "@/components/translate/quota-hint";
import { TranslateControls } from "@/components/translate/translate-controls";
import { useTranslate } from "@/hooks/use-translate";
import type { JargonLevel, OutputFormat, Tone } from "@/lib/types";

interface TranslateWorkspaceProps {
  /** Server-confirmed (env-based) — safe to mount Clerk hooks when true. */
  authEnabled: boolean;
}

export function TranslateWorkspace({ authEnabled }: TranslateWorkspaceProps) {
  const [mode, setMode] = useState<"text" | "file">("text");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [level, setLevel] = useState<JargonLevel>("manager-friendly");
  const [tone, setTone] = useState<Tone>("professional");
  const [format, setFormat] = useState<OutputFormat>("paragraph");

  const { output, isStreaming, error, rateLimitRemaining, isPro, wasTruncated, translate, cancel } = useTranslate();

  const hasInput = mode === "text" ? text.trim().length > 0 : file !== null;

  const runTranslate = () => {
    if (!hasInput || isStreaming) return;
    translate({ text: mode === "text" ? text : undefined, file: mode === "file" ? file : null, level, tone, format });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardContent className="space-y-5">
          <InputPanel
            mode={mode}
            onModeChange={setMode}
            text={text}
            onTextChange={setText}
            file={file}
            onFileChange={setFile}
            disabled={isStreaming}
          />
          <TranslateControls
            level={level}
            tone={tone}
            format={format}
            onLevelChange={setLevel}
            onToneChange={setTone}
            onFormatChange={setFormat}
            disabled={isStreaming}
          />
          <div className="flex items-center gap-3">
            <Button type="button" onClick={runTranslate} disabled={!hasInput || isStreaming} className="min-w-32">
              {isStreaming ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Translating…
                </>
              ) : (
                <>
                  <Wand2 className="size-4" /> Translate
                </>
              )}
            </Button>
            {isStreaming && (
              <Button type="button" variant="ghost" size="sm" onClick={cancel}>
                Cancel
              </Button>
            )}
            {!isStreaming && isPro && <span className="text-xs text-muted-foreground">Unlimited translations (Pro)</span>}
            {!isStreaming &&
              !isPro &&
              rateLimitRemaining !== null &&
              (authEnabled ? (
                <QuotaHint remaining={rateLimitRemaining} />
              ) : (
                <span className="text-xs text-muted-foreground">
                  {rateLimitRemaining} free {rateLimitRemaining === 1 ? "translation" : "translations"} left
                </span>
              ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="h-full">
          <OutputPanel
            output={output}
            isStreaming={isStreaming}
            error={error}
            onRegenerate={runTranslate}
            canRegenerate={hasInput}
            wasTruncated={wasTruncated}
          />
        </CardContent>
      </Card>
    </div>
  );
}
