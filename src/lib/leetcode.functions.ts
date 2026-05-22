import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const LC_ENDPOINT = "https://leetcode.com/graphql";

const usernameSchema = z.object({
  username: z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/),
});

async function lcQuery(query: string, variables: Record<string, unknown>) {
  const res = await fetch(LC_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      Referer: "https://leetcode.com",
      Origin: "https://leetcode.com",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`LeetCode ${res.status}`);
  const json = (await res.json()) as { data?: unknown; errors?: unknown };
  if (!json.data) throw new Error("LeetCode returned no data");
  return json.data as Record<string, unknown>;
}

export interface LCProfile {
  username: string;
  realName: string | null;
  avatar: string | null;
  ranking: number | null;
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  totalQuestions: { easy: number; medium: number; hard: number; all: number };
  acceptanceRate: number | null;
  reputation: number | null;
  streak: number;
  totalActiveDays: number;
  submissionCalendar: Record<string, number>;
  recent: Array<{ title: string; titleSlug: string; timestamp: number; statusDisplay: string; lang: string }>;
  topTags: Array<{ tagName: string; problemsSolved: number }>;
}

function computeStreak(cal: Record<string, number>): number {
  if (!cal || Object.keys(cal).length === 0) return 0;
  const days = new Set(
    Object.keys(cal).map((s) => {
      const d = new Date(Number(s) * 1000);
      return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
    }),
  );
  let streak = 0;
  const today = new Date();
  // allow starting from today or yesterday
  for (let i = 0; i < 400; i++) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const k = `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
    if (days.has(k)) streak++;
    else if (i === 0) continue; // give grace for today
    else break;
  }
  return streak;
}

export const fetchLeetCodeProfile = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => usernameSchema.parse(d))
  .handler(async ({ data }): Promise<LCProfile> => {
    const { username } = data;

    const profileQuery = `
      query userPublicProfile($username: String!) {
        matchedUser(username: $username) {
          username
          profile { realName userAvatar ranking reputation }
          submitStats {
            acSubmissionNum { difficulty count }
          }
          tagProblemCounts {
            advanced { tagName problemsSolved }
            intermediate { tagName problemsSolved }
            fundamental { tagName problemsSolved }
          }
        }
        allQuestionsCount { difficulty count }
        userContestRanking(username: $username) { rating globalRanking }
      }`;

    const recentQuery = `
      query recentAcSubmissions($username: String!, $limit: Int!) {
        recentAcSubmissionList(username: $username, limit: $limit) {
          title titleSlug timestamp
        }
      }`;

    const calQuery = `
      query userProfileCalendar($username: String!) {
        matchedUser(username: $username) {
          userCalendar { activeYears streak totalActiveDays submissionCalendar }
        }
      }`;

    const [p, r, c] = await Promise.all([
      lcQuery(profileQuery, { username }),
      lcQuery(recentQuery, { username, limit: 10 }),
      lcQuery(calQuery, { username }),
    ]);

    const mu = p.matchedUser as Record<string, any> | null;
    if (!mu) throw new Error(`User "${username}" not found on LeetCode`);

    const ac = (mu.submitStats?.acSubmissionNum ?? []) as Array<{ difficulty: string; count: number }>;
    const getAc = (d: string) => ac.find((x) => x.difficulty === d)?.count ?? 0;
    const allQ = (p.allQuestionsCount ?? []) as Array<{ difficulty: string; count: number }>;
    const getQ = (d: string) => allQ.find((x) => x.difficulty === d)?.count ?? 0;

    const calMu = (c.matchedUser as Record<string, any> | null)?.userCalendar ?? {};
    let cal: Record<string, number> = {};
    if (calMu.submissionCalendar) {
      try {
        cal = JSON.parse(calMu.submissionCalendar);
      } catch {
        cal = {};
      }
    }

    const tagProblemCounts = mu.tagProblemCounts ?? {};
    const tags = [
      ...(tagProblemCounts.advanced ?? []),
      ...(tagProblemCounts.intermediate ?? []),
      ...(tagProblemCounts.fundamental ?? []),
    ] as Array<{ tagName: string; problemsSolved: number }>;
    const topTags = tags.sort((a, b) => b.problemsSolved - a.problemsSolved).slice(0, 8);

    const recentList = ((r.recentAcSubmissionList ?? []) as Array<any>).map((s) => ({
      title: String(s.title),
      titleSlug: String(s.titleSlug),
      timestamp: Number(s.timestamp),
      statusDisplay: "Accepted",
      lang: "",
    }));

    const totalSolved = getAc("All");

    return {
      username: String(mu.username),
      realName: mu.profile?.realName ?? null,
      avatar: mu.profile?.userAvatar ?? null,
      ranking: mu.profile?.ranking ?? null,
      totalSolved,
      easySolved: getAc("Easy"),
      mediumSolved: getAc("Medium"),
      hardSolved: getAc("Hard"),
      totalQuestions: {
        easy: getQ("Easy"),
        medium: getQ("Medium"),
        hard: getQ("Hard"),
        all: getQ("All"),
      },
      acceptanceRate: null,
      reputation: mu.profile?.reputation ?? null,
      streak: Number(calMu.streak ?? computeStreak(cal)),
      totalActiveDays: Number(calMu.totalActiveDays ?? 0),
      submissionCalendar: cal,
      recent: recentList,
      topTags,
    };
  });