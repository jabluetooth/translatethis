"use client";

import { FileText, Upload, X } from "lucide-react";
import { useCallback } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { ALLOWED_FILE_EXTENSIONS, MAX_FILE_BYTES } from "@/lib/constants";
import { cn } from "@/lib/utils";

const ACCEPT = {
  "text/plain": [".txt", ".log"],
  "text/markdown": [".md"],
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
};

interface FileDropzoneProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
}

export function FileDropzone({ file, onFileChange, disabled }: FileDropzoneProps) {
  const onDrop = useCallback(
    (accepted: File[], rejections: FileRejection[]) => {
      if (rejections.length > 0) return;
      onFileChange(accepted[0] ?? null);
    },
    [onFileChange]
  );

  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    onDrop,
    accept: ACCEPT,
    maxSize: MAX_FILE_BYTES,
    multiple: false,
    disabled,
  });

  if (file) {
    return (
      <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate text-sm font-medium">{file.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{Math.round(file.size / 1024)} KB</span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          onClick={() => onFileChange(null)}
          aria-label="Remove file"
        >
          <X className="size-4" />
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div
        {...getRootProps()}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-10 text-center transition-colors cursor-pointer",
          isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50",
          disabled && "pointer-events-none opacity-50"
        )}
      >
        {/* getInputProps provides its own keyboard-accessible native file input as the a11y fallback to dragging */}
        <input {...getInputProps()} aria-label="Upload a file to translate" />
        <Upload className="size-6 text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Drag a file here</span>, or click to browse
        </p>
        <p className="text-xs text-muted-foreground">
          {ALLOWED_FILE_EXTENSIONS.join(", ")} &middot; up to {MAX_FILE_BYTES / 1024 / 1024} MB
        </p>
      </div>
      {fileRejections.length > 0 && (
        <p className="mt-2 text-sm text-destructive">
          {fileRejections[0].errors[0]?.message ?? "That file couldn't be accepted."}
        </p>
      )}
    </div>
  );
}
