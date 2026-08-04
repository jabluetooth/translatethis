"use client";

import { Check, Copy, RotateCcw, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { computeReadability, readingEaseLabel } from "@/lib/readability";

interface OutputPanelProps {
  output: string;
  isStreaming: boolean;
  error: string | null;
  onRegenerate: () => void;
  canRegenerate: boolean;
  wasTruncated?: boolean;
}

export function OutputPanel({ output, isStreaming, error, onRegenerate, canRegenerate, wasTruncated }: OutputPanelProps) {
  const [copied, setCopied] = useState(false);
  const readability = useMemo(() => (output ? computeReadability(output) : null), [output]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — try selecting the text manually.");
    }
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">Translation</h2>
        {readability && !isStreaming && (
          <Badge variant="secondary" className="font-normal">
            {readingEaseLabel(readability.fleschReadingEase)} &middot; Grade {readability.fleschKincaidGrade}
          </Badge>
        )}
      </div>

      {wasTruncated && !isStreaming && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-600/30 bg-amber-600/10 p-2.5 text-xs text-amber-700 dark:text-amber-400">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>Your input was longer than the limit, so only the beginning was translated — the ending (often where conclusions land) was cut off.</span>
        </div>
      )}

      <div className="min-h-64 flex-1 rounded-lg border bg-card p-4">
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : output ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {output}
            {isStreaming && <span className="ml-0.5 inline-block h-4 w-2 animate-pulse bg-foreground/40 align-text-bottom" />}
          </p>
        ) : isStreaming ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Your stakeholder-ready translation will appear here.</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleCopy} disabled={!output || isStreaming}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          Copy
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onRegenerate} disabled={!canRegenerate || isStreaming}>
          <RotateCcw className="size-4" />
          Regenerate
        </Button>
      </div>
    </div>
  );
}
