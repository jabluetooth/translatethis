import { createGroq } from "@ai-sdk/groq";
import { DEFAULT_GROQ_MODEL } from "@/lib/constants";

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
});

export function getTranslationModel() {
  const modelId = process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;
  return groq(modelId);
}

export function isGroqConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}
