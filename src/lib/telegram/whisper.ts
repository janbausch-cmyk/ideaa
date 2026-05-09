// Voice transcription via OpenAI Whisper (model whisper-1).
// We hit the audio/transcriptions endpoint with a multipart upload of the
// file bytes Telegram gave us. Returns the transcript string.
//
// Docs: https://platform.openai.com/docs/api-reference/audio/createTranscription

const OPENAI_API = "https://api.openai.com";

export class WhisperError extends Error {
  constructor(
    public readonly status: number,
    public readonly bodyText: string,
  ) {
    super(`Whisper failed (${status}): ${bodyText.slice(0, 240)}`);
  }
}

function apiKey(): string {
  const k = process.env.OPENAI_API_KEY;
  if (!k) throw new Error("OPENAI_API_KEY is not set");
  return k;
}

/**
 * Transcribe a voice file already downloaded from Telegram.
 *
 * @param audio raw audio bytes (typically OGG/Opus from Telegram voice).
 * @param filename suggested filename for the multipart upload (extension
 *   tells Whisper how to decode; Telegram voice → .ogg).
 * @param language ISO-639-1 hint, e.g. "de"; pass undefined for auto-detect.
 */
export async function transcribeAudio(
  audio: ArrayBuffer,
  filename = "voice.ogg",
  language?: string,
): Promise<string> {
  const form = new FormData();
  form.set("file", new Blob([audio]), filename);
  form.set("model", "whisper-1");
  if (language) form.set("language", language);
  // response_format=text returns the transcript verbatim, no JSON to parse.
  form.set("response_format", "text");

  const res = await fetch(`${OPENAI_API}/v1/audio/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
    },
    body: form,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new WhisperError(res.status, await res.text());
  }
  return (await res.text()).trim();
}
