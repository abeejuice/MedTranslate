const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SARVAM_TRANSLATE_URL = "https://api.sarvam.ai/translate";
const SARVAM_TRANSLITERATE_URL = "https://api.sarvam.ai/transliterate";

const LANGUAGE_MAPPING = {
  hi: "hi-IN",
  te: "te-IN",
  ta: "ta-IN",
  ml: "ml-IN",
  bn: "bn-IN",
  mr: "mr-IN",
  ne: "ne-NP",
};

function getSarvamLangCode(code) {
  return LANGUAGE_MAPPING[code] || (code.includes("-") ? code : `${code}-IN`);
}

async function translateToNative(text, targetLang, apiKey) {
  const sarvamLang = getSarvamLangCode(targetLang);
  const res = await fetch(SARVAM_TRANSLATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-subscription-key": apiKey,
    },
    body: JSON.stringify({
      input: text,
      source_language_code: "en-IN",
      target_language_code: sarvamLang,
      output_script: "fully-native",
      model: "mayura:v1",
      mode: "formal",
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Sarvam translate failed (${res.status}): ${err}`);
  }
  const data = await res.json();
  return data.translated_text ?? "";
}

async function transliterateToRoman(nativeText, sourceLang, apiKey) {
  const sarvamLang = getSarvamLangCode(sourceLang);
  const res = await fetch(SARVAM_TRANSLITERATE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-subscription-key": apiKey,
    },
    body: JSON.stringify({
      input: nativeText,
      source_language_code: sarvamLang,
      target_language_code: "en-IN",
      spoken_form: true,
    }),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Sarvam transliterate failed (${res.status}): ${err}`);
  }
  const data = await res.json();
  return data.transliterated_text ?? "";
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
    return new Response(
      JSON.stringify({ error: "Translation service not configured" }),
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

  const { questions, targetLang } = body;

  if (!questions || !targetLang) {
    return new Response(
      JSON.stringify({ error: "questions and targetLang are required" }),
      {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }

  if (!Array.isArray(questions) || questions.length === 0) {
    return new Response(
      JSON.stringify({ error: "questions must be a non-empty array" }),
      {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }

  if (questions.length > 30) {
    return new Response(
      JSON.stringify({ error: "questions array must not exceed 30 items" }),
      {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }

  let nativeTexts;
  try {
    // Round 1: translate all questions to native script in parallel
    nativeTexts = await Promise.all(
      questions.map((q) => translateToNative(q, targetLang, apiKey))
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Translation failed", details: err.message }),
      {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }

  let romanisedTexts;
  try {
    // Round 2: transliterate all native results to roman in parallel
    romanisedTexts = await Promise.all(
      nativeTexts.map((t) => transliterateToRoman(t, targetLang, apiKey))
    );
  } catch (err) {
    // Transliteration failure is non-fatal — fall back to empty strings
    romanisedTexts = nativeTexts.map(() => "");
  }

  const translations = nativeTexts.map((text, i) => ({
    text,                   // Backward compatibility (if any API caller expects 'text')
    native: text,           // Maps directly to c.updateTranslation(..., t.native) in session.js
    romanised: romanisedTexts[i] ?? "",
  }));

  return new Response(JSON.stringify({ translations }), {
    status: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

export const config = {
  path: "/api/translate",
};
