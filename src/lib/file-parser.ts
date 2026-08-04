import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { ALLOWED_FILE_EXTENSIONS, MAX_FILE_BYTES } from "@/lib/constants";

export class FileParseError extends Error {}

const PARSE_TIMEOUT_MS = 10_000;

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot === -1 ? "" : filename.slice(dot).toLowerCase();
}

export function validateFile(file: File): void {
  const ext = getExtension(file.name);
  if (!ALLOWED_FILE_EXTENSIONS.includes(ext as (typeof ALLOWED_FILE_EXTENSIONS)[number])) {
    throw new FileParseError(
      `Unsupported file type "${ext || "unknown"}". Allowed: ${ALLOWED_FILE_EXTENSIONS.join(", ")}`
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new FileParseError(`File is too large (${Math.round(file.size / 1024)} KB). Max ${MAX_FILE_BYTES / 1024 / 1024} MB.`);
  }
  if (file.size === 0) {
    throw new FileParseError("File is empty.");
  }
}

const PDF_MAGIC = Buffer.from("%PDF-", "ascii");
// DOCX (and any OOXML/ZIP-based format) is a ZIP archive — "PK\x03\x04" is
// the local file header signature every ZIP starts with.
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

/**
 * Confirms the file's actual bytes match what its extension claims before
 * an expensive parser ever touches it — an attacker can rename anything to
 * ".pdf"/".docx", and trusting the extension alone means the parser gets
 * handed content it never expected (see audit #13). `.txt`/`.md`/`.log`
 * have no reliable magic bytes (they're just "whatever bytes"), so they're
 * skipped here and treated as plain UTF-8 text, as before.
 */
function assertMagicBytesMatchExtension(ext: string, buffer: Buffer): void {
  if (ext === ".pdf") {
    if (!buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
      throw new FileParseError("File content doesn't match its extension.");
    }
    return;
  }
  if (ext === ".docx") {
    if (!buffer.subarray(0, ZIP_MAGIC.length).equals(ZIP_MAGIC)) {
      throw new FileParseError("File content doesn't match its extension.");
    }
  }
}

/**
 * Races `promise` against a timeout so a maliciously crafted small file
 * (e.g. a docx whose word/document.xml decompresses to gigabytes) can't tie
 * up CPU/memory indefinitely on a single request. `onTimeout` runs so the
 * caller can still clean up (e.g. parser.destroy()) even though the
 * underlying parse call itself isn't cancellable and keeps running in the
 * background.
 */
function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new FileParseError(message)), PARSE_TIMEOUT_MS);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/**
 * Parses a supported file to plain text entirely in-memory. Nothing here
 * touches disk or object storage regardless of caller — for anonymous
 * translations the extracted text is used once and discarded; for
 * signed-in users it's saved to history afterward (see schema.ts's
 * `translations` table comment for the actual consent model).
 */
export async function parseFileToText(file: File): Promise<string> {
  validateFile(file);
  const ext = getExtension(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());

  switch (ext) {
    case ".txt":
    case ".md":
    case ".log":
      return buffer.toString("utf-8");

    case ".pdf": {
      assertMagicBytesMatchExtension(ext, buffer);
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        const result = await withTimeout(parser.getText(), "File took too long to process.");
        return result.text;
      } finally {
        await parser.destroy();
      }
    }

    case ".docx": {
      assertMagicBytesMatchExtension(ext, buffer);
      const result = await withTimeout(mammoth.extractRawText({ buffer }), "File took too long to process.");
      return result.value;
    }

    default:
      throw new FileParseError(`Unsupported file type "${ext}".`);
  }
}
