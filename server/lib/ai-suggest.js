import { createGroqChatCompletion } from "./groq.js";

async function suggestNextProblem(data) {
  try {
    const allExcluded = [
      ...(data.recentTitles ?? []),
      ...(data.skipTitles ?? []),
    ];
    const excludeList = [...new Set(allExcluded)].slice(0, 30);

    const prompt = `LeetCode user "${data.username}" stats:
- Total solved: ${data.totalSolved} (Easy ${data.easySolved}, Medium ${data.mediumSolved}, Hard ${data.hardSolved})
- Current streak: ${data.streak} days
- Top topics: ${data.topTags?.join(", ") || "none yet"}
- Recent solves: ${data.recentTitles?.slice(0, 6).join(", ") || "none yet"}

IMPORTANT: Do NOT suggest any of these problems (already solved or previously suggested):
${excludeList.map((t) => `- ${t}`).join("\n")}

Suggest ONE specific real LeetCode problem to solve next that will most improve their skills. The problem MUST be different from all the ones listed above. Pick a real problem (use the canonical title and slug from leetcode.com).`;

    const tools = [
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
    const args = JSON.parse(argsText);
    return {
      ...args,
      similarityMatch: Math.round(Number(args.similarityMatch) || 0),
      successRate: Math.round(Number(args.successRate) || 0),
    };
  } catch (error) {
    console.error("AI Coach Error:", error);
    throw error;
  }
}

async function searchProblems(data) {
  try {
    const alreadySolved = data.solvedSlugs?.length
      ? `\n      IMPORTANT — The user has ALREADY solved these problems. Do NOT include any of them:\n      ${data.solvedSlugs.join(", ")}`
      : "";

    const prompt = `User is learning about "${data.topic}" in LeetCode. Find and recommend exactly 9 DIFFERENT real LeetCode problems that cover this topic: 3 Easy, 3 Medium, and 3 Hard. Pick a varied selection each time — do not always pick the most popular ones.${alreadySolved}
    
    User's current skill:
    - Total solved: ${data.totalSolved}
    - Top tags: ${data.topTags?.join(", ")}
    
    For each problem, return a JSON object with EXACTLY these fields:
    - title: exact LeetCode problem title (string)
    - titleSlug: exact URL slug used in leetcode.com/problems/<titleSlug>/ (string)
    - difficulty: "Easy", "Medium", or "Hard" (string)
    - topicTags: array of 1-3 relevant tag strings
    - successRate: estimated acceptance rate as a number 0-100 (number)
    - description: 1-2 sentence explanation of why this problem is good for learning "${data.topic}" (string)

    Focus on problems that directly teach the "${data.topic}" concept. Only return valid, real LeetCode problems that exist on leetcode.com.`;

    const json = await createGroqChatCompletion({
      messages: [
        {
          role: "system",
          content:
            "You are a LeetCode expert. Return ONLY a valid JSON array with exactly 9 real LeetCode problems. Each object MUST have: title, titleSlug, difficulty, topicTags, successRate, description. No markdown, no code blocks, just raw JSON array.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 1.0,
    });

    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("No response from AI");

    let parsed;
    try {
      let results = JSON.parse(content);
      if (!Array.isArray(results)) throw new Error("Expected array");
      parsed = results;
    } catch {
      const jsonMatch = content.match(/\[[\s\S]*?\]/);
      if (!jsonMatch) throw new Error("Could not parse AI response as JSON");
      parsed = JSON.parse(jsonMatch[0]);
    }

    const normalised = parsed.map((p, i) => ({
      questionId: p.questionId ?? p.frontendId ?? i + 1,
      title: String(p.title ?? ""),
      titleSlug: String(p.titleSlug ?? p.slug ?? ""),
      difficulty: p.difficulty,
      topicTags: Array.isArray(p.topicTags) ? p.topicTags.map(String) : [],
      successRate: Number(p.successRate ?? p.acRate ?? 50),
      description: String(p.description ?? ""),
    }));

    const solved = new Set((data.solvedSlugs ?? []).map((s) => s.toLowerCase()));
    return normalised
      .filter((p) => p.titleSlug && !solved.has(p.titleSlug.toLowerCase()))
      .slice(0, 9);
  } catch (error) {
    console.error("AI Mode Error:", error);
    throw error;
  }
}

async function getSolution(data) {
  try {
    const prompt = `Provide two solutions for the LeetCode problem "${data.title}" (leetcode.com/problems/${data.slug}/) in ${data.language.toUpperCase()}.

Return a JSON object with exactly these two fields:
- "bruteForce": a string containing the complete brute-force solution code
- "optimized": a string containing the complete optimized solution code

CRITICAL FORMATTING RULES:
- Each line of code MUST be separated by a real newline character (\\n) inside the JSON string.
- Use proper indentation (spaces, not tabs).
- Include helpful comments explaining the approach.
- Do NOT put all code on one line.
- The code must be well-formatted, readable, and production-ready.

Example of correct JSON format:
{"bruteForce": "import java.util.*;\\n\\nclass Solution {\\n    public int[] solve(int[] nums) {\\n        // brute force approach\\n        return nums;\\n    }\\n}", "optimized": "..."}`;

    const json = await createGroqChatCompletion({
      messages: [
        {
          role: "system",
          content:
            'You are an expert LeetCode solutions provider. Return ONLY a valid JSON object with "bruteForce" and "optimized" fields. Each field is a string containing properly formatted, multi-line code. Use \\\\n for newlines inside JSON strings. No markdown, no code blocks, no extra text — just raw JSON.',
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    });

    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("No response from AI");

    /**
     * Robustly extract JSON with bruteForce / optimized fields from raw LLM text.
     * LLMs frequently produce malformed JSON (unescaped newlines, embedded quotes
     * inside code strings, trailing commas, markdown wrappers, etc.).
     * We use a layered strategy: try progressively looser parsing until one works.
     */
    function extractJsonObject(raw) {
      // Strip markdown code fences if present
      let text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

      // 1. Try direct parse first (fastest path)
      try {
        const direct = JSON.parse(text);
        if (direct && typeof direct.bruteForce === "string" && typeof direct.optimized === "string") {
          return direct;
        }
      } catch { /* fall through */ }

      // 2. Extract the outermost { ... } block (greedy)
      const objMatch = text.match(/\{[\s\S]*\}/);
      if (objMatch) text = objMatch[0];

      // 3. Sanitize: walk char-by-char with awareness of JSON structure,
      //    escaping problematic characters inside string values.
      try {
        const sanitized = sanitizeJsonString(text);
        const parsed = JSON.parse(sanitized);
        if (parsed && typeof parsed.bruteForce === "string" && typeof parsed.optimized === "string") {
          return parsed;
        }
      } catch { /* fall through */ }

      // 4. Fallback: extract the two fields individually with regex.
      //    Match "bruteForce" : "..." or "optimized" : "..." greedily.
      const bf = extractField(text, "bruteForce");
      const opt = extractField(text, "optimized");
      if (bf !== null && opt !== null) {
        return { bruteForce: bf, optimized: opt };
      }

      throw new Error("Could not parse AI response as JSON");
    }

    /**
     * Walk through a JSON string char-by-char and escape control characters
     * that appear inside quoted strings.  Handles the common LLM failure mode
     * of literal newlines / tabs inside JSON string values.
     */
    function sanitizeJsonString(jsonStr) {
      let result = "";
      let i = 0;

      while (i < jsonStr.length) {
        const ch = jsonStr[i];

        if (ch !== '"') {
          // Outside of a string — pass through
          result += ch;
          i++;
          continue;
        }

        // Start of a JSON string
        result += '"';
        i++;

        while (i < jsonStr.length) {
          const c = jsonStr[i];

          // Handle escape sequences (already escaped by the LLM)
          if (c === "\\") {
            if (i + 1 < jsonStr.length) {
              const next = jsonStr[i + 1];
              // Valid JSON escape characters
              if ('"\\\/bfnrtu'.includes(next)) {
                result += c + next;
                i += 2;
                continue;
              }
              // Invalid escape — keep the backslash escaped
              result += "\\\\";
              i++;
              continue;
            }
            result += "\\\\";
            i++;
            continue;
          }

          // A quote character — decide if it closes the string or is embedded
          if (c === '"') {
            // Look ahead: if the next non-whitespace is a structural JSON char
            // ( : , } ] ) or end-of-string, this quote closes the string.
            const rest = jsonStr.slice(i + 1).trimStart();
            if (rest.length === 0 || /^[,:}\]]/.test(rest)) {
              result += '"';
              i++;
              break; // end of this JSON string value
            }
            // Otherwise it's an embedded quote inside the string value — escape it
            result += '\\"';
            i++;
            continue;
          }

          // Escape raw control characters
          if (c === "\n") { result += "\\n"; }
          else if (c === "\r") { result += "\\r"; }
          else if (c === "\t") { result += "\\t"; }
          else if (c === "\b") { result += "\\b"; }
          else if (c === "\f") { result += "\\f"; }
          else if (c.charCodeAt(0) < 32) {
            result += "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0");
          }
          else { result += c; }

          i++;
        }
      }

      // Strip trailing commas before } (another common LLM mistake)
      result = result.replace(/,\s*}/g, "}");

      return result;
    }

    /**
     * Regex-based fallback: extract a single field value from raw JSON-ish text.
     * Handles multi-line values by finding the field key, then capturing everything
     * up to the next top-level field or closing brace.
     */
    function extractField(text, fieldName) {
      // Match "fieldName" : "..." where the value might span many lines
      // Use a pattern that finds the key, then captures up to the next
      // unescaped quote that's followed by a structural char.
      const keyPattern = new RegExp(`"${fieldName}"\\s*:\\s*"`);
      const keyMatch = keyPattern.exec(text);
      if (!keyMatch) return null;

      const startIdx = keyMatch.index + keyMatch[0].length;
      let value = "";
      let j = startIdx;
      while (j < text.length) {
        const c = text[j];
        if (c === "\\") {
          value += c;
          j++;
          if (j < text.length) {
            value += text[j];
            j++;
          }
          continue;
        }
        if (c === '"') {
          // Check if this closes the field
          const after = text.slice(j + 1).trimStart();
          if (after.length === 0 || /^[,}\]]/.test(after)) {
            break;
          }
          // Embedded quote
          value += '\\"';
          j++;
          continue;
        }
        if (c === "\n") { value += "\\n"; }
        else if (c === "\r") { value += "\\r"; }
        else if (c === "\t") { value += "\\t"; }
        else { value += c; }
        j++;
      }

      try {
        return JSON.parse(`"${value}"`);
      } catch {
        return value;
      }
    }

    let parsed;
    parsed = extractJsonObject(content);

    const normCode = (s) =>
      s
        .replace(/\\n/g, "\n")
        .replace(/\\t/g, "  ")
        .replace(/\\r/g, "")
        .trim();

    return {
      bruteForce: normCode(String(parsed.bruteForce || "")),
      optimized: normCode(String(parsed.optimized || "")),
    };
  } catch (error) {
    console.error("Solution Fetch Error:", error);
    throw error;
  }
}

export { suggestNextProblem, searchProblems, getSolution };
