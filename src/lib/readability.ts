import type { ReadabilityScore } from "@/lib/types";

function countSyllables(word: string): number {
  const normalized = word.toLowerCase().replace(/[^a-z]/g, "");
  if (normalized.length === 0) return 0;
  if (normalized.length <= 3) return 1;

  const withoutTrailingE = normalized.replace(/e$/, "");
  const matches = withoutTrailingE.match(/[aeiouy]+/g);
  return Math.max(1, matches ? matches.length : 1);
}

/**
 * Standard Flesch Reading Ease / Flesch-Kincaid Grade Level, computed with a
 * heuristic syllable counter (no dictionary lookup) — good enough for a UI
 * indicator, not for scientific measurement.
 */
export function computeReadability(text: string): ReadabilityScore {
  const trimmed = text.trim();
  if (!trimmed) {
    return { fleschReadingEase: 0, fleschKincaidGrade: 0, wordCount: 0 };
  }

  const sentences = trimmed.split(/[.!?]+(?:\s|$)/).filter((s) => s.trim().length > 0);
  const words = trimmed.split(/\s+/).filter(Boolean);
  const syllables = words.reduce((sum, word) => sum + countSyllables(word), 0);

  const sentenceCount = Math.max(1, sentences.length);
  const wordCount = Math.max(1, words.length);

  const wordsPerSentence = wordCount / sentenceCount;
  const syllablesPerWord = syllables / wordCount;

  const fleschReadingEase = 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord;
  const fleschKincaidGrade = 0.39 * wordsPerSentence + 11.8 * syllablesPerWord - 15.59;

  return {
    fleschReadingEase: Math.round(fleschReadingEase * 10) / 10,
    fleschKincaidGrade: Math.round(Math.max(0, fleschKincaidGrade) * 10) / 10,
    wordCount: words.length,
  };
}

export function readingEaseLabel(score: number): string {
  if (score >= 90) return "Very easy";
  if (score >= 70) return "Easy";
  if (score >= 60) return "Standard";
  if (score >= 50) return "Fairly difficult";
  if (score >= 30) return "Difficult";
  return "Very difficult";
}
