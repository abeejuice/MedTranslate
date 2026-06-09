import { Buffer } from "node:buffer";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function logEvent(event) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return;
  fetch(`${url}/rest/v1/api_events`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(event),
  }).catch(() => {});
}

const SONIOX_BASE = "https://api.soniox.com/v1";
const STT_MODEL = "stt-async-v4";
const POLL_INTERVAL_MS = 500;
const MAX_POLLS = 40; // 40 × 500ms = 20s max wait

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function uploadFile(audioBuffer, mimeType, apiKey) {
  const ext = mimeType.includes("wav") ? "wav"
    : (mimeType.includes("mp4") || mimeType.includes("m4a")) ? "mp4"
    : "webm";
  const filename = `audio.${ext}`;
  const boundary = "----SonioxUpload" + Date.now().toString(16);

  const fileHeader =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="file"; filename="${filename}"\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n`;

  const body = Buffer.concat([
    Buffer.from(fileHeader, "utf-8"),
    audioBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`, "utf-8"),
  ]);

  const res = await fetch(`${SONIOX_BASE}/files`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`File upload failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.id;
}

async function createTranscription(fileId, languageCode, apiKey) {
  const res = await fetch(`${SONIOX_BASE}/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: STT_MODEL,
      file_id: fileId,
      language_hints: [languageCode],
      translation: { type: "one_way", target_language: "en" },
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Transcription create failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.id;
}

async function pollUntilComplete(transcriptionId, apiKey) {
  for (let i = 0; i < MAX_POLLS; i++) {
    await sleep(POLL_INTERVAL_MS);
    const res = await fetch(`${SONIOX_BASE}/transcriptions/${transcriptionId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      throw new Error(`Poll failed (${res.status}): ${err}`);
    }

    const data = await res.json();
    if (data.status === "completed") return;
    if (data.status === "error") {
      throw new Error(`Transcription failed: ${data.error_message ?? "unknown error"}`);
    }
  }
  throw new Error("Transcription timed out after polling");
}

async function getTranscript(transcriptionId, apiKey) {
  const res = await fetch(`${SONIOX_BASE}/transcriptions/${transcriptionId}/transcript`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Get transcript failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  // tokens may have translated text; collect it if present
  const originalTokens = (data.tokens ?? []).filter(t => !t.is_audio_event);
  const original = originalTokens.map(t => t.text).join("").trim() || data.text || "";

  // Build English translation from token translations if available,
  // otherwise fall back to full text (Soniox may return translated text as the primary text
  // when translation is requested)
  const hasTokenTranslations = originalTokens.some(t => t.translated_text);
  const english = hasTokenTranslations
    ? originalTokens.map(t => t.translated_text || t.text).join("").trim()
    : data.text || "";

  return { original, english };
}

export default async function handler(req) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const apiKey = process.env.SONIOX_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "STT service not configured" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const { audioBase64, languageCode, mimeType: rawMimeType = "audio/webm", feature = null, recordingDurationMs = null } = body;
  const mimeType = rawMimeType || "audio/webm";

  if (!audioBase64 || !languageCode) {
    return new Response(
      JSON.stringify({ error: "audioBase64 and languageCode are required" }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  let audioBuffer;
  try {
    audioBuffer = Buffer.from(audioBase64, "base64");
  } catch {
    return new Response(JSON.stringify({ error: "Invalid base64 audio data" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  try {
    // Step 1: upload audio file
    const fileId = await uploadFile(audioBuffer, mimeType, apiKey);

    // Step 2: create async transcription job
    const transcriptionId = await createTranscription(fileId, languageCode, apiKey);

    // Step 3: poll until complete
    await pollUntilComplete(transcriptionId, apiKey);

    // Step 4: fetch transcript
    const { original, english } = await getTranscript(transcriptionId, apiKey);

    logEvent({
      event_type: "stt",
      feature,
      language_code: languageCode,
      audio_size_bytes: audioBuffer.length,
      recording_duration_ms: recordingDurationMs,
      success: true,
    });

    return new Response(
      JSON.stringify({ english, original }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error('[STT] failed:', err.message);
    logEvent({
      event_type: "stt",
      feature,
      language_code: languageCode,
      audio_size_bytes: audioBuffer.length,
      recording_duration_ms: recordingDurationMs,
      success: false,
      error_message: err.message,
    });
    return new Response(
      JSON.stringify({ error: "STT failed", details: err.message }),
      { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
}

export const config = {
  path: "/api/stt",
};
