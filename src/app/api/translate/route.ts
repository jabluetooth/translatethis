import { streamText } from "ai";
import { after } from "next/server";
import { z } from "zod";
import { getCurrentAccount } from "@/lib/auth";
import { getTranslationModel, isGroqConfigured } from "@/lib/groq";
import { MAX_FILE_BYTES, MAX_FILE_TEXT_CHARS, MAX_TEXT_CHARS } from "@/lib/constants";
import { isProUser, saveTranslation, syncUser } from "@/lib/db/users";
import { FileParseError, parseFileToText } from "@/lib/file-parser";
import { getGuestRateLimitId } from "@/lib/guest";
import { captureException } from "@/lib/monitoring";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/prompts";
import { checkRateLimit } from "@/lib/rate-limit";
import { JARGON_LEVEL_VALUES, OUTPUT_FORMAT_VALUES, TONE_VALUES, type RateLimitStatus } from "@/lib/types";

export const runtime = "nodejs";

const fieldsSchema = z.object({
  level: z.enum(JARGON_LEVEL_VALUES),
  tone: z.enum(TONE_VALUES),
  format: z.enum(OUTPUT_FORMAT_VALUES),
});

// Small buffer above MAX_FILE_BYTES for multipart/form-data overhead
// (boundary strings, other field bytes) — this only needs to reject
// requests that couldn't possibly satisfy validateFile()'s size check
// anyway, so it's fine to be generous here.
const MAX_REQUEST_BYTES = MAX_FILE_BYTES + 65536;

function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

export async function POST(request: Request) {
  if (!isGroqConfigured()) {
    console.error("[translate] GROQ_API_KEY is not configured.");
    return Response.json({ error: "Translation is temporarily unavailable." }, { status: 503 });
  }

  // Reject oversized requests before ever buffering the body — Content-Length
  // is caller-supplied and not itself trustworthy, but it's enough to bail
  // out early on the common case (and a caller lying about it just means
  // request.formData() below still enforces the real limit via file size /
  // truncation, at worst).
  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
      return Response.json({ error: "Request too large." }, { status: 413 });
    }
  }

  // Resolve identity and enforce the rate limit *before* touching the body
  // (formData()/file parsing) — a caller already over quota shouldn't pay
  // for buffering + CPU-heavy file parsing + a Clerk Backend API call on
  // every rejected request.
  //
  // currentUser() is a Clerk Backend API call, not a free local JWT read —
  // worth it here since it decides which rate-limit tier applies (Upstash
  // account-tier quota doesn't depend on Postgres, so this stays independent
  // of whether syncUser()/saveTranslation() below succeed).
  const account = await getCurrentAccount();

  let isPro = false;
  let proCheckFailed = false;
  if (account) {
    try {
      isPro = await isProUser(account.userId);
    } catch (error) {
      console.error("[translate] isProUser check failed:", error);
      captureException(error, { route: "/api/translate", stage: "isProUser" });
      proCheckFailed = true;
    }
  }

  if (account && proCheckFailed) {
    // Don't fall through into free-tier rate limiting here: that would
    // silently spend one of a *paying* user's (nonexistent, since they're
    // Pro) free-tier tokens and show them upsell copy they don't need, all
    // because of a transient DB hiccup unrelated to their actual plan.
    return Response.json(
      { error: "Could not verify your plan right now — try again in a moment." },
      { status: 503 }
    );
  }

  let rateLimit: RateLimitStatus;
  if (isPro && account) {
    rateLimit = await checkRateLimit(account.userId, "pro");
    if (!rateLimit.success) {
      return Response.json(
        { error: "Daily Pro limit reached — resets soon.", resetMs: rateLimit.resetMs },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(rateLimit.limit),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }
  } else {
    rateLimit = account
      ? await checkRateLimit(account.userId, "account")
      : await checkRateLimit(await getGuestRateLimitId(request), "anonymous");

    if (!rateLimit.success) {
      return Response.json(
        {
          error: account
            ? "Monthly free quota used up. Upgrade to Pro for unlimited translations."
            : "Free anonymous quota used up. Sign in for a higher monthly quota.",
          resetMs: rateLimit.resetMs,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(rateLimit.limit),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return badRequest("Expected multipart/form-data.");
  }

  const parsedFields = fieldsSchema.safeParse({
    level: formData.get("level"),
    tone: formData.get("tone"),
    format: formData.get("format"),
  });
  if (!parsedFields.success) {
    return badRequest(`Invalid form fields: ${parsedFields.error.issues.map((i) => i.message).join(", ")}`);
  }
  const { level, tone, format } = parsedFields.data;

  const rawText = formData.get("text");
  const file = formData.get("file");

  let sourceText: string;
  let truncated = false;

  if (file instanceof File && file.size > 0) {
    try {
      const extracted = (await parseFileToText(file)).trim();
      if (extracted.length > MAX_FILE_TEXT_CHARS) {
        sourceText = extracted.slice(0, MAX_FILE_TEXT_CHARS);
        truncated = true;
      } else {
        sourceText = extracted;
      }
    } catch (error) {
      if (error instanceof FileParseError) return badRequest(error.message);
      return badRequest("Could not read that file. Try a different format or paste the text instead.");
    }
  } else if (typeof rawText === "string" && rawText.trim().length > 0) {
    sourceText = rawText.trim().slice(0, MAX_TEXT_CHARS);
    truncated = rawText.trim().length > MAX_TEXT_CHARS;
  } else {
    return badRequest("Provide either `text` or `file`.");
  }

  if (sourceText.length === 0) {
    return badRequest("No readable text found in the input.");
  }

  const result = streamText({
    model: getTranslationModel(),
    system: buildSystemPrompt(level, tone, format),
    prompt: buildUserPrompt(sourceText),
    onError: ({ error }) => {
      // The HTTP 200 + stream has already started by the time a model-call
      // error can happen, so it can't become a 4xx/5xx here — the client
      // detects an empty completed stream and surfaces its own error (see
      // useTranslate). This log is what you'd actually debug from.
      console.error("[translate] streamText error:", error);
      captureException(error, { route: "/api/translate" });
    },
    onEnd: account
      ? ({ text }) => {
          // after() (not a bare fire-and-forget promise) so this actually
          // runs to completion on serverless deployments — Vercel can kill
          // background work once a response is sent unless it's scheduled
          // this way. A failure here can't affect what the user already
          // received, since the stream is done by the time this runs.
          after(async () => {
            try {
              await syncUser(account.userId, account.email);
              await saveTranslation({ userId: account.userId, sourceText, level, tone, format, outputText: text });
            } catch (error) {
              console.error("[translate] failed to save history:", error);
              captureException(error, { route: "/api/translate", stage: "saveTranslation" });
            }
          });
        }
      : undefined,
  });

  const response = result.toTextStreamResponse();
  if (isPro) {
    response.headers.set("X-Plan", "pro");
  } else if (rateLimit) {
    response.headers.set("X-RateLimit-Limit", String(rateLimit.limit));
    response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));
  }
  if (truncated) response.headers.set("X-Input-Truncated", "true");
  return response;
}
