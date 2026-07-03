import { transcribeAudio, WhisperError } from "@/lib/telegram/whisper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB — Whisper hard limit is 25 MB.

export async function POST(request: Request): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "invalid-form" }, { status: 400 });
  }

  const file = form.get("audio");
  if (!(file instanceof Blob)) {
    return Response.json({ error: "missing-audio" }, { status: 400 });
  }
  if (file.size === 0) {
    return Response.json({ error: "empty-audio" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json({ error: "audio-too-large" }, { status: 413 });
  }

  const rawFilename = form.get("filename");
  const filename =
    typeof rawFilename === "string" && rawFilename.length > 0
      ? rawFilename.slice(0, 120)
      : "recording.webm";

  const rawLanguage = form.get("language");
  const language =
    typeof rawLanguage === "string" && /^[a-z]{2}$/i.test(rawLanguage)
      ? rawLanguage.toLowerCase()
      : "de";

  try {
    const buf = await file.arrayBuffer();
    const text = await transcribeAudio(buf, filename, language);
    return Response.json({ text });
  } catch (err) {
    if (err instanceof WhisperError) {
      return Response.json(
        { error: "whisper-failed", status: err.status },
        { status: 502 },
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("OPENAI_API_KEY")) {
      return Response.json({ error: "not-configured" }, { status: 503 });
    }
    return Response.json({ error: "server-error" }, { status: 500 });
  }
}
