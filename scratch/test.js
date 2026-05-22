const key = 'AIzaSyCpofjVs-MFFTHYO3OuxJUZZgCPCwO-1rk';
fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent', {
  method: 'POST',
  headers: {
    'x-goog-api-key': key,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    systemInstruction: { parts: [{ text: 'You are an elite LeetCode coach. Recommend the single best next problem. Always call the suggest_problem tool with a real LeetCode problem.' }] },
    contents: [{ role: 'user', parts: [{ text: 'Suggest a leetcode problem.' }] }],
    tools: [{
      functionDeclarations: [{
        name: 'suggest_problem',
        description: 'Suggest one real LeetCode problem to solve next.',
        parameters: {
          type: 'OBJECT',
          properties: {
            title: { type: 'STRING', description: "Exact LeetCode problem title, e.g. 'Two Sum'" },
            slug: { type: "STRING", description: "URL slug, e.g. 'two-sum'" },
            difficulty: { type: "STRING", description: "Easy, Medium, or Hard" },
            topic: { type: "STRING", description: "Primary topic / pattern" },
            why: { type: "STRING", description: "1-2 sentence rationale tied to user stats" },
            similarityMatch: { type: "NUMBER", description: "0-100 match score" },
            successRate: { type: "NUMBER", description: "Estimated user success rate 0-100" }
          },
          required: ["title", "slug", "difficulty", "topic", "why", "similarityMatch", "successRate"]
        }
      }]
    }],
    toolConfig: { functionCallingConfig: { mode: 'ANY', allowedFunctionNames: ['suggest_problem'] } }
  })
}).then(async r => {
  if (!r.ok) {
    console.error(await r.text());
  } else {
    console.log(JSON.stringify(await r.json(), null, 2));
  }
}).catch(console.error);
