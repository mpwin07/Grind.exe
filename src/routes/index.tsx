import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ExternalLink, RefreshCw, Trophy, TrendingUp } from "lucide-react";

import { AppSidebar } from "@/components/AppSidebar";
import { UsernameDialog } from "@/components/UsernameDialog";
import { fetchLeetCodeProfile, type LCProfile } from "@/lib/leetcode.functions";
import { suggestNextProblem, type AISuggestion } from "@/lib/ai-suggest.functions";
import {
  checkDailyReminder,
  checkStreakAlert,
  checkMilestone,
  checkWeeklySummary,
  initNotificationSchedulers,
} from "@/lib/notifications";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard | grind.exe" },
      {
        name: "description",
        content: "Track your grind.exe with AI-powered problem suggestions and streak tracking.",
      },
    ],
  }),
  component: Dashboard,
});

const STORAGE_KEY = "lc:username";
const AI_SUGGESTION_STORAGE_KEY = "lc:ai-suggestion";
const SKIPPED_SUGGESTIONS_KEY = "lc:skipped-suggestions";

function getSkippedTitles(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SKIPPED_SUGGESTIONS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function addSkippedTitle(title: string) {
  if (typeof window === "undefined") return;
  const titles = getSkippedTitles();
  if (!titles.includes(title)) {
    titles.push(title);
    // Keep only last 20 to avoid bloat
    const trimmed = titles.slice(-20);
    localStorage.setItem(SKIPPED_SUGGESTIONS_KEY, JSON.stringify(trimmed));
  }
}

function Dashboard() {
  const [username, setUsername] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [active, setActive] = useState("dashboard");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(STORAGE_KEY) ?? "";
    if (stored) setUsername(stored);
    else setDialogOpen(true);
  }, []);

  const fetchProfile = useServerFn(fetchLeetCodeProfile);
  const profileQ = useQuery<LCProfile>({
    queryKey: ["lc-profile", username],
    queryFn: () => fetchProfile({ data: { username } }),
    enabled: !!username,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const fetchSuggest = useServerFn(suggestNextProblem);
  const getStoredSuggestion = (): AISuggestion | undefined => {
    if (typeof window === "undefined") return undefined;
    const stored = sessionStorage.getItem(AI_SUGGESTION_STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored) as AISuggestion;
      } catch {
        return undefined;
      }
    }
    return undefined;
  };

  const suggestQ = useQuery<AISuggestion>({
    queryKey: ["ai-suggest", username, profileQ.data?.totalSolved],
    queryFn: () =>
      fetchSuggest({
        data: {
          username,
          totalSolved: profileQ.data!.totalSolved,
          easySolved: profileQ.data!.easySolved,
          mediumSolved: profileQ.data!.mediumSolved,
          hardSolved: profileQ.data!.hardSolved,
          streak: profileQ.data!.streak,
          recentTitles: profileQ.data!.recent.map((r) => r.title),
          topTags: profileQ.data!.topTags.map((t) => t.tagName),
          skipTitles: getSkippedTitles(),
        },
      }),
    enabled: !!profileQ.data,
    staleTime: 1000 * 60 * 30,
    retry: 0,
    placeholderData: getStoredSuggestion(),
  });

  useEffect(() => {
    if (profileQ.error) toast.error(`Couldn't load LeetCode: ${(profileQ.error as Error).message}`);
  }, [profileQ.error]);
  useEffect(() => {
    if (suggestQ.error) toast.error(`AI Coach: ${(suggestQ.error as Error).message}`);
  }, [suggestQ.error]);

  // Persist AI suggestion to sessionStorage
  useEffect(() => {
    if (suggestQ.data) {
      if (typeof window !== "undefined") {
        sessionStorage.setItem(AI_SUGGESTION_STORAGE_KEY, JSON.stringify(suggestQ.data));
      }
    }
  }, [suggestQ.data]);

  // Initialize notification schedulers
  useEffect(() => {
    if (typeof window === "undefined") return;
    const cleanup = initNotificationSchedulers();
    return cleanup;
  }, []);

  // Run notification checks when profile data loads
  useEffect(() => {
    if (!profileQ.data) return;
    const p = profileQ.data;

    // Check if user has submitted today (look at submission calendar)
    const today = new Date();
    const todayTs = Math.floor(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) / 1000);
    const hasSubmittedToday = (p.submissionCalendar[String(todayTs)] ?? 0) > 0;

    checkStreakAlert(p.streak, hasSubmittedToday);
    checkMilestone(p.totalSolved);
    checkWeeklySummary(p.totalSolved, p.streak, p.easySolved, p.mediumSolved, p.hardSolved);
  }, [profileQ.data]);

  const saveUsername = (u: string) => {
    localStorage.setItem(STORAGE_KEY, u);
    setUsername(u);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppSidebar
        active={active}
        onSelect={setActive}
        onSettings={() => setDialogOpen(true)}
        avatarUrl={profileQ.data?.avatar}
      />
      <main className="ml-24 p-8 lg:p-12 max-w-[1400px]">
        <Header
          username={username || "guest"}
          onRefresh={() => {
            profileQ.refetch();
            suggestQ.refetch();
          }}
          refreshing={profileQ.isFetching}
        />

        <div className="grid grid-cols-12 gap-6 mt-10">
          <StreakCard streak={profileQ.data?.streak ?? 0} loading={profileQ.isLoading} />
          <NextProblemCard 
            suggest={suggestQ.data} 
            loading={suggestQ.isLoading} 
            onSkip={async () => {
              await suggestQ.refetch();
            }} 
          />
          <ActivityHeatmap calendar={profileQ.data?.submissionCalendar ?? {}} />
        </div>

        <DifficultyBreakdown profile={profileQ.data} />
        <RecentSolves recent={profileQ.data?.recent ?? []} loading={profileQ.isLoading} />
        <MilestoneSection profile={profileQ.data} />

        {!username && !dialogOpen && (
          <div className="mt-20 text-center">
            <button
              onClick={() => setDialogOpen(true)}
              className="px-8 py-4 bg-primary text-primary-foreground font-display text-sm font-bold tracking-wide hover:bg-primary/90 transition rounded-lg"
            >
              LINK YOUR LEETCODE ACCOUNT
            </button>
          </div>
        )}
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

function Header({
  username,
  onRefresh,
  refreshing,
}: {
  username: string;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <header className="flex flex-wrap gap-6 justify-between items-end">
      <div>
        <p className="font-display text-sm font-bold text-neon mb-2 uppercase tracking-wide">
          Dashboard
        </p>
        <h1 className="font-display text-4xl lg:text-5xl font-bold tracking-tight">
          grind.exe
        </h1>
        <p className="text-sm text-muted-foreground mt-2 font-sans">
          User: <span className="text-neon font-semibold">{username}</span>
        </p>
      </div>
      <button
        onClick={onRefresh}
        className="p-2.5 border border-white/10 rounded-lg hover:border-neon hover:text-neon cursor-glow transition-colors"
        aria-label="Refresh"
      >
        <RefreshCw className={`size-5 ${refreshing ? "animate-spin" : ""}`} />
      </button>
    </header>
  );
}

function StreakCard({ streak, loading }: { streak: number; loading: boolean }) {
  const max = 100;
  const pct = Math.min(streak / max, 1);
  return (
    <section className="col-span-12 md:col-span-4 bg-card rounded-2xl p-6 border border-white/10 cursor-glow min-h-[200px] flex flex-col justify-between">
      <div>
        <h3 className="font-display text-xs font-bold tracking-widest text-muted-foreground mb-4 uppercase">
          🔥 Current Streak
        </h3>
        <span className="text-6xl font-display font-bold text-foreground tabular-nums">
          {loading ? "—" : streak}
        </span>
        <span className="text-neon font-display text-lg ml-2 uppercase tracking-wide font-semibold">days</span>
      </div>
      <div className="mt-4">
        <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-neon to-primary shadow-neon transition-all duration-700"
            style={{ width: `${pct * 100}%` }}
          />
        </div>
        <p className="mt-2 text-xs uppercase tracking-wider text-muted-foreground font-sans">
          {streak > 0 ? `${streak} / ${max} days` : "Start solving to build your streak"}
        </p>
      </div>
    </section>
  );
}

function NextProblemCard({ suggest, loading, onSkip }: { suggest?: AISuggestion; loading: boolean; onSkip?: (currentTitle?: string) => Promise<void> }) {
  const [skipping, setSkipping] = useState(false);
  const queryClient = useQueryClient();

  const handleSkip = async () => {
    setSkipping(true);
    try {
      // Track the skipped suggestion so AI won't repeat it
      if (suggest?.title) {
        addSkippedTitle(suggest.title);
      }
      if (typeof window !== "undefined") {
        sessionStorage.removeItem(AI_SUGGESTION_STORAGE_KEY);
      }
      // Remove cached data so it forces a fresh fetch
      queryClient.removeQueries({ queryKey: ["ai-suggest"] });
      await onSkip?.(suggest?.title);
    } finally {
      setSkipping(false);
    }
  };

  const difficultyColor =
    suggest?.difficulty === "Hard"
      ? "bg-red-500/20 text-red-400"
      : suggest?.difficulty === "Medium"
        ? "bg-yellow-500/20 text-yellow-400"
        : "bg-emerald-500/20 text-emerald-400";

  return (
    <section className="col-span-12 md:col-span-8 bg-card rounded-2xl p-6 border border-white/10 cursor-glow flex flex-col justify-between min-h-[200px]">
      <div className="flex flex-wrap gap-4 justify-between items-start">
        <div className="max-w-lg flex-1">
          <h3 className="font-display text-xs font-bold tracking-widest text-muted-foreground mb-3 uppercase">
            ⚡ AI Recommended Next
          </h3>
          <h4 className="text-2xl lg:text-3xl font-display font-bold tracking-tight text-balance">
            {loading ? "Finding your next challenge…" : (suggest?.title ?? "Link LeetCode to get recommendations")}
          </h4>
          {suggest && (
            <>
              <p className="text-sm text-muted-foreground mt-3 leading-relaxed font-sans">
                {suggest.why}
              </p>
              <div className="flex gap-2 mt-4 flex-wrap">
                <span
                  className={`inline-block px-3 py-1 ${difficultyColor} text-xs font-bold rounded-full uppercase tracking-wider font-sans`}
                >
                  {suggest.difficulty}
                </span>
                <span className="inline-block px-3 py-1 bg-white/10 text-muted-foreground text-xs font-bold rounded-full uppercase tracking-wider font-sans">
                  {suggest.topic}
                </span>
              </div>
            </>
          )}
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <a
            href={suggest ? `https://leetcode.com/problems/${suggest.slug}/` : "#"}
            target="_blank"
            rel="noreferrer"
            className={`px-6 py-3 bg-primary text-primary-foreground font-display text-sm font-bold tracking-wide hover:bg-primary/90 transition rounded-lg flex items-center gap-2 cursor-glow ${!suggest ? "pointer-events-none opacity-40" : ""}`}
          >
            SOLVE NOW <ExternalLink className="size-4" />
          </a>
          <button
            disabled={!suggest || loading || skipping}
            onClick={handleSkip}
            className="px-6 py-3 border border-white/10 font-display text-sm font-bold tracking-wide hover:border-neon hover:text-neon transition rounded-lg cursor-glow disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {skipping ? "SKIPPING…" : "SKIP"}
          </button>
        </div>
      </div>
    </section>
  );
}

function ActivityHeatmap({ calendar }: { calendar: Record<string, number> }) {
  const days = useMemo(() => {
    const out: Array<{ key: string; count: number }> = [];
    const today = new Date();
    for (let i = 119; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCDate(today.getUTCDate() - i);
      const ts = Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / 1000);
      let count = 0;
      for (let s = ts; s < ts + 86400; s += 86400) {
        count += calendar[String(s)] ?? 0;
      }
      out.push({ key: d.toISOString().slice(0, 10), count });
    }
    return out;
  }, [calendar]);

  const intensity = (c: number) =>
    c === 0 ? "bg-white/5" : c < 2 ? "bg-neon/20" : c < 4 ? "bg-neon/40" : c < 7 ? "bg-neon/70" : "bg-neon shadow-neon";

  return (
    <section className="col-span-12 bg-card rounded-2xl p-6 border border-white/10">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display text-sm font-bold tracking-wide uppercase">Submission Heatmap</h3>
        <div className="flex items-center gap-2 text-xs font-sans text-muted-foreground">
          <span>Less</span>
          <div className="size-3 bg-white/5 rounded-sm" />
          <div className="size-3 bg-neon/20 rounded-sm" />
          <div className="size-3 bg-neon/40 rounded-sm" />
          <div className="size-3 bg-neon/70 rounded-sm" />
          <div className="size-3 bg-neon rounded-sm" />
          <span>More</span>
        </div>
      </div>
      <div className="grid grid-flow-col grid-rows-7 gap-1.5 auto-cols-fr">
        {days.map((d) => (
          <div
            key={d.key}
            title={`${d.key}: ${d.count} submission${d.count === 1 ? "" : "s"}`}
            className={`aspect-square rounded-sm border border-white/10 cursor-pointer hover:border-neon transition-all ${intensity(d.count)}`}
          />
        ))}
      </div>
    </section>
  );
}

function DifficultyBreakdown({ profile }: { profile?: LCProfile }) {
  const items: Array<{ label: string; solved: number; total: number; color: string }> = [
    {
      label: "Easy",
      solved: profile?.easySolved ?? 0,
      total: profile?.totalQuestions.easy ?? 0,
      color: "from-emerald-400 to-emerald-600",
    },
    {
      label: "Medium",
      solved: profile?.mediumSolved ?? 0,
      total: profile?.totalQuestions.medium ?? 0,
      color: "from-yellow-400 to-yellow-600",
    },
    {
      label: "Hard",
      solved: profile?.hardSolved ?? 0,
      total: profile?.totalQuestions.hard ?? 0,
      color: "from-rose-400 to-rose-600",
    },
  ];
  return (
    <section className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
      {items.map((it) => {
        const pct = it.total ? Math.min(it.solved / it.total, 1) : 0;
        return (
          <div key={it.label} className="p-6 bg-card border border-white/10 rounded-2xl cursor-glow transition-all">
            <div className="flex items-baseline justify-between mb-3">
              <span className="font-display text-xs font-bold tracking-widest text-muted-foreground uppercase">
                {it.label}
              </span>
              <span className="font-display text-2xl font-bold tabular-nums">
                {it.solved}
                <span className="text-muted-foreground text-sm">{it.total ? `/${it.total}` : "/?"}</span>
              </span>
            </div>
            <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${it.color} transition-all duration-700`}
                style={{ width: `${pct * 100}%` }}
              />
            </div>
          </div>
        );
      })}
    </section>
  );
}

function RecentSolves({ recent, loading }: { recent: LCProfile["recent"]; loading: boolean }) {
  return (
    <section className="mt-12">
      <h3 className="font-display text-sm font-bold tracking-wide text-muted-foreground mb-6 uppercase">
        ✓ Recently Solved
      </h3>
      {loading ? (
        <div className="flex gap-4 overflow-hidden">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="w-40 shrink-0 p-4 border border-white/10 bg-white/5 rounded-xl h-24 animate-pulse" />
          ))}
        </div>
      ) : recent.length === 0 ? (
        <p className="text-sm text-muted-foreground font-sans">No recent solves yet. Start solving to build your momentum!</p>
      ) : (
        <div className="relative flex items-start gap-4 overflow-x-auto pb-4 pt-4 snap-x hide-scrollbar">
          {/* Horizontal connecting line */}
          <div className="absolute top-[21px] left-0 w-[200%] h-[2px] bg-white/10 -z-10" />

          {recent.slice(0, 10).map((s, i) => (
            <a
              key={`${s.titleSlug}-${i}`}
              href={`https://leetcode.com/problems/${s.titleSlug}/`}
              target="_blank"
              rel="noreferrer"
              className="relative flex flex-col items-center gap-4 snap-start group w-44 shrink-0"
            >
              {/* Timeline node */}
              <div className="w-3 h-3 rounded-full bg-night border-2 border-neon group-hover:bg-neon group-hover:shadow-[0_0_12px_var(--color-neon)] transition-all z-10" />

              {/* Title Card */}
              <div className="p-4 border border-white/10 bg-card rounded-xl group-hover:border-neon group-hover:bg-white/5 cursor-glow transition-all w-full text-center">
                <div className="text-sm font-semibold truncate group-hover:text-neon transition font-sans mb-1">
                  {s.title}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-display">
                  {timeAgo(s.timestamp)}
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

function MilestoneSection({ profile }: { profile?: LCProfile }) {
  if (!profile) return null;
  
  return (
    <section className="mt-12">
      <h3 className="font-display text-sm font-bold tracking-wide text-muted-foreground mb-4 uppercase">
        🏆 Milestones
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MilestoneCard
          label="Total Solved"
          value={profile.totalSolved}
          icon={TrendingUp}
        />
        <MilestoneCard
          label="Hard Problems"
          value={profile.hardSolved}
          icon={Trophy}
          color="text-red-400"
        />
        <MilestoneCard
          label="Current Rank"
          value={profile.ranking ?? "—"}
          icon={Trophy}
          color="text-yellow-400"
        />
        <MilestoneCard
          label="Acceptance Rate"
          value={`${profile.acceptanceRate ?? "—"}%`}
          color="text-emerald-400"
        />
      </div>
    </section>
  );
}

function MilestoneCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon?: any;
  color?: string;
}) {
  return (
    <div className="p-6 bg-card border border-white/10 rounded-2xl cursor-glow transition-all hover:border-neon">
      <div className="flex items-center gap-3 mb-2">
        {Icon && <Icon className={`size-5 ${color || "text-neon"}`} />}
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">
          {label}
        </span>
      </div>
      <span className="text-3xl font-display font-bold text-foreground">
        {value}
      </span>
    </div>
  );
}

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000 - ts);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}