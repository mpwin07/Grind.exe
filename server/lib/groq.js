const GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";

async function readGroqError(res) {
  const errText = await res.text();
  if (res.status === 429) throw new Error("AI rate limit. Try again in a moment.");
  if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Groq.");
  if (res.status === 401 || res.status === 403) {
    throw new Error("Groq API key is invalid or does not have access.");
  }
  console.error("Groq Error Body:", errText);
  throw new Error(`Groq API error ${res.status}: ${errText}`);
}

async function createGroqChatCompletion(options) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY not configured");

  const res = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL ?? DEFAULT_GROQ_MODEL,
      ...options,
    }),
  });

  if (!res.ok) await readGroqError(res);
  return await res.json();
}

function getGroqApiStatus() {
  return process.env.GROQ_API_KEY ? "configured" : "missing";
}

export { createGroqChatCompletion, getGroqApiStatus };
