import Anthropic from "@anthropic-ai/sdk";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are a medical translation assistant. Translate English medical history-taking questions into the specified Indian language. Return ONLY a JSON array — no explanation, no markdown, no code blocks. Each element must have exactly two fields: "text" (the question in the target language's native script) and "romanised" (a phonetic romanisation that an English speaker could attempt to pronounce). Use simple, clear language appropriate for speaking to a patient — not clinical jargon. Maintain the question format (end with question mark).`;

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

  const apiKey = process.env.ANTHROPIC_API_KEY;
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

  const { questions, targetLang, targetLangLabel } = body;

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

  const langLabel = targetLangLabel || targetLang;
  const userMessage = `Translate these medical questions into ${langLabel} (${targetLang}):

${JSON.stringify(questions, null, 2)}

Return a JSON array with ${questions.length} elements, each with "text" and "romanised" fields.`;

  let claudeResponse;
  try {
    const client = new Anthropic({ apiKey });
    claudeResponse = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: "Translation request failed",
        details: err.message,
      }),
      {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }

  const rawText = claudeResponse.content?.[0]?.text ?? "";

  let translations;
  try {
    // Strip any accidental markdown code fences if Claude wraps anyway
    const cleaned = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    translations = JSON.parse(cleaned);
  } catch {
    return new Response(
      JSON.stringify({
        error: "Translation parsing failed",
        details: "Claude returned non-JSON response",
        raw: rawText.slice(0, 500),
      }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }

  if (!Array.isArray(translations)) {
    return new Response(
      JSON.stringify({
        error: "Translation parsing failed",
        details: "Expected a JSON array",
      }),
      {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      }
    );
  }

  return new Response(JSON.stringify({ translations }), {
    status: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

export const config = {
  path: "/api/translate",
};
