const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_TYPES = new Set(["session_start", "session_end"]);

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

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const { event_type, feature, language_code, template_id, session_duration_seconds, qa_count } = body;

  if (!ALLOWED_TYPES.has(event_type)) {
    return new Response(JSON.stringify({ error: "Invalid event_type" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (supabaseUrl && supabaseKey) {
    fetch(`${supabaseUrl}/rest/v1/api_events`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        event_type,
        feature: feature || null,
        language_code: language_code || null,
        template_id: template_id || null,
        session_duration_seconds: session_duration_seconds || null,
        qa_count: qa_count || null,
        success: true,
      }),
    }).catch(() => {});
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

export const config = {
  path: "/api/log-event",
};
