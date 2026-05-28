const LC_ENDPOINT = "https://leetcode.com/graphql";

async function lcQuery(query, variables) {
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
  const json = await res.json();
  if (!json.data) throw new Error("LeetCode returned no data");
  return json.data;
}

function computeStreak(cal) {
  if (!cal || Object.keys(cal).length === 0) return 0;
  const days = new Set(
    Object.keys(cal).map((s) => {
      const ms = Number(s) * 1000;
      const d = new Date(ms);
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    })
  );
  let streak = 0;
  const nowUtcMs = Date.now();
  for (let i = 0; i < 400; i++) {
    const dayMs = nowUtcMs - i * 86400_000;
    const d = new Date(dayMs);
    const k = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    if (days.has(k)) {
      streak++;
    } else if (i === 0) {
      continue;
    } else {
      break;
    }
  }
  return streak;
}

async function fetchLeetCodeProfile(username) {
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

  const mu = p.matchedUser;
  if (!mu) throw new Error(`User "${username}" not found on LeetCode`);

  const ac = mu.submitStats?.acSubmissionNum ?? [];
  const getAc = (d) => ac.find((x) => x.difficulty === d)?.count ?? 0;
  const allQ = p.allQuestionsCount ?? [];
  const getQ = (d) => allQ.find((x) => x.difficulty === d)?.count ?? 0;

  const calMu = c.matchedUser?.userCalendar ?? {};
  let cal = {};
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
  ];
  const topTags = tags.sort((a, b) => b.problemsSolved - a.problemsSolved).slice(0, 8);

  const recentList = (r.recentAcSubmissionList ?? []).map((s) => ({
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
    streak: computeStreak(cal) || Number(calMu.streak ?? 0),
    totalActiveDays: Number(calMu.totalActiveDays ?? 0),
    submissionCalendar: cal,
    recent: recentList,
    topTags,
  };
}

async function fetchRecentSubmissionsWithDetails(username) {
  const recentQuery = `
    query recentAcSubmissions($username: String!, $limit: Int!) {
      recentAcSubmissionList(username: $username, limit: $limit) {
        title titleSlug timestamp
      }
    }`;

  const res = await lcQuery(recentQuery, { username, limit: 20 });
  const list = res.recentAcSubmissionList ?? [];

  if (list.length === 0) return [];

  const uniqueSlugs = Array.from(new Set(list.map((s) => s.titleSlug)));

  const diffQuery = `
    query questionDifficulty($titleSlug: String!) {
      question(titleSlug: $titleSlug) {
        difficulty
      }
    }`;

  const difficultiesMap = {};

  await Promise.all(
    uniqueSlugs.map(async (slug) => {
      try {
        const qRes = await lcQuery(diffQuery, { titleSlug: slug });
        const diff = qRes.question ? qRes.question.difficulty : "Medium";
        difficultiesMap[slug] =
          diff === "Easy" || diff === "Medium" || diff === "Hard" ? diff : "Medium";
      } catch (err) {
        console.error(`Error fetching difficulty for ${slug}:`, err);
        difficultiesMap[slug] = "Medium";
      }
    })
  );

  return list.map((item) => ({
    title: item.title,
    titleSlug: item.titleSlug,
    timestamp: Number(item.timestamp),
    difficulty: difficultiesMap[item.titleSlug] ?? "Medium",
  }));
}

export { fetchLeetCodeProfile, fetchRecentSubmissionsWithDetails };
