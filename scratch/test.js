const key = process.env.GROQ_API_KEY;

if (!key) {
  throw new Error("GROQ_API_KEY is not configured");
}

fetch("https://api.groq.com/openai/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
    messages: [
      {
        role: "system",
        content: "You are an elite LeetCode coach. Return one real LeetCode problem as JSON.",
      },
      {
        role: "user",
        content: "Suggest a leetcode problem.",
      },
    ],
    temperature: 0.7,
  }),
})
  .then(async (r) => {
    if (!r.ok) {
      console.error(await r.text());
    } else {
      console.log(JSON.stringify(await r.json(), null, 2));
    }
  })
  .catch(console.error);
