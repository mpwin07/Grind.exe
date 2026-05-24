import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { createGroqChatCompletion, type GroqTool } from "@/lib/groq.functions";

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

type RawAISuggestion = Omit<AISuggestion, "similarityMatch" | "successRate"> & {
  similarityMatch: number | string;
  successRate: number | string;
};

export const suggestNextProblem = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => inputSchema.parse(d))
  .handler(async ({ data }): Promise<AISuggestion> => {
    try {
      const prompt = `LeetCode user "${data.username}" stats:
- Total solved: ${data.totalSolved} (Easy ${data.easySolved}, Medium ${data.mediumSolved}, Hard ${data.hardSolved})
- Current streak: ${data.streak} days
- Top topics: ${data.topTags?.join(", ") || "none yet"}
- Recent solves: ${data.recentTitles?.slice(0, 6).join(", ") || "none yet"}

Suggest ONE specific real LeetCode problem to solve next that will most improve their skills. Pick a real problem (use the canonical title and slug from leetcode.com).`;

      const tools: GroqTool[] = [
        {
          type: "function",
          function: {
            name: "suggest_problem",
            description: "Suggest one real LeetCode problem to solve next.",
            parameters: {
              type: "object",
              properties: {
                title: {
                  type: "string",
                  description: "Exact LeetCode problem title, e.g. 'Two Sum'",
                },
                slug: {
                  type: "string",
                  description: "URL slug, e.g. 'two-sum'",
                },
                difficulty: {
                  type: "string",
                  enum: ["Easy", "Medium", "Hard"],
                  description: "Easy, Medium, or Hard",
                },
                topic: {
                  type: "string",
                  description: "Primary topic / pattern",
                },
                why: {
                  type: "string",
                  description: "1-2 sentence rationale tied to user stats",
                },
                similarityMatch: {
                  type: "string",
                  description: "0-100 match score as a numeric string without a percent sign",
                },
                successRate: {
                  type: "string",
                  description: "Estimated user success rate 0-100 as a numeric string without a percent sign",
                },
              },
              required: [
                "title",
                "slug",
                "difficulty",
                "topic",
                "why",
                "similarityMatch",
                "successRate",
              ],
            },
          },
        },
      ];

      const json = await createGroqChatCompletion({
        messages: [
          {
            role: "system",
            content:
              "You are an elite LeetCode coach. Recommend the single best next problem. Always call the suggest_problem tool with a real LeetCode problem.",
          },
          { role: "user", content: prompt },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "suggest_problem" } },
        temperature: 0.7,
      });

      const message = json.choices?.[0]?.message;
      const argsText = message?.tool_calls?.[0]?.function?.arguments ?? message?.content;
      if (!argsText) throw new Error("AI returned no suggestion");
      const args = JSON.parse(argsText) as RawAISuggestion;
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
