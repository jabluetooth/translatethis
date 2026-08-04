export const JARGON_LEVELS = [
  {
    value: "board-ready",
    label: "Board-ready",
    description: "Business impact only. No technical terms, no acronyms.",
  },
  {
    value: "manager-friendly",
    label: "Manager-friendly",
    description: "Some technical framing, translated jargon, still readable by a non-engineer.",
  },
  {
    value: "semi-technical",
    label: "Semi-technical",
    description: "Keeps technical terms but explains them; for technical-adjacent readers.",
  },
] as const;

export type JargonLevel = (typeof JARGON_LEVELS)[number]["value"];

export const TONES = [
  { value: "professional", label: "Professional", description: "Neutral, factual, businesslike." },
  { value: "casual", label: "Casual", description: "Conversational, relaxed, like a Slack message." },
  { value: "reassuring", label: "Reassuring", description: "Calm, confidence-building, de-escalating." },
  { value: "urgent", label: "Urgent", description: "Direct, action-oriented, conveys time pressure." },
] as const;

export type Tone = (typeof TONES)[number]["value"];

export const OUTPUT_FORMATS = [
  { value: "paragraph", label: "Paragraph", description: "Flowing prose, 1-3 short paragraphs." },
  { value: "bullet", label: "Bullet summary", description: "Scannable bullet points." },
  { value: "email", label: "Email-ready", description: "Includes a subject line, greeting, and sign-off." },
] as const;

export type OutputFormat = (typeof OUTPUT_FORMATS)[number]["value"];

export const JARGON_LEVEL_VALUES = JARGON_LEVELS.map((l) => l.value) as [JargonLevel, ...JargonLevel[]];
export const TONE_VALUES = TONES.map((t) => t.value) as [Tone, ...Tone[]];
export const OUTPUT_FORMAT_VALUES = OUTPUT_FORMATS.map((f) => f.value) as [OutputFormat, ...OutputFormat[]];

export interface TranslateFormValues {
  level: JargonLevel;
  tone: Tone;
  format: OutputFormat;
}

export interface RateLimitStatus {
  success: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
}

export interface ReadabilityScore {
  fleschReadingEase: number;
  fleschKincaidGrade: number;
  wordCount: number;
}
