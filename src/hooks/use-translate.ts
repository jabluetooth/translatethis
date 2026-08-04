import { useCallback, useRef, useState } from "react";
import type { JargonLevel, OutputFormat, Tone } from "@/lib/types";

export interface TranslateInput {
  text?: string;
  file?: File | null;
  level: JargonLevel;
  tone: Tone;
  format: OutputFormat;
}

export function useTranslate() {
  const [output, setOutput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitRemaining, setRateLimitRemaining] = useState<number | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [wasTruncated, setWasTruncated] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const translate = useCallback(async (input: TranslateInput) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setError(null);
    setOutput("");
    setIsStreaming(true);
    setWasTruncated(false);

    const formData = new FormData();
    if (input.file) {
      formData.append("file", input.file);
    } else {
      formData.append("text", input.text ?? "");
    }
    formData.append("level", input.level);
    formData.append("tone", input.tone);
    formData.append("format", input.format);

    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      if (res.headers.get("X-Plan") === "pro") {
        setIsPro(true);
      } else {
        const remainingHeader = res.headers.get("X-RateLimit-Remaining");
        if (remainingHeader !== null) setRateLimitRemaining(Number(remainingHeader));
      }
      if (res.headers.get("X-Input-Truncated") === "true") setWasTruncated(true);

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `Translation failed (HTTP ${res.status}).`);
      }
      if (!res.body) throw new Error("No response body from server.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setOutput(full);
      }

      if (full.trim().length === 0) {
        throw new Error("The translation service returned no output. Please try again in a moment.");
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsStreaming(false);
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return { output, isStreaming, error, rateLimitRemaining, isPro, wasTruncated, translate, cancel };
}
