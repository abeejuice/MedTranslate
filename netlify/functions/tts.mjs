const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Set SVARA_TTS_URL env var when self-hosting Svara (docker run kenpath/svara-tts)
// Leave unset to skip Svara and fall through to browser speechSynthesis
const SVARA_URL = process.env.SVARA_TTS_URL || null;
const SVARA_VOICE_MAP = {
  "hi-IN": "hi_female", "te-IN": "te_female", "ta-IN": "ta_female",
  "ml-IN": "ml_female", "kn-IN": "kn_female", "bn-IN": "bn_female",
  "mr-IN": "mr_female", "ne-NP": "ne_female",
};

async function trySarvam(text, languageCode, apiKey) {
  const res = await fetch("https://api.sarvam.ai/text-to-speech", {
    method: "POST",
    headers: { "api-subscription-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      inputs: [text],
      target_language_code: languageCode,
      speaker: "anushka",
      model: "bulbul:v2",
      enable_preprocessing: true,
    }),
  });
  if (!res.ok) throw new Error("Sarvam " + res.status);
  const data = await res.json();
  const audio = data.audios?.[0];
  if (!audio) throw new Error("Sarvam: empty audio response");
  return audio;
}

async function trySvara(text, languageCode) {
  const voice = SVARA_VOICE_MAP[languageCode] || "hi_female";
  const res = await fetch(SVARA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: text, voice, response_format: "wav" }),
  });
  if (!res.ok) throw new Error("Svara " + res.status);
  const buf = await res.arrayBuffer();
  return Buffer.from(buf).toString("base64");
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

  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "TTS service not configured" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
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

  const { text, languageCode } = body;
  if (!text || !languageCode) {
    return new Response(JSON.stringify({ error: "text and languageCode are required" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  let audioBase64;
  try {
    audioBase64 = await trySarvam(text, languageCode, apiKey);
  } catch (sarvamErr) {
    if (SVARA_URL) {
      try {
        audioBase64 = await trySvara(text, languageCode);
      } catch (svaraErr) {
        return new Response(
          JSON.stringify({ error: "TTS unavailable", details: svaraErr.message }),
          { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ error: "TTS unavailable", details: sarvamErr.message }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }
  }

  return new Response(
    JSON.stringify({ audio: audioBase64, format: "wav" }),
    { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
  );
}

export const config = {
  path: "/api/tts",
};
