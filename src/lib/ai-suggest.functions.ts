import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const inputSchema = z.object({
  username: z.string().min(1).max(64),
  totalSolved: z.number().int().nonnegative(),
  easySolved: z.number().int().nonnegative(),
  mediumSolved: z.number().int().nonnegative(),
  hardSolved: z.number().int().nonnegative(),
  streak: z.number().int().nonnegative(),
  recentTitles: z.array(z.string()).max(10),
  topTags: z.array(z.string()).max(8),
});

export interface AISuggestion {
  title: string;
  slug: string;
  difficulty: "Easy" | "Medium" | "Hard";
  topic: string;
  why: string;
  similarityMatch: number;
  successRate: number;
}

export const suggestNextProblem = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data }): Promise<AISuggestion> => {
    try {
      const key = process.env.GEMINI_API_KEY;
      if (!key) throw new Error("API_KEY not configured");

      const prompt = `LeetCode user "${data.username}" stats:
- Total solved: ${data.totalSolved} (Easy ${data.easySolved}, Medium ${data.mediumSolved}, Hard ${data.hardSolved})
- Current streak: ${data.streak} days
- Top topics: ${data.topTags?.join(", ") || "none yet"}
- Recent solves: ${data.recentTitles?.slice(0, 6).join(", ") || "none yet"}

Suggest ONE specific real LeetCode problem to solve next that will most improve their skills. Pick a real problem (use the canonical title and slug from leetcode.com).`;

      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent", {
        method: "POST",
        headers: {
          "x-goog-api-key": key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: "You are an elite LeetCode coach. Recommend the single best next problem. Always call the suggest_problem tool with a real LeetCode problem." }]
          },
          contents: [
            { role: "user", parts: [{ text: prompt }] }
          ],
          tools: [
            {
              functionDeclarations: [
                {
                  name: "suggest_problem",
                  description: "Suggest one real LeetCode problem to solve next.",
                  parameters: {
                    type: "OBJECT",
                    properties: {
                      title: { type: "STRING", description: "Exact LeetCode problem title, e.g. 'Two Sum'" },
                      slug: { type: "STRING", description: "URL slug, e.g. 'two-sum'" },
                      difficulty: { type: "STRING", description: "Easy, Medium, or Hard" },
                      topic: { type: "STRING", description: "Primary topic / pattern" },
                      why: { type: "STRING", description: "1-2 sentence rationale tied to user stats" },
                      similarityMatch: { type: "NUMBER", description: "0-100 match score" },
                      successRate: { type: "NUMBER", description: "Estimated user success rate 0-100" },
                    },
                    required: ["title", "slug", "difficulty", "topic", "why", "similarityMatch", "successRate"],
                  },
                },
              ],
            },
          ],
          toolConfig: {
            functionCallingConfig: {
              mode: "ANY",
              allowedFunctionNames: ["suggest_problem"]
            }
          }
        }),
      });

      if (res.status === 429) throw new Error("AI rate limit. Try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted. Add credits in Settings → Workspace → Usage.");
      if (!res.ok) {
        const errText = await res.text();
        console.error("Gemini Error Body:", errText);
        throw new Error(`AI gateway ${res.status}: ${errText}`);
      }

      const json = (await res.json()) as any;
      const call = json.candidates?.[0]?.content?.parts?.[0]?.functionCall;
      if (!call?.args) throw new Error("AI returned no suggestion");
      const args = call.args as AISuggestion;
      return {
        ...args,
        similarityMatch: Math.round(Number(args.similarityMatch) || 0),
        successRate: Math.round(Number(args.successRate) || 0),
      };
    } catch (error) {
      console.error("AI Coach Error:", error);
      throw error;
    }
  });