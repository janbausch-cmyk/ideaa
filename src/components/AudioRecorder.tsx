"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type RecorderState =
  | "idle"
  | "requesting"
  | "recording"
  | "uploading"
  | "error";

const MAX_RECORDING_MS = 90_000;

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return undefined;
}

function extensionFor(mime: string | undefined): string {
  if (!mime) return "webm";
  if (mime.includes("mp4")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  return "webm";
}

function friendlyErrorFor(err: unknown): string {
  if (err instanceof Error) {
    if (err.name === "NotAllowedError" || err.name === "SecurityError") {
      return "Mikrofon-Zugriff verweigert. Bitte in den Browser-Einstellungen erlauben.";
    }
    if (err.name === "NotFoundError" || err.name === "OverconstrainedError") {
      return "Kein Mikrofon gefunden.";
    }
    if (err.name === "NotReadableError") {
      return "Mikrofon wird bereits von einer anderen App genutzt.";
    }
  }
  return "Aufnahme fehlgeschlagen. Bitte erneut versuchen.";
}

async function uploadForTranscription(
  blob: Blob,
  filename: string,
): Promise<string> {
  const form = new FormData();
  form.set("audio", blob, filename);
  form.set("filename", filename);
  form.set("language", "de");
  const res = await fetch("/api/transcribe", { method: "POST", body: form });
  if (!res.ok) {
    let code: string | undefined;
    try {
      const data = (await res.json()) as { error?: string };
      code = data.error;
    } catch {
      // ignore
    }
    if (res.status === 413 || code === "audio-too-large") {
      throw new Error("Aufnahme ist zu lang. Bitte kürzer aufnehmen.");
    }
    if (res.status === 503 || code === "not-configured") {
      throw new Error("Transkription gerade nicht verfügbar.");
    }
    throw new Error("Transkription fehlgeschlagen. Bitte erneut versuchen.");
  }
  const data = (await res.json()) as { text?: string };
  return (data.text ?? "").trim();
}

function appendToTextarea(textareaId: string, addition: string): void {
  const el = document.getElementById(textareaId);
  if (!(el instanceof HTMLTextAreaElement)) return;
  const trimmed = addition.trim();
  if (!trimmed) return;
  const current = el.value;
  const separator = current.length === 0 ? "" : current.endsWith("\n") ? "" : "\n";
  el.value = `${current}${separator}${trimmed}`;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.focus();
  const end = el.value.length;
  try {
    el.setSelectionRange(end, end);
  } catch {
    // some browsers throw on hidden elements
  }
}

export default function AudioRecorder({
  textareaId = "idea",
}: {
  textareaId?: string;
}) {
  const [state, setState] = useState<RecorderState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef<string | undefined>(undefined);
  const startTimeRef = useRef<number>(0);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cleanupStream = useCallback(() => {
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    recorderRef.current = null;
  }, []);

  useEffect(() => cleanupStream, [cleanupStream]);

  const start = useCallback(async () => {
    setErrorMessage(null);
    if (
      typeof MediaRecorder === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setErrorMessage(
        "Dein Browser unterstützt keine Mikrofon-Aufnahme.",
      );
      setState("error");
      return;
    }
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickMimeType();
      mimeRef.current = mime;
      const recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime })
        : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        setErrorMessage("Aufnahme fehlgeschlagen. Bitte erneut versuchen.");
        setState("error");
        cleanupStream();
      };

      recorder.onstop = async () => {
        const captured = chunksRef.current;
        chunksRef.current = [];
        const usedMime = mimeRef.current;
        cleanupStream();

        if (captured.length === 0) {
          setErrorMessage("Keine Aufnahme erfasst.");
          setState("error");
          return;
        }

        const blob = new Blob(captured, {
          type: usedMime ?? captured[0].type ?? "audio/webm",
        });
        const filename = `recording.${extensionFor(usedMime)}`;
        setState("uploading");
        try {
          const text = await uploadForTranscription(blob, filename);
          if (text.length === 0) {
            setErrorMessage("Konnte keinen Text erkennen. Bitte erneut versuchen.");
            setState("error");
            return;
          }
          appendToTextarea(textareaId, text);
          setState("idle");
          setElapsedMs(0);
        } catch (err) {
          setErrorMessage(
            err instanceof Error
              ? err.message
              : "Transkription fehlgeschlagen. Bitte erneut versuchen.",
          );
          setState("error");
        }
      };

      startTimeRef.current = Date.now();
      setElapsedMs(0);
      recorder.start();
      setState("recording");

      autoStopRef.current = setTimeout(() => {
        if (recorderRef.current?.state === "recording") {
          recorderRef.current.stop();
        }
      }, MAX_RECORDING_MS);

      tickRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startTimeRef.current);
      }, 250);
    } catch (err) {
      setErrorMessage(friendlyErrorFor(err));
      setState("error");
      cleanupStream();
    }
  }, [cleanupStream, textareaId]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") {
      recorder.stop();
    }
  }, []);

  const cancelError = useCallback(() => {
    setErrorMessage(null);
    setState("idle");
  }, []);

  const seconds = Math.floor(elapsedMs / 1000);
  const remaining = Math.max(
    0,
    Math.ceil((MAX_RECORDING_MS - elapsedMs) / 1000),
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        {state === "recording" ? (
          <button
            type="button"
            onClick={stop}
            aria-label="Aufnahme stoppen"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-rose-400 bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600"
          >
            <span
              aria-hidden
              className="relative inline-flex h-3 w-3 items-center justify-center"
            >
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/70" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
            </span>
            Stopp ({seconds}s)
          </button>
        ) : state === "requesting" ? (
          <button
            type="button"
            disabled
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-2 text-sm font-medium text-[color:var(--foreground-muted)]"
          >
            Mikrofon wird angefordert…
          </button>
        ) : state === "uploading" ? (
          <button
            type="button"
            disabled
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-2 text-sm font-medium text-[color:var(--foreground-muted)]"
          >
            <span
              aria-hidden
              className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
            />
            Transkription läuft…
          </button>
        ) : (
          <button
            type="button"
            onClick={start}
            aria-label="Idee einsprechen"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--foreground)] shadow-sm transition hover:border-[color:var(--brand-ink)]/60 hover:bg-[color:var(--surface-muted)]"
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="3" width="6" height="12" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0" />
              <path d="M12 18v3" />
              <path d="M8 21h8" />
            </svg>
            Idee einsprechen
          </button>
        )}
        {state === "recording" ? (
          <span
            className="text-xs text-[color:var(--foreground-muted)]"
            aria-live="polite"
          >
            Auto-Stopp in {remaining}s
          </span>
        ) : null}
      </div>
      {errorMessage ? (
        <div className="flex items-center gap-2">
          <p
            role="alert"
            className="rounded-lg border border-rose-300/60 bg-rose-50 px-3 py-1.5 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/50 dark:text-rose-300"
          >
            {errorMessage}
          </p>
          <button
            type="button"
            onClick={cancelError}
            className="text-xs font-medium text-[color:var(--brand-ink)] hover:underline"
          >
            OK
          </button>
        </div>
      ) : null}
    </div>
  );
}
