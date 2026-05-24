import { Buffer } from "node:buffer";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Build a multipart/form-data body manually from fields and a file buffer.
 * Returns { body: Buffer, boundary: string }
 */
function buildMultipart(fields, fileField) {
  const boundary = "----MedTranslateBoundary" + Date.now().toString(16);
  const parts = [];

  for (const [name, value] of Object.entries(fields)) {
    parts.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`
    );
  }

  // File part
  const { name, buffer, mimeType, filename } = fileField;
  const fileHeader =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="${name}"; filename="${filename}"\r\n` +
    `Content-Type: ${mimeType}\r\n\r\n`;

  parts.push(fileHeader);

  const textParts = Buffer.concat(parts.map((p) => Buffer.from(p, "utf-8")));
  const closing = Buffer.from(`\r\n--${boundary}--\r\n`, "utf-8");

  return {
    body: Buffer.concat([textParts, buffer, closing]),
    boundary,
  };
}

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

  const apiKey = process.env.SONIOX_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "STT service not configured" }),
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

  const { audioBase64, languageCode, mimeType = "audio/webm" } = body;

  if (!audioBase64 || !languageCode) {
    return new Response(
      JSON.stringify({ error: "audioBase64 and languageCode are required" }),
      {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }

  let audioBuffer;
  try {
    audioBuffer = Buffer.from(audioBase64, "base64");
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid base64 audio data" }),
      {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }

  // Determine file extension from mimeType
  const ext = mimeType.includes("wav") ? "wav" : "webm";
  const filename = `audio.${ext}`;

  const { body: multipartBody, boundary } = buildMultipart(
    {
      model: "stt-rt-v3",
      language_hints: languageCode,
      translation_target_language: "en",
    },
    {
      name: "file",
      buffer: audioBuffer,
      mimeType,
      filename,
    }
  );

  let sionoxResponse;
  try {
    sionoxResponse = await fetch("https://api.soniox.com/v1/transcribe", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body: multipartBody,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "STT request failed", details: err.message }),
      {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }

  if (!sionoxResponse.ok) {
    let details = sionoxResponse.statusText;
    try {
      const errJson = await sionoxResponse.json();
      details = JSON.stringify(errJson);
    } catch {
      // ignore
    }
    return new Response(
      JSON.stringify({ error: "STT failed", details }),
      {
        status: sionoxResponse.status,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }

  let sionoxData;
  try {
    sionoxData = await sionoxResponse.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "STT failed", details: "Invalid response from STT service" }),
      {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }

  return new Response(
    JSON.stringify({
      english: sionoxData.translation ?? sionoxData.text ?? "",
      original: sionoxData.text ?? "",
    }),
    {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    }
  );
}

export const config = {
  path: "/api/stt",
};
