"use client";

import { useEffect, useState } from "react";

interface TypewriterTextProps {
  text: string;
  className?: string;
  /** ms per character. */
  speed?: number;
  /** ms to wait before the first character types. */
  startDelay?: number;
}

/**
 * Types `text` out character by character, like it's being typed live.
 * Screen readers get the full text immediately via a visually-hidden node
 * (the animated version is aria-hidden) — the animation is decorative, not
 * the content.
 */
export function TypewriterText({ text, className, speed = 65, startDelay = 400 }: TypewriterTextProps) {
  const [shown, setShown] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Reduced-motion completion is deliberately routed through the same
    // "set state from a timer callback" shape as the normal typing path
    // (just a 0ms one-shot instead of a repeating interval), not set
    // directly in the effect body — keeps this on the SSR-safe, hydration-
    // matching lifecycle (shown starts "" on both server and client's first
    // render either way, only changing once a callback actually fires).
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let i = 0;
    let intervalId: ReturnType<typeof setInterval>;

    const startId = setTimeout(
      () => {
        if (reduced) {
          setShown(text);
          setDone(true);
          return;
        }
        intervalId = setInterval(() => {
          i += 1;
          setShown(text.slice(0, i));
          if (i >= text.length) {
            clearInterval(intervalId);
            setDone(true);
          }
        }, speed);
      },
      reduced ? 0 : startDelay
    );

    return () => {
      clearTimeout(startId);
      clearInterval(intervalId);
    };
  }, [text, speed, startDelay]);

  return (
    <p className={className}>
      <span aria-hidden="true">
        {shown}
        <span
          className={`ml-0.5 inline-block h-[1em] translate-y-[.2em] w-[2px] bg-current align-text-bottom ${done ? "animate-pulse" : "opacity-70"}`}
        />
      </span>
      <span className="sr-only">{text}</span>
    </p>
  );
}
