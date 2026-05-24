import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Search,
  ExternalLink,
  Loader,
  Brain,
  TrendingUp,
  BarChart3,
  CalendarDays,
  X,
  Clock,
  ArrowRight,
  Target,
  Sparkles,
  ShieldAlert,
  ShieldCheck,
  Copy,
  Check,
  Code2,
} from "lucide-react";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { AppSidebar } from "@/components/AppSidebar";
import { UsernameDialog } from "@/components/UsernameDialog";
import { createGroqChatCompletion } from "@/lib/groq.functions";
import { fetchLeetCodeProfile, type LCProfile } from "@/lib/leetcode.functions";

export const Route = createFileRoute("/ai-mode")({
  head: () => ({
    meta: [
      { title: "AI Mode | grind.exe" },
      {
        name: "description",
        content: "Search and analyze LeetCode problems by topic with AI-powered recommendations.",
      },
    ],
  }),
  component: AIModeComponent,
});

const searchSchema = z.object({
  topic: z.string().min(1).max(200),
  username: z.string().min(1).max(64),
  totalSolved: z.number().optional(),
  topTags: z.array(z.string()).optional(),
  // Slugs of problems the user has already solved — AI will exclude them
  solvedSlugs: z.array(z.string()).optional(),
});

interface SearchResult {
  questionId: number;
  title: string;
  titleSlug: string;
  difficulty: "Easy" | "Medium" | "Hard";
  topicTags: string[];
  successRate: number;
  description: string;
}

type SessionSearch = {
  username: string;
  topic: string;
  results: SearchResult[];
};

export const searchProblems = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => searchSchema.parse(d))
  .handler(async ({ data }): Promise<SearchResult[]> => {
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

      let parsed: SearchResult[];
      try {
        let results = JSON.parse(content);
        if (!Array.isArray(results)) throw new Error("Expected array");
        parsed = results;
      } catch {
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (!jsonMatch) throw new Error("Could not parse AI response as JSON");
        parsed = JSON.parse(jsonMatch[0]);
      }

      // Normalise: AI sometimes returns 'slug' instead of 'titleSlug'
      const normalised = parsed.map((p: any, i: number) => ({
        questionId: p.questionId ?? p.frontendId ?? i + 1,
        title: String(p.title ?? ""),
        titleSlug: String(p.titleSlug ?? p.slug ?? ""),
        difficulty: p.difficulty as "Easy" | "Medium" | "Hard",
        topicTags: Array.isArray(p.topicTags) ? p.topicTags.map(String) : [],
        successRate: Number(p.successRate ?? p.acRate ?? 50),
        description: String(p.description ?? ""),
      }));

      // Remove any problems the user already solved (double-check client hint)
      const solved = new Set((data.solvedSlugs ?? []).map((s) => s.toLowerCase()));
      return normalised
        .filter((p) => p.titleSlug && !solved.has(p.titleSlug.toLowerCase()))
        .slice(0, 9);
    } catch (error) {
      console.error("AI Mode Error:", error);
      throw error;
    }
  });

interface SolutionResponse {
  bruteForce: string;
  optimized: string;
}

const solutionSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  language: z.enum(["java", "python", "cpp", "javascript", "typescript", "go", "rust"]),
});

export const getSolution = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => solutionSchema.parse(d))
  .handler(async ({ data }): Promise<SolutionResponse> => {
    try {
      const prompt = `Provide two solutions for the LeetCode problem "${data.title}" (leetcode.com/problems/${data.slug}/) in ${data.language.toUpperCase()}.

Return a JSON object with exactly these two fields:
- "bruteForce": a string containing the complete brute-force solution code
- "optimized": a string containing the complete optimized solution code

CRITICAL FORMATTING RULES:
- Each line of code MUST be separated by a real newline character (\n) inside the JSON string.
- Use proper indentation (spaces, not tabs).
- Include helpful comments explaining the approach.
- Do NOT put all code on one line.
- The code must be well-formatted, readable, and production-ready.

Example of correct JSON format:
{"bruteForce": "import java.util.*;\n\nclass Solution {\n    public int[] solve(int[] nums) {\n        // brute force approach\n        return nums;\n    }\n}", "optimized": "..."}`;

      const json = await createGroqChatCompletion({
        messages: [
          {
            role: "system",
            content:
              "You are an expert LeetCode solutions provider. Return ONLY a valid JSON object with \"bruteForce\" and \"optimized\" fields. Each field is a string containing properly formatted, multi-line code. Use \\n for newlines inside JSON strings. No markdown, no code blocks, no extra text — just raw JSON.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
      });

      const content = json.choices?.[0]?.message?.content;
      if (!content) throw new Error("No response from AI");

      // The AI often returns raw newlines/tabs inside JSON string values,
      // which is invalid JSON. Fix by escaping control chars only inside strings.
      function sanitizeJsonResponse(raw: string): string {
        let result = "";
        let inString = false;
        let escape = false;
        for (let i = 0; i < raw.length; i++) {
          const ch = raw[i]!;
          if (escape) {
            result += ch;
            escape = false;
            continue;
          }
          if (ch === "\\" && inString) {
            result += ch;
            escape = true;
            continue;
          }
          if (ch === '"') {
            inString = !inString;
            result += ch;
            continue;
          }
          if (inString) {
            if (ch === "\n") { result += "\\n"; continue; }
            if (ch === "\r") { result += "\\r"; continue; }
            if (ch === "\t") { result += "\\t"; continue; }
          }
          result += ch;
        }
        return result;
      }

      let parsed: SolutionResponse;
      try {
        parsed = JSON.parse(sanitizeJsonResponse(content));
      } catch {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("Could not parse AI response as JSON");
        parsed = JSON.parse(sanitizeJsonResponse(jsonMatch[0]));
      }

      // Normalise: collapse any remaining escaped sequences
      const normCode = (s: string) =>
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
  });

const STORAGE_KEY = "lc:username";
const RECENT_SEARCHES_KEY = "lc:recent-searches";
const SESSION_SEARCH_KEY = "lc:ai-mode:session-search";
const SESSION_TOPIC_KEY = "lc:ai-mode:last-topic";

function getSessionSearch(username: string): SessionSearch | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = sessionStorage.getItem(SESSION_SEARCH_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<SessionSearch>;
    if (
      parsed.username !== username ||
      typeof parsed.topic !== "string" ||
      !Array.isArray(parsed.results)
    ) {
      return null;
    }
    return {
      username: parsed.username,
      topic: parsed.topic,
      results: parsed.results as SearchResult[],
    };
  } catch {
    return null;
  }
}

function saveSessionSearch(search: SessionSearch) {
  if (typeof window === "undefined") return;
  saveSessionTopic(search.username, search.topic);
  sessionStorage.setItem(SESSION_SEARCH_KEY, JSON.stringify(search));
}

function getSessionTopic(username: string): string {
  if (typeof window === "undefined") return "";
  try {
    const stored = sessionStorage.getItem(SESSION_TOPIC_KEY);
    if (!stored) return "";
    const parsed = JSON.parse(stored) as { username?: string; topic?: string };
    return parsed.username === username && typeof parsed.topic === "string" ? parsed.topic : "";
  } catch {
    return "";
  }
}

function saveSessionTopic(username: string, topic: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(SESSION_TOPIC_KEY, JSON.stringify({ username, topic }));
}

function clearSessionSearch() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(SESSION_SEARCH_KEY);
  sessionStorage.removeItem(SESSION_TOPIC_KEY);
}

function getRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.slice(0, 10) : [];
  } catch {
    return [];
  }
}

function saveRecentSearch(topic: string) {
  if (typeof window === "undefined") return;
  const searches = getRecentSearches().filter((s) => s.toLowerCase() !== topic.toLowerCase());
  searches.unshift(topic);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches.slice(0, 10)));
}

function removeRecentSearch(topic: string) {
  if (typeof window === "undefined") return;
  const searches = getRecentSearches().filter((s) => s !== topic);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(searches));
}

function AIModeComponent() {
  const [username, setUsername] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchTopic, setSearchTopic] = useState("");
  const [submittedTopic, setSubmittedTopic] = useState("");
  const [sessionSearch, setSessionSearch] = useState<SessionSearch | null>(null);
  const [active] = useState("ai-mode");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  // Incremented on every explicit search so the same topic always hits the AI fresh
  const [searchCounter, setSearchCounter] = useState(0);

  // Get stored username
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(STORAGE_KEY) ?? "";
    if (stored) {
      setUsername(stored);
      const savedSearch = getSessionSearch(stored);
      if (savedSearch) {
        setSearchTopic(savedSearch.topic);
        setSubmittedTopic(savedSearch.topic);
        setSessionSearch(savedSearch);
      } else {
        const savedTopic = getSessionTopic(stored);
        if (savedTopic) {
          setSearchTopic(savedTopic);
          setSubmittedTopic(savedTopic);
        }
      }
    } else {
      setDialogOpen(true);
    }
  }, []);

  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  const fetchProfile = useServerFn(fetchLeetCodeProfile);
  const profileQ = useQuery<LCProfile>({
    queryKey: ["lc-profile", username],
    queryFn: () => fetchProfile({ data: { username } }),
    enabled: !!username,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const search = useServerFn(searchProblems);
  // Build the set of already-solved problem slugs from recent submissions
  const solvedSlugs = useMemo(
    () => profileQ.data?.recent.map((r) => r.titleSlug) ?? [],
    [profileQ.data]
  );
  const searchQ = useQuery<SearchResult[]>({
    // searchCounter is bumped on every submit so the same topic always re-fetches
    queryKey: ["search-problems", submittedTopic, username, searchCounter],
    queryFn: () =>
      search({
        data: {
          topic: submittedTopic,
          username,
          totalSolved: profileQ.data?.totalSolved ?? 0,
          topTags: profileQ.data?.topTags.map((t) => t.tagName) ?? [],
          solvedSlugs,
        },
      }),
    enabled: !!submittedTopic && !!username && searchCounter > 0,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });

  useEffect(() => {
    if (!username || !submittedTopic || !searchQ.data) return;
    const next = { username, topic: submittedTopic, results: searchQ.data };
    setSessionSearch(next);
    saveSessionSearch(next);
  }, [searchQ.data, submittedTopic, username]);

  const displayedResults =
    searchQ.data ?? (sessionSearch?.topic === submittedTopic ? sessionSearch.results : undefined);
  const displayedTopic = displayedResults ? submittedTopic : "";

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const topic = searchTopic.trim();
    if (topic) {
      setSearchTopic(topic);
      setSubmittedTopic(topic);
      saveSessionTopic(username, topic);
      saveRecentSearch(topic);
      setRecentSearches(getRecentSearches());
      // Bump counter — causes a new query key so the AI is always called fresh
      setSearchCounter((c) => c + 1);
    }
  };

  const handleRecentClick = (topic: string) => {
    setSearchTopic(topic);
    setSubmittedTopic(topic);
    saveSessionTopic(username, topic);
    saveRecentSearch(topic);
    setRecentSearches(getRecentSearches());
    setSearchCounter((c) => c + 1);
  };

  const handleRemoveRecent = (topic: string) => {
    removeRecentSearch(topic);
    setRecentSearches(getRecentSearches());
  };

  const saveUsername = (u: string) => {
    if (u !== username) {
      clearSessionSearch();
      setSearchTopic("");
      setSubmittedTopic("");
      setSessionSearch(null);
    }
    localStorage.setItem(STORAGE_KEY, u);
    setUsername(u);
    setDialogOpen(false);
  };

  const topicSuggestions = [
    "Arrays",
    "HashMap",
    "Linked Lists",
    "Binary Tree",
    "Graphs",
    "Dynamic Programming",
    "Stack",
    "Greedy",
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppSidebar
        active={active}
        onSelect={() => {}}
        onSettings={() => setDialogOpen(true)}
        avatarUrl={profileQ.data?.avatar}
      />
      <main className="ml-20 p-8 lg:p-12 max-w-[1400px]">
        <Header username={username} />

        {/* Section 1: Weakness Analysis Panel */}
        {profileQ.data && profileQ.data.topTags.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-2xl font-bold mb-6 flex items-center gap-2">
              <Brain className="size-6 text-neon" />
              Skill Analysis
            </h2>
            <WeaknessAnalysisPanel profile={profileQ.data} />
          </section>
        )}

        {profileQ.isLoading && (
          <section className="mt-10">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="p-8 bg-white/5 border border-white/10 rounded-lg animate-pulse h-80" />
              <div className="p-8 bg-white/5 border border-white/10 rounded-lg animate-pulse h-80" />
            </div>
          </section>
        )}

        {/* Search Form */}
        <div className="mt-8">
          <form onSubmit={handleSearch} className="mb-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={searchTopic}
                onChange={(e) => setSearchTopic(e.target.value)}
                placeholder="Search by topic... (e.g., hashmap, binary tree, dynamic programming)"
                className="flex-1 px-6 py-3 bg-card border border-white/10 rounded-lg focus:outline-none focus:border-neon focus:ring-1 focus:ring-neon/50 transition-all font-sans cursor-glow"
              />
              <button
                type="submit"
                disabled={!searchTopic.trim() || !username || searchQ.isLoading}
                className="px-8 py-3 bg-primary text-primary-foreground font-display font-bold tracking-wide rounded-lg hover:bg-primary/90 cursor-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {searchQ.isLoading ? (
                  <>
                    <Loader className="size-4 animate-spin" />
                    Searching
                  </>
                ) : (
                  <>
                    <Search className="size-4" />
                    Search
                  </>
                )}
              </button>
            </div>
            {!username && (
              <p className="mt-3 text-sm text-yellow-400/80">
                Please{" "}
                <button
                  type="button"
                  onClick={() => setDialogOpen(true)}
                  className="underline hover:text-yellow-300"
                >
                  link your LeetCode account
                </button>{" "}
                to use AI search.
              </p>
            )}
          </form>

          {/* Section 5: Recent Searches */}
          <RecentSearches
            searches={recentSearches}
            onSelect={handleRecentClick}
            onRemove={handleRemoveRecent}
          />

          {searchQ.error && (
            <div className="p-6 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 mb-8">
              <p className="font-semibold mb-1">Error:</p>
              <p className="text-sm">{(searchQ.error as Error).message}</p>
            </div>
          )}

          {searchQ.isLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader className="size-8 text-neon animate-spin" />
              <span className="ml-4 text-muted-foreground font-sans">Analyzing topics...</span>
            </div>
          )}

          {/* Section 3: Problem Stats Cards */}
          {displayedResults && displayedResults.length > 0 && (
            <ProblemStatsCards results={displayedResults} />
          )}

          {displayedResults && displayedResults.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-display text-lg font-bold mb-6">
                Found {displayedResults.length} problems for "{displayedTopic}"
              </h3>
              {displayedResults.map((problem) => (
                <ProblemCard
                  key={problem.questionId}
                  problem={problem}
                  topTags={profileQ.data?.topTags}
                />
              ))}
            </div>
          )}

          {displayedResults && displayedResults.length === 0 && !searchQ.isLoading && (
            <div className="text-center py-12">
              <p className="text-muted-foreground font-sans">No problems found. Try a different topic.</p>
            </div>
          )}

          {/* Section 2: Difficulty Progression */}
          {displayedResults && displayedResults.length > 0 && (
            <section className="mt-12">
              <h2 className="font-display text-2xl font-bold mb-6 flex items-center gap-2">
                <TrendingUp className="size-6 text-neon" />
                Suggested Learning Path
              </h2>
              <DifficultyProgression results={displayedResults} />
            </section>
          )}

          {/* Section 4: Study Plan Generator */}
          {displayedResults && displayedResults.length > 0 && (
            <section className="mt-12">
              <h2 className="font-display text-2xl font-bold mb-6 flex items-center gap-2">
                <CalendarDays className="size-6 text-neon" />
                7-Day Study Plan
              </h2>
              <StudyPlanGenerator results={displayedResults} />
            </section>
          )}

          {/* Section 6: Topic Suggestions with Mastery Indicator */}
          {!searchTopic && !displayedResults && (
            <div className="text-center py-16">
              <p className="text-muted-foreground font-sans text-lg mb-4">
                Enter a topic to find relevant LeetCode problems
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8">
                {topicSuggestions.map((topic) => {
                  const tagData = profileQ.data?.topTags.find(
                    (t) => t.tagName.toLowerCase() === topic.toLowerCase()
                  );
                  return (
                    <button
                      key={topic}
                      onClick={() => {
                        setSearchTopic(topic);
                        setSubmittedTopic(topic);
                        saveSessionTopic(username, topic);
                        saveRecentSearch(topic);
                        setRecentSearches(getRecentSearches());
                        setSearchCounter((c) => c + 1);
                      }}
                      className="relative px-4 py-3 bg-white/5 border border-white/10 rounded-lg hover:border-neon hover:bg-white/10 cursor-glow transition-all font-sans text-sm"
                    >
                      {topic}
                      {tagData && <TopicMasteryBadge count={tagData.problemsSolved} />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      <UsernameDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        currentUsername={username}
        onSave={saveUsername}
      />
    </div>
  );
}

/* ─── Header ─── */
function Header({ username }: { username: string }) {
  return (
    <header>
      <p className="font-display text-sm font-bold text-neon mb-2 uppercase tracking-wide">AI Mode</p>
      <h1 className="font-display text-4xl lg:text-5xl font-bold tracking-tight">
        Problem Finder
      </h1>
      <p className="text-muted-foreground mt-3 font-sans">
        Search LeetCode problems by topic. AI analyzes your learning path and suggests the best problems for {username}.
      </p>
    </header>
  );
}

/* ─── Topic Mastery Badge ─── */
function TopicMasteryBadge({ count }: { count: number }) {
  const color =
    count > 20
      ? "bg-emerald-500/80 text-white"
      : count >= 10
        ? "bg-yellow-500/80 text-white"
        : "bg-white/20 text-white/60";
  return (
    <span
      className={`absolute -top-2 -right-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1 text-[10px] font-bold rounded-full ${color}`}
    >
      {count}
    </span>
  );
}

/* ─── Section 5: Recent Searches ─── */
function RecentSearches({
  searches,
  onSelect,
  onRemove,
}: {
  searches: string[];
  onSelect: (s: string) => void;
  onRemove: (s: string) => void;
}) {
  if (searches.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="size-3.5 text-muted-foreground" />
        <span className="text-xs font-sans text-muted-foreground uppercase tracking-wide font-bold">
          Recent Searches
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {searches.map((s) => (
          <span
            key={s}
            className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 bg-white/5 border border-white/10 rounded-full text-sm font-sans text-foreground/80 hover:border-neon hover:bg-white/10 cursor-glow transition-all group"
          >
            <button onClick={() => onSelect(s)} className="hover:text-neon transition-colors">
              {s}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(s);
              }}
              className="p-0.5 rounded-full hover:bg-white/10 text-muted-foreground hover:text-red-400 transition-colors"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── Section 1: Weakness Analysis Panel with Radar Chart ─── */
function WeaknessAnalysisPanel({ profile }: { profile: LCProfile }) {
  const tags = profile.topTags;
  if (tags.length === 0) return null;

  const topN = tags.slice(0, 6);
  const maxSolved = Math.max(...topN.map((t) => t.problemsSolved), 1);
  const avgSolved = tags.reduce((sum, t) => sum + t.problemsSolved, 0) / tags.length;

  const weakAreas = tags.filter((t) => t.problemsSolved < avgSolved);
  const strongAreas = tags.filter((t) => t.problemsSolved >= avgSolved);

  // Radar chart geometry
  const cx = 150;
  const cy = 150;
  const maxR = 110;
  const sides = topN.length;
  const angleStep = (2 * Math.PI) / sides;

  const getPoint = (index: number, radiusFraction: number) => {
    const angle = angleStep * index - Math.PI / 2;
    return {
      x: cx + maxR * radiusFraction * Math.cos(angle),
      y: cy + maxR * radiusFraction * Math.sin(angle),
    };
  };

  // Grid rings
  const rings = [0.25, 0.5, 0.75, 1.0];

  // Data polygon
  const dataPoints = topN.map((tag, i) => {
    const normalized = tag.problemsSolved / maxSolved;
    return getPoint(i, Math.max(normalized, 0.05));
  });
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Radar Chart */}
      <div className="p-8 bg-card border border-white/10 rounded-lg cursor-glow hover:border-neon transition-all flex items-center justify-center">
        <svg viewBox="0 0 300 300" className="w-full max-w-[320px]">
          {/* Grid rings */}
          {rings.map((r) => {
            const ringPoints = Array.from({ length: sides }, (_, i) => getPoint(i, r));
            const ringPath =
              ringPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ") + " Z";
            return (
              <path
                key={r}
                d={ringPath}
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="1"
              />
            );
          })}

          {/* Axis lines */}
          {topN.map((_, i) => {
            const p = getPoint(i, 1);
            return (
              <line
                key={`axis-${i}`}
                x1={cx}
                y1={cy}
                x2={p.x}
                y2={p.y}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth="1"
              />
            );
          })}

          {/* Data fill */}
          <path
            d={dataPath}
            fill="oklch(0.68 0.28 330 / 0.15)"
            stroke="oklch(0.68 0.28 330)"
            strokeWidth="2"
          />

          {/* Data points */}
          {dataPoints.map((p, i) => (
            <circle
              key={`dot-${i}`}
              cx={p.x}
              cy={p.y}
              r="4"
              fill="oklch(0.68 0.28 330)"
            />
          ))}

          {/* Labels */}
          {topN.map((tag, i) => {
            const labelP = getPoint(i, 1.25);
            return (
              <text
                key={`label-${i}`}
                x={labelP.x}
                y={labelP.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="rgba(255,255,255,0.6)"
                fontSize="10"
                fontFamily="sans-serif"
              >
                {tag.tagName.length > 12 ? tag.tagName.slice(0, 11) + "…" : tag.tagName}
              </text>
            );
          })}

          {/* Value labels */}
          {dataPoints.map((p, i) => (
            <text
              key={`val-${i}`}
              x={p.x}
              y={p.y - 10}
              textAnchor="middle"
              fill="oklch(0.68 0.28 330)"
              fontSize="9"
              fontWeight="bold"
              fontFamily="sans-serif"
            >
              {topN[i]!.problemsSolved}
            </text>
          ))}
        </svg>
      </div>

      {/* Strengths & Weaknesses */}
      <div className="space-y-6">
        {/* Strong Areas */}
        <div className="p-6 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20 rounded-lg">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="size-5 text-emerald-400" />
            <h3 className="font-display text-sm font-bold uppercase tracking-wide text-emerald-400">
              Strong Areas
            </h3>
          </div>
          <div className="space-y-2">
            {strongAreas.slice(0, 5).map((tag) => (
              <div
                key={tag.tagName}
                className="flex items-center justify-between px-3 py-2 bg-white/5 rounded-lg"
              >
                <span className="font-sans text-sm">{tag.tagName}</span>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min((tag.problemsSolved / maxSolved) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold text-emerald-400 w-8 text-right tabular-nums">
                    {tag.problemsSolved}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Weak Areas */}
        <div className="p-6 bg-gradient-to-br from-red-500/10 to-orange-500/10 border border-red-500/20 rounded-lg">
          <div className="flex items-center gap-2 mb-4">
            <ShieldAlert className="size-5 text-orange-400" />
            <h3 className="font-display text-sm font-bold uppercase tracking-wide text-orange-400">
              Weak Areas — Needs Practice
            </h3>
          </div>
          {weakAreas.length === 0 ? (
            <p className="text-sm text-muted-foreground font-sans">
              No weak areas detected. Great job!
            </p>
          ) : (
            <div className="space-y-2">
              {weakAreas.slice(0, 5).map((tag) => (
                <div
                  key={tag.tagName}
                  className="flex items-center justify-between px-3 py-2 bg-white/5 rounded-lg"
                >
                  <span className="font-sans text-sm">{tag.tagName}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-orange-400 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min((tag.problemsSolved / maxSolved) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-orange-400 w-8 text-right tabular-nums">
                      {tag.problemsSolved}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground font-sans mt-3">
            Average across all tags: {Math.round(avgSolved)} problems
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─── Section 3: Problem Stats Cards ─── */
function ProblemStatsCards({ results }: { results: SearchResult[] }) {
  const avgSuccess = Math.round(
    results.reduce((sum, r) => sum + r.successRate, 0) / results.length
  );
  const easyCount = results.filter((r) => r.difficulty === "Easy").length;
  const mediumCount = results.filter((r) => r.difficulty === "Medium").length;
  const hardCount = results.filter((r) => r.difficulty === "Hard").length;
  const total = results.length;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
      {/* Total Results */}
      <div className="p-6 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-lg cursor-glow hover:border-neon transition-all">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground font-sans">
            Total Results
          </h3>
          <BarChart3 className="size-5 text-blue-400" />
        </div>
        <div className="text-4xl font-display font-bold text-neon">{total}</div>
        <p className="text-xs text-muted-foreground font-sans mt-1">problems found</p>
      </div>

      {/* Average Success Rate */}
      <div className="p-6 bg-gradient-to-br from-emerald-500/10 to-green-500/10 border border-emerald-500/20 rounded-lg cursor-glow hover:border-neon transition-all">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground font-sans">
            Avg Success Rate
          </h3>
          <Target className="size-5 text-emerald-400" />
        </div>
        <div className="text-4xl font-display font-bold text-neon">{avgSuccess}%</div>
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mt-2">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-neon transition-all duration-500"
            style={{ width: `${avgSuccess}%` }}
          />
        </div>
      </div>

      {/* Difficulty Distribution */}
      <div className="p-6 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-lg cursor-glow hover:border-neon transition-all">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground font-sans">
            Distribution
          </h3>
          <Sparkles className="size-5 text-purple-400" />
        </div>
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xs font-bold text-emerald-400">{easyCount}E</span>
          <span className="text-xs font-bold text-yellow-400">{mediumCount}M</span>
          <span className="text-xs font-bold text-red-400">{hardCount}H</span>
        </div>
        <div className="flex h-3 rounded-full overflow-hidden bg-white/10">
          {easyCount > 0 && (
            <div
              className="bg-emerald-500 transition-all duration-500"
              style={{ width: `${(easyCount / total) * 100}%` }}
            />
          )}
          {mediumCount > 0 && (
            <div
              className="bg-yellow-500 transition-all duration-500"
              style={{ width: `${(mediumCount / total) * 100}%` }}
            />
          )}
          {hardCount > 0 && (
            <div
              className="bg-red-500 transition-all duration-500"
              style={{ width: `${(hardCount / total) * 100}%` }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Section 2: Difficulty Progression ─── */
function DifficultyProgression({ results }: { results: SearchResult[] }) {
  const easy = results.filter((r) => r.difficulty === "Easy");
  const medium = results.filter((r) => r.difficulty === "Medium");
  const hard = results.filter((r) => r.difficulty === "Hard");

  const steps = [
    {
      label: "Step 1 — Easy",
      problems: easy,
      color: "border-emerald-500/50",
      bgColor: "from-emerald-500/10 to-teal-500/10",
      dotColor: "bg-emerald-500",
      textColor: "text-emerald-400",
      icon: "🌱",
    },
    {
      label: "Step 2 — Medium",
      problems: medium,
      color: "border-yellow-500/50",
      bgColor: "from-yellow-500/10 to-amber-500/10",
      dotColor: "bg-yellow-500",
      textColor: "text-yellow-400",
      icon: "⚡",
    },
    {
      label: "Step 3 — Hard",
      problems: hard,
      color: "border-red-500/50",
      bgColor: "from-red-500/10 to-pink-500/10",
      dotColor: "bg-red-500",
      textColor: "text-red-400",
      icon: "💎",
    },
  ];

  return (
    <div className="relative">
      {/* Connecting line */}
      <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-emerald-500/50 via-yellow-500/50 to-red-500/50 hidden md:block" />

      <div className="space-y-6">
        {steps.map((step, idx) => (
          <div key={step.label} className="relative flex gap-6">
            {/* Timeline dot */}
            <div className="hidden md:flex flex-col items-center z-10">
              <div className={`w-3 h-3 rounded-full ${step.dotColor} ring-4 ring-background`} />
              {idx < steps.length - 1 && <div className="flex-1" />}
            </div>

            {/* Card */}
            <div
              className={`flex-1 p-6 bg-gradient-to-br ${step.bgColor} border ${step.color} rounded-lg cursor-glow transition-all hover:border-neon`}
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">{step.icon}</span>
                <h3 className={`font-display text-sm font-bold uppercase tracking-wide ${step.textColor}`}>
                  {step.label}
                </h3>
                <span className="text-xs text-muted-foreground font-sans ml-auto">
                  {step.problems.length} problem{step.problems.length !== 1 ? "s" : ""}
                </span>
              </div>

              {step.problems.length === 0 ? (
                <p className="text-sm text-muted-foreground font-sans italic">
                  No {step.label.split("—")[1]?.trim().toLowerCase()} problems in results
                </p>
              ) : (
                <div className="space-y-2">
                  {step.problems.map((p) => (
                    <div
                      key={p.questionId}
                      className="flex items-center justify-between px-3 py-2 bg-white/5 rounded-lg"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">#{p.questionId}</span>
                        <span className="text-sm font-sans">{p.title}</span>
                      </div>
                      <a
                        href={`https://leetcode.com/problems/${p.titleSlug}/`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-neon hover:text-neon/80 transition-colors"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    </div>
                  ))}
                </div>
              )}

              {idx < steps.length - 1 && (
                <div className="flex justify-center mt-4 md:hidden">
                  <ArrowRight className="size-5 text-muted-foreground rotate-90" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Section 4: Study Plan Generator ─── */
function StudyPlanGenerator({ results }: { results: SearchResult[] }) {
  const orderedProblems = useMemo(() => {
    const diffOrder = { Easy: 0, Medium: 1, Hard: 2 };
    return [...results].sort((a, b) => diffOrder[a.difficulty] - diffOrder[b.difficulty]);
  }, [results]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const problem = orderedProblems[i] ?? null;
    const isRest = !problem;
    return { day: i + 1, problem, isRest };
  });

  const diffColor = (d: string) =>
    d === "Hard"
      ? "bg-red-500/20 text-red-400"
      : d === "Medium"
        ? "bg-yellow-500/20 text-yellow-400"
        : "bg-emerald-500/20 text-emerald-400";

  return (
    <div className="relative">
      {/* Timeline connector */}
      <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-neon/60 to-neon/10 hidden md:block" />

      <div className="space-y-4">
        {days.map(({ day, problem, isRest }) => (
          <div key={day} className="relative flex gap-6">
            {/* Day number dot */}
            <div className="hidden md:flex flex-col items-center z-10">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ring-4 ring-background ${
                  isRest
                    ? "bg-white/10 text-muted-foreground"
                    : "bg-neon/20 text-neon border border-neon/50"
                }`}
              >
                {day}
              </div>
            </div>

            {/* Card */}
            <div
              className={`flex-1 p-5 border rounded-lg cursor-glow transition-all ${
                isRest
                  ? "bg-white/3 border-white/5"
                  : "bg-card border-white/10 hover:border-neon"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="md:hidden text-xs font-bold text-neon bg-neon/10 px-2 py-1 rounded">
                    Day {day}
                  </span>
                  {isRest ? (
                    <div className="flex items-center gap-2">
                      <span className="text-lg">😴</span>
                      <span className="text-sm text-muted-foreground font-sans italic">
                        Rest Day — Review previous problems
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xs font-mono text-muted-foreground">
                        #{problem!.questionId}
                      </span>
                      <span className="font-sans text-sm font-medium">{problem!.title}</span>
                      <span
                        className={`inline-block px-2 py-0.5 ${diffColor(problem!.difficulty)} text-[10px] font-bold rounded uppercase`}
                      >
                        {problem!.difficulty}
                      </span>
                    </div>
                  )}
                </div>
                {!isRest && (
                  <a
                    href={`https://leetcode.com/problems/${problem!.titleSlug}/`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-primary text-primary-foreground font-display text-xs font-bold tracking-wide rounded-lg hover:bg-primary/90 transition-all flex items-center gap-1.5 shrink-0 cursor-glow"
                  >
                    Solve <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Problem Card ─── */
function ProblemCard({
  problem,
  topTags,
}: {
  problem: SearchResult;
  topTags?: Array<{ tagName: string; problemsSolved: number }>;
}) {
  const [showSolution, setShowSolution] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<"java" | "python" | "cpp" | "javascript" | "typescript" | "go" | "rust">("java");
  const [solutionLoading, setSolutionLoading] = useState(false);
  const [solution, setSolution] = useState<SolutionResponse | null>(null);
  const [solutionLanguage, setSolutionLanguage] = useState<string | null>(null);

  const fetchSolutionFn = useServerFn(getSolution);

  const handleFetchSolution = async (lang?: typeof selectedLanguage) => {
    const targetLang = lang ?? selectedLanguage;
    setSolutionLoading(true);
    try {
      const result = await fetchSolutionFn({
        data: {
          title: problem.title,
          slug: problem.titleSlug,
          language: targetLang,
        },
      });
      setSolution(result);
      setSolutionLanguage(targetLang);
    } catch (error) {
      toast.error(`Failed to fetch solution: ${(error as Error).message}`);
    } finally {
      setSolutionLoading(false);
    }
  };

  const handleLanguageChange = (lang: typeof selectedLanguage) => {
    setSelectedLanguage(lang);
    // If a solution was already loaded or the panel is open, auto-refetch
    if (showSolution) {
      setSolution(null);
      handleFetchSolution(lang);
    }
  };

  const difficultyColor =
    problem.difficulty === "Hard"
      ? "bg-red-500/20 text-red-400"
      : problem.difficulty === "Medium"
        ? "bg-yellow-500/20 text-yellow-400"
        : "bg-emerald-500/20 text-emerald-400";

  const languageLabels: Record<string, string> = {
    java: "Java",
    python: "Python",
    cpp: "C++",
    javascript: "JavaScript",
    typescript: "TypeScript",
    go: "Go",
    rust: "Rust",
  };

  const languageHighlight: Record<string, string> = {
    java: "text-orange-400",
    python: "text-sky-400",
    cpp: "text-blue-400",
    javascript: "text-yellow-400",
    typescript: "text-blue-300",
    go: "text-cyan-400",
    rust: "text-red-400",
  };

  return (
    <div className="p-6 bg-card border border-white/10 rounded-lg hover:border-neon cursor-glow transition-all group">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm font-mono text-muted-foreground">#{problem.questionId}</span>
            <span className={`inline-block px-2 py-1 ${difficultyColor} text-xs font-bold rounded uppercase`}>
              {problem.difficulty}
            </span>
          </div>
          <h3 className="text-lg font-semibold group-hover:text-neon transition-colors font-sans mb-2">
            {problem.title}
          </h3>
          <p className="text-sm text-muted-foreground mb-3 font-sans">{problem.description}</p>
          <div className="flex flex-wrap gap-2 mb-4">
            {problem.topicTags.map((tag) => {
              const tagData = topTags?.find(
                (t) => t.tagName.toLowerCase() === tag.toLowerCase()
              );
              return (
                <span
                  key={tag}
                  className="relative inline-block px-2 py-1 bg-white/5 text-xs rounded text-muted-foreground font-sans"
                >
                  {tag}
                  {tagData && (
                    <span
                      className={`ml-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-bold rounded-full ${
                        tagData.problemsSolved > 20
                          ? "bg-emerald-500/60 text-white"
                          : tagData.problemsSolved >= 10
                            ? "bg-yellow-500/60 text-white"
                            : "bg-white/15 text-white/50"
                      }`}
                    >
                      {tagData.problemsSolved}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground font-sans">
            <span>Success Rate: <span className="text-neon font-semibold">{problem.successRate}%</span></span>
          </div>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <a
            href={`https://leetcode.com/problems/${problem.titleSlug}/`}
            target="_blank"
            rel="noreferrer"
            className="px-6 py-3 bg-primary text-primary-foreground font-display text-sm font-bold tracking-wide rounded-lg hover:bg-primary/90 transition-all flex items-center gap-2 cursor-glow"
          >
            Solve <ExternalLink className="size-4" />
          </a>
          <button
            onClick={() => {
              setShowSolution(!showSolution);
              if (!showSolution && !solution) {
                handleFetchSolution();
              }
            }}
            className="px-6 py-3 border border-white/10 font-display text-sm font-bold tracking-wide rounded-lg hover:border-neon hover:text-neon transition-all cursor-glow flex items-center gap-2"
          >
            {solutionLoading ? (
              <>
                <Loader className="size-3.5 animate-spin" />
                Loading…
              </>
            ) : showSolution ? (
              "Hide Solution"
            ) : (
              "Solution"
            )}
          </button>
          {/* Language dropdown — always visible */}
          <select
            value={selectedLanguage}
            onChange={(e) => handleLanguageChange(e.target.value as typeof selectedLanguage)}
            className="px-3 py-2 bg-card border border-white/10 rounded-lg text-xs font-sans focus:outline-none focus:border-neon cursor-glow transition-all"
          >
            <option value="java">Java</option>
            <option value="python">Python</option>
            <option value="cpp">C++</option>
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="go">Go</option>
            <option value="rust">Rust</option>
          </select>
        </div>
      </div>

      {showSolution && (
        <div className="mt-6 pt-6 border-t border-white/10">
          {solutionLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader className="size-5 animate-spin mr-3" />
              <span className="font-sans">Generating {languageLabels[selectedLanguage]} solutions…</span>
            </div>
          ) : solution ? (() => {
            const areSame = solution.bruteForce.trim() === solution.optimized.trim();
            const langLabel = languageLabels[solutionLanguage ?? selectedLanguage] ?? selectedLanguage;
            return (
              <div className="max-w-3xl mx-auto space-y-8">
                {/* Optimized Solution (always shown first) */}
                <div>
                  <h4 className="font-display text-sm font-bold mb-4 text-emerald-400 uppercase flex items-center gap-2">
                    <ShieldCheck className="size-4" />
                    {areSame ? "Solution" : "Optimized Approach"}
                  </h4>
                  <SolutionCodeBlock code={solution.optimized} language={langLabel} />
                </div>

                {/* Brute Force Solution (hidden if same as optimized) */}
                {!areSame && (
                  <div>
                    <h4 className="font-display text-sm font-bold mb-4 text-orange-400 uppercase flex items-center gap-2">
                      <ShieldAlert className="size-4" />
                      Brute Force Approach
                    </h4>
                    <SolutionCodeBlock code={solution.bruteForce} language={langLabel} />
                  </div>
                )}
              </div>
            );
          })() : null}
        </div>
      )}
    </div>
  );
}

/* ─── Solution Code Block (with header + copy button) ─── */
function SolutionCodeBlock({ code, language }: { code: string; language: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = code;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="rounded-xl overflow-hidden border border-white/[0.08] bg-[#0c0c15] shadow-lg shadow-black/30">
      {/* Header bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-white/[0.025] border-b border-white/[0.08]">
        <div className="flex items-center gap-2.5">
          <Code2 className="size-4 text-white/40" />
          <span className="font-sans text-sm font-semibold text-white/70 tracking-wide">{language}</span>
        </div>
        <button
          onClick={handleCopy}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-sans font-semibold transition-all duration-200 ${
            copied
              ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30"
              : "bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white/80 ring-1 ring-white/[0.06]"
          }`}
          title="Copy to clipboard"
        >
          {copied ? (
            <>
              <Check className="size-3.5" />
              Copied!
            </>
          ) : (
            <>
              <Copy className="size-3.5" />
              Copy
            </>
          )}
        </button>
      </div>
      {/* Code body */}
      <div className="px-6 py-5 overflow-x-auto max-h-[600px] overflow-y-auto">
        <pre className="font-mono text-[13px] leading-[1.75] text-white/85 whitespace-pre m-0">{code}</pre>
      </div>
    </div>
  );
}
