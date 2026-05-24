const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export default async function handler(req) {
  // Handle CORS preflight
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
    return new Response(
      JSON.stringify({ error: "TTS service not configured" }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
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

  const { text, languageCode } = body;

  if (!text || !languageCode) {
    return new Response(
      JSON.stringify({ error: "text and languageCode are required" }),
      {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }

  let sarvamResponse;
  try {
    sarvamResponse = await fetch("https://api.sarvam.ai/text-to-speech", {
      method: "POST",
      headers: {
        "api-subscription-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: [text],
        target_language_code: languageCode,
        speaker: "meera",
        model: "bulbul:v2",
        enable_preprocessing: true,
      }),
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "TTS failed", details: err.message }),
      {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }

  if (!sarvamResponse.ok) {
    let details = sarvamResponse.statusText;
    try {
      const errJson = await sarvamResponse.json();
      details = JSON.stringify(errJson);
    } catch {
      // ignore parse error, use statusText
    }
    return new Response(
      JSON.stringify({ error: "TTS failed", details }),
      {
        status: sarvamResponse.status,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }

  let sarvamData;
  try {
    sarvamData = await sarvamResponse.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "TTS failed", details: "Invalid response from TTS service" }),
      {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }

  const audioBase64 = sarvamData.audios?.[0];
  if (!audioBase64) {
    return new Response(
      JSON.stringify({ error: "TTS failed", details: "No audio in response" }),
      {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }

  return new Response(
    JSON.stringify({ audio: audioBase64, format: "wav" }),
    {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    }
  );
}

export const config = {
  path: "/api/tts",
};
