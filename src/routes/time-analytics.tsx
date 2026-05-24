import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Timer,
  Clock,
  TrendingUp,
  Zap,
  BarChart3,
  Calendar,
  Lightbulb,
  Trash2,
  Plus,
  Trophy,
  Target,
  ArrowUp,
  ArrowDown,
  Flame,
  Brain,
  RefreshCw,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

import { AppSidebar } from "@/components/AppSidebar";
import { UsernameDialog } from "@/components/UsernameDialog";
import { fetchLeetCodeProfile, type LCProfile, fetchRecentSubmissionsWithDetails, type LCSubmissionDetail } from "@/lib/leetcode.functions";

export const Route = createFileRoute("/time-analytics")({
  head: () => ({
    meta: [
      { title: "Time Analytics | grind.exe" },
      {
        name: "description",
        content:
          "Track and analyze your LeetCode solving times with charts, heatmaps, and smart insights.",
      },
    ],
  }),
  component: TimeAnalyticsComponent,
});

/* ═══════════════════════════════════════════════════════════
   DATA LAYER — localStorage backed
   ═══════════════════════════════════════════════════════════ */

interface SolveEntry {
  id: string;
  problemTitle: string;
  difficulty: "Easy" | "Medium" | "Hard";
  timeMinutes: number;
  date: string; // YYYY-MM-DD
  tags?: string[];
  notes?: string;
}

const SOLVE_TIMES_KEY = "lc:solve-times";
const STORAGE_KEY = "lc:username";

function getSolveEntries(): SolveEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SOLVE_TIMES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSolveEntries(entries: SolveEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SOLVE_TIMES_KEY, JSON.stringify(entries));
}

function addSolveEntry(entry: Omit<SolveEntry, "id">): SolveEntry {
  const newEntry: SolveEntry = {
    ...entry,
    id: crypto.randomUUID(),
  };
  const entries = getSolveEntries();
  entries.unshift(newEntry);
  saveSolveEntries(entries);
  return newEntry;
}

function deleteSolveEntry(id: string) {
  const entries = getSolveEntries().filter((e) => e.id !== id);
  saveSolveEntries(entries);
}

/* ═══════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════ */

function formatTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatTimeVerbose(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (m === 0) return `${h} hr`;
  return `${h} hr ${m} min`;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_NAMES_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/* ═══════════════════════════════════════════════════════════
   ROOT COMPONENT
   ═══════════════════════════════════════════════════════════ */

function TimeAnalyticsComponent() {
  const [username, setUsername] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [entries, setEntries] = useState<SolveEntry[]>([]);
  const [syncing, setSyncing] = useState(false);

  const fetchProfile = useServerFn(fetchLeetCodeProfile);
  const fetchSubmissions = useServerFn(fetchRecentSubmissionsWithDetails);

  const profileQ = useQuery<LCProfile>({
    queryKey: ["lc-profile", username],
    queryFn: () => fetchProfile({ data: { username } }),
    enabled: !!username,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const handleSyncLeetCode = useCallback(async (forcedUsername?: string) => {
    const targetUsername = forcedUsername || username;
    if (!targetUsername) {
      setDialogOpen(true);
      return;
    }

    setSyncing(true);
    const toastId = toast.loading("Syncing submissions from LeetCode...");

    try {
      const submissions = await fetchSubmissions({ data: { username: targetUsername } });
      if (submissions.length === 0) {
        toast.dismiss(toastId);
        toast.info("No recent accepted submissions found on LeetCode.");
        setSyncing(false);
        return;
      }

      // Filter out existing submissions
      const currentEntries = getSolveEntries();
      
      // Sort submissions chronologically (oldest first) so we can compute intervals
      const sortedSubs = [...submissions].sort((a, b) => a.timestamp - b.timestamp);
      
      let newCount = 0;
      const updatedEntries = [...currentEntries];

      for (let i = 0; i < sortedSubs.length; i++) {
        const sub = sortedSubs[i];
        const subDate = new Date(sub.timestamp * 1000).toISOString().slice(0, 10);
        
        // Check if already in updatedEntries
        const exists = updatedEntries.some(
          (e) => e.problemTitle.toLowerCase() === sub.title.toLowerCase() && e.date === subDate
        );
        if (exists) continue;

        // Determine solve time in minutes
        let timeMinutes = 35; // Default Medium
        if (sub.difficulty === "Easy") timeMinutes = 15;
        else if (sub.difficulty === "Hard") timeMinutes = 70;

        // If there is a previous submission chronologically, and it's on the same day or within 3 hours
        if (i > 0) {
          const prevSub = sortedSubs[i - 1];
          const diffSeconds = sub.timestamp - prevSub.timestamp;
          const diffMinutes = Math.round(diffSeconds / 60);
          if (diffMinutes >= 1 && diffMinutes <= 180) {
            timeMinutes = diffMinutes;
          }
        }

        const newEntry: SolveEntry = {
          id: crypto.randomUUID(),
          problemTitle: sub.title,
          difficulty: sub.difficulty,
          timeMinutes,
          date: subDate,
        };

        updatedEntries.unshift(newEntry);
        newCount++;
      }

      if (newCount > 0) {
        saveSolveEntries(updatedEntries);
        setEntries(updatedEntries);
        toast.dismiss(toastId);
        toast.success(`Successfully imported ${newCount} new solved problems!`);
      } else {
        toast.dismiss(toastId);
        toast.success("Everything is up to date!");
      }
      
      if (typeof window !== "undefined") {
        localStorage.setItem("lc:last-sync-time", Date.now().toString());
      }
    } catch (error) {
      console.error(error);
      toast.dismiss(toastId);
      toast.error(`Sync failed: ${(error as Error).message}`);
    } finally {
      setSyncing(false);
    }
  }, [username, fetchSubmissions]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(STORAGE_KEY) ?? "";
    if (stored) {
      setUsername(stored);
      // Auto sync if last sync was more than 5 minutes ago
      const lastSync = localStorage.getItem("lc:last-sync-time");
      const now = Date.now();
      if (!lastSync || now - Number(lastSync) > 5 * 60 * 1000) {
        handleSyncLeetCode(stored);
      }
    } else {
      setDialogOpen(true);
    }
    setEntries(getSolveEntries());
  }, [handleSyncLeetCode]);

  const saveUsername = (u: string) => {
    localStorage.setItem(STORAGE_KEY, u);
    setUsername(u);
    setDialogOpen(false);
    handleSyncLeetCode(u);
  };

  const handleAddEntry = useCallback(
    (entry: Omit<SolveEntry, "id">) => {
      addSolveEntry(entry);
      setEntries(getSolveEntries());
      toast.success("Solve time logged!");
    },
    [],
  );

  const handleDeleteEntry = useCallback((id: string) => {
    deleteSolveEntry(id);
    setEntries(getSolveEntries());
    toast.success("Entry deleted");
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppSidebar
        active="time-analytics"
        onSelect={() => {}}
        onSettings={() => setDialogOpen(true)}
        avatarUrl={profileQ.data?.avatar}
      />
      <main className="ml-20 p-8 lg:p-12 max-w-[1400px]">
        <Header username={username} />

        {/* Quick Entry */}
        <section className="mt-10">
          <QuickEntryForm
            onAdd={handleAddEntry}
            syncing={syncing}
            onSync={() => handleSyncLeetCode()}
          />
        </section>

        {/* Summary Stats */}
        {entries.length > 0 && (
          <section className="mt-10">
            <SummaryStatsCards entries={entries} />
          </section>
        )}

        {/* Charts — only if we have data */}
        {entries.length > 0 && (
          <>
            {/* Average by Difficulty */}
            <section className="mt-12">
              <h2 className="font-display text-2xl font-bold mb-6 flex items-center gap-2">
                <BarChart3 className="size-6 text-neon" />
                Average Time by Difficulty
              </h2>
              <DifficultyAvgChart entries={entries} />
            </section>

            {/* Daily Trend */}
            <section className="mt-12">
              <h2 className="font-display text-2xl font-bold mb-6 flex items-center gap-2">
                <TrendingUp className="size-6 text-neon" />
                Daily Solving Time
              </h2>
              <DailyTrendChart entries={entries} />
            </section>

            {/* Weekly/Monthly Trends */}
            <section className="mt-12">
              <h2 className="font-display text-2xl font-bold mb-6 flex items-center gap-2">
                <Calendar className="size-6 text-neon" />
                Weekly & Monthly Trends
              </h2>
              <WeeklyMonthlyTrends entries={entries} />
            </section>

            {/* Heatmap */}
            <section className="mt-12">
              <h2 className="font-display text-2xl font-bold mb-6 flex items-center gap-2">
                <Flame className="size-6 text-neon" />
                Solving Heatmap
              </h2>
              <TimeHeatmapCalendar entries={entries} />
            </section>

            {/* Smart Insights */}
            {entries.length >= 5 && (
              <section className="mt-12">
                <h2 className="font-display text-2xl font-bold mb-6 flex items-center gap-2">
                  <Lightbulb className="size-6 text-neon" />
                  Smart Insights
                </h2>
                <SmartInsightsPanel entries={entries} />
              </section>
            )}

            {/* Recent Entries Table */}
            <section className="mt-12">
              <h2 className="font-display text-2xl font-bold mb-6 flex items-center gap-2">
                <Clock className="size-6 text-neon" />
                Recent Entries
              </h2>
              <RecentEntriesTable
                entries={entries}
                onDelete={handleDeleteEntry}
              />
            </section>
          </>
        )}

        {/* Empty state */}
        {entries.length === 0 && (
          <div className="mt-16 text-center py-20">
            <Timer className="size-16 text-muted-foreground/30 mx-auto mb-6" />
            <h3 className="font-display text-xl font-bold text-muted-foreground mb-2">
              No solve times logged yet
            </h3>
            <p className="text-sm text-muted-foreground/70 font-sans max-w-md mx-auto">
              Use the form above to log how long each LeetCode problem takes you.
              Charts and insights will appear once you have entries.
            </p>
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

/* ─── Header ─── */

function Header({ username }: { username: string }) {
  return (
    <header>
      <p className="font-display text-sm font-bold text-neon mb-2 uppercase tracking-wide">
        Time Analytics
      </p>
      <h1 className="font-display text-4xl lg:text-5xl font-bold tracking-tight">
        Solve Time Tracker
      </h1>
      <p className="text-muted-foreground mt-3 font-sans">
        Log your solving times, track trends, and discover insights about your
        LeetCode performance
        {username ? ` as ${username}` : ""}.
      </p>
    </header>
  );
}

/* ─── Quick Entry Form ─── */

function QuickEntryForm({
  onAdd,
  syncing,
  onSync,
}: {
  onAdd: (entry: Omit<SolveEntry, "id">) => void;
  syncing: boolean;
  onSync: () => void;
}) {
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState<"Easy" | "Medium" | "Hard">(
    "Medium",
  );
  const [timeStr, setTimeStr] = useState("");
  const [date, setDate] = useState(todayISO());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const mins = parseInt(timeStr, 10);
    if (!title.trim() || isNaN(mins) || mins <= 0) {
      toast.error("Please fill in problem name and valid time");
      return;
    }
    onAdd({
      problemTitle: title.trim(),
      difficulty,
      timeMinutes: mins,
      date,
    });
    setTitle("");
    setTimeStr("");
    setDate(todayISO());
  };

  const diffBtn = (d: "Easy" | "Medium" | "Hard") => {
    const colors: Record<string, string> = {
      Easy: difficulty === d
        ? "bg-emerald-500/30 text-emerald-400 border-emerald-500/50 ring-1 ring-emerald-500/30"
        : "bg-white/5 text-muted-foreground border-white/10 hover:border-emerald-500/30",
      Medium: difficulty === d
        ? "bg-yellow-500/30 text-yellow-400 border-yellow-500/50 ring-1 ring-yellow-500/30"
        : "bg-white/5 text-muted-foreground border-white/10 hover:border-yellow-500/30",
      Hard: difficulty === d
        ? "bg-red-500/30 text-red-400 border-red-500/50 ring-1 ring-red-500/30"
        : "bg-white/5 text-muted-foreground border-white/10 hover:border-red-500/30",
    };
    return colors[d] ?? "";
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-6 bg-card border border-white/10 rounded-xl cursor-glow hover:border-neon/30 transition-all"
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-display text-sm font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
          <Plus className="size-4 text-neon" />
          Log Solve Time
        </h3>
        <button
          type="button"
          onClick={onSync}
          disabled={syncing}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neon/10 border border-neon/30 hover:border-neon/60 text-neon text-xs font-bold font-display uppercase tracking-wide hover:bg-neon/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-glow"
        >
          {syncing ? (
            <>
              <div className="size-3.5 border-2 border-neon border-t-transparent rounded-full animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="size-3.5 animate-pulse" />
              Sync LeetCode
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
        {/* Problem name */}
        <div className="md:col-span-4">
          <label className="text-xs font-sans text-muted-foreground mb-1.5 block">
            Problem Name
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Two Sum"
            className="w-full px-4 py-2.5 bg-background border border-white/10 rounded-lg text-sm font-sans focus:outline-none focus:border-neon focus:ring-1 focus:ring-neon/50 transition-all"
          />
        </div>

        {/* Difficulty */}
        <div className="md:col-span-3">
          <label className="text-xs font-sans text-muted-foreground mb-1.5 block">
            Difficulty
          </label>
          <div className="flex gap-2">
            {(["Easy", "Medium", "Hard"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDifficulty(d)}
                className={`flex-1 px-3 py-2.5 text-xs font-bold font-display uppercase rounded-lg border transition-all ${diffBtn(d)}`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Time */}
        <div className="md:col-span-2">
          <label className="text-xs font-sans text-muted-foreground mb-1.5 block">
            Time (minutes)
          </label>
          <input
            type="number"
            min="1"
            max="600"
            value={timeStr}
            onChange={(e) => setTimeStr(e.target.value)}
            placeholder="e.g. 25"
            className="w-full px-4 py-2.5 bg-background border border-white/10 rounded-lg text-sm font-sans focus:outline-none focus:border-neon focus:ring-1 focus:ring-neon/50 transition-all tabular-nums"
          />
        </div>

        {/* Date */}
        <div className="md:col-span-2">
          <label className="text-xs font-sans text-muted-foreground mb-1.5 block">
            Date
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-4 py-2.5 bg-background border border-white/10 rounded-lg text-sm font-sans focus:outline-none focus:border-neon focus:ring-1 focus:ring-neon/50 transition-all"
          />
        </div>

        {/* Submit */}
        <div className="md:col-span-1">
          <button
            type="submit"
            className="w-full px-4 py-2.5 bg-primary text-primary-foreground font-display text-sm font-bold tracking-wide rounded-lg hover:bg-primary/90 transition-all cursor-glow flex items-center justify-center gap-1.5"
          >
            <Plus className="size-4" />
            Log
          </button>
        </div>
      </div>

      {timeStr && parseInt(timeStr, 10) > 0 && (
        <p className="mt-3 text-xs text-muted-foreground font-sans">
          Time: <span className="text-neon font-semibold">{formatTimeVerbose(parseInt(timeStr, 10))}</span>
        </p>
      )}
    </form>
  );
}

/* ─── Summary Stats Cards ─── */

function SummaryStatsCards({ entries }: { entries: SolveEntry[] }) {
  const totalTime = entries.reduce((s, e) => s + e.timeMinutes, 0);
  const fastest = entries.reduce(
    (min, e) => (e.timeMinutes < min.timeMinutes ? e : min),
    entries[0]!,
  );
  const slowest = entries.reduce(
    (max, e) => (e.timeMinutes > max.timeMinutes ? e : max),
    entries[0]!,
  );

  const stats = [
    {
      label: "Total Time",
      value: formatTime(totalTime),
      sub: formatTimeVerbose(totalTime),
      icon: Clock,
      gradient: "from-blue-500/15 to-cyan-500/15",
      border: "border-blue-500/20",
      iconColor: "text-blue-400",
    },
    {
      label: "Problems Logged",
      value: entries.length.toString(),
      sub: `Across ${new Set(entries.map((e) => e.date)).size} days`,
      icon: Target,
      gradient: "from-purple-500/15 to-pink-500/15",
      border: "border-purple-500/20",
      iconColor: "text-purple-400",
    },
    {
      label: "Fastest Solve",
      value: formatTime(fastest.timeMinutes),
      sub: fastest.problemTitle,
      icon: Zap,
      gradient: "from-emerald-500/15 to-green-500/15",
      border: "border-emerald-500/20",
      iconColor: "text-emerald-400",
    },
    {
      label: "Slowest Solve",
      value: formatTime(slowest.timeMinutes),
      sub: slowest.problemTitle,
      icon: Timer,
      gradient: "from-red-500/15 to-orange-500/15",
      border: "border-red-500/20",
      iconColor: "text-red-400",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((s) => {
        const Icon = s.icon;
        return (
          <div
            key={s.label}
            className={`p-6 bg-gradient-to-br ${s.gradient} border ${s.border} rounded-xl cursor-glow hover:border-neon/40 transition-all`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground font-sans">
                {s.label}
              </h3>
              <Icon className={`size-5 ${s.iconColor}`} />
            </div>
            <div className="text-3xl font-display font-bold text-neon mb-1 tabular-nums">
              {s.value}
            </div>
            <p className="text-xs text-muted-foreground font-sans truncate">
              {s.sub}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Difficulty Average Bar Chart ─── */

function DifficultyAvgChart({ entries }: { entries: SolveEntry[] }) {
  const data = useMemo(() => {
    const grouped: Record<string, number[]> = {
      Easy: [],
      Medium: [],
      Hard: [],
    };
    entries.forEach((e) => grouped[e.difficulty]?.push(e.timeMinutes));

    return [
      {
        name: "Easy",
        avg: grouped.Easy.length
          ? Math.round(
              grouped.Easy.reduce((a, b) => a + b, 0) / grouped.Easy.length,
            )
          : 0,
        count: grouped.Easy.length,
        fill: "#34d399",
      },
      {
        name: "Medium",
        avg: grouped.Medium.length
          ? Math.round(
              grouped.Medium.reduce((a, b) => a + b, 0) /
                grouped.Medium.length,
            )
          : 0,
        count: grouped.Medium.length,
        fill: "#fbbf24",
      },
      {
        name: "Hard",
        avg: grouped.Hard.length
          ? Math.round(
              grouped.Hard.reduce((a, b) => a + b, 0) / grouped.Hard.length,
            )
          : 0,
        count: grouped.Hard.length,
        fill: "#f87171",
      },
    ];
  }, [entries]);

  return (
    <div className="p-6 bg-card border border-white/10 rounded-xl">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} barSize={60}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="name"
            tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12, fontFamily: "Poppins" }}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
          />
          <YAxis
            tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12, fontFamily: "Poppins" }}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            label={{
              value: "Minutes",
              angle: -90,
              position: "insideLeft",
              style: { fill: "rgba(255,255,255,0.4)", fontSize: 11 },
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(12,12,21,0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px",
              fontSize: "13px",
              fontFamily: "Poppins",
            }}
            formatter={(value: number, _name: string, props: any) => [
              `${value} min avg (${props.payload.count} problems)`,
              "Avg Time",
            ]}
            cursor={{ fill: "rgba(255,255,255,0.03)" }}
          />
          <Bar dataKey="avg" radius={[8, 8, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─── Daily Trend Area Chart ─── */

function DailyTrendChart({ entries }: { entries: SolveEntry[] }) {
  const data = useMemo(() => {
    const last30: { date: string; total: number; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const dateStr = daysAgoISO(i);
      const dayEntries = entries.filter((e) => e.date === dateStr);
      last30.push({
        date: dateStr,
        total: dayEntries.reduce((s, e) => s + e.timeMinutes, 0),
        count: dayEntries.length,
      });
    }
    return last30;
  }, [entries]);

  return (
    <div className="p-6 bg-card border border-white/10 rounded-xl">
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="timeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="oklch(0.68 0.28 330)" stopOpacity={0.4} />
              <stop offset="95%" stopColor="oklch(0.68 0.28 330)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="date"
            tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 10, fontFamily: "Poppins" }}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            tickFormatter={(v: string) => {
              const d = new Date(v + "T00:00:00");
              return `${d.getDate()} ${MONTH_LABELS[d.getMonth()]}`;
            }}
            interval={4}
          />
          <YAxis
            tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12, fontFamily: "Poppins" }}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            label={{
              value: "Minutes",
              angle: -90,
              position: "insideLeft",
              style: { fill: "rgba(255,255,255,0.4)", fontSize: 11 },
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(12,12,21,0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px",
              fontSize: "13px",
              fontFamily: "Poppins",
            }}
            formatter={(value: number, _name: string, props: any) => [
              `${formatTimeVerbose(value)} (${props.payload.count} problems)`,
              "Time Spent",
            ]}
            labelFormatter={(label: string) => {
              const d = new Date(label + "T00:00:00");
              return d.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              });
            }}
          />
          <Area
            type="monotone"
            dataKey="total"
            stroke="oklch(0.68 0.28 330)"
            strokeWidth={2.5}
            fill="url(#timeGradient)"
            dot={false}
            activeDot={{
              r: 5,
              fill: "oklch(0.68 0.28 330)",
              stroke: "#0c0c15",
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─── Weekly / Monthly Trends ─── */

function WeeklyMonthlyTrends({ entries }: { entries: SolveEntry[] }) {
  const [mode, setMode] = useState<"weekly" | "monthly">("weekly");

  const data = useMemo(() => {
    if (mode === "weekly") {
      // Last 8 weeks
      const weeks: {
        label: string;
        Easy: number;
        Medium: number;
        Hard: number;
      }[] = [];
      for (let w = 7; w >= 0; w--) {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - w * 7 - weekStart.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const startStr = weekStart.toISOString().slice(0, 10);
        const endStr = weekEnd.toISOString().slice(0, 10);

        const weekEntries = entries.filter(
          (e) => e.date >= startStr && e.date <= endStr,
        );
        weeks.push({
          label: `${weekStart.getDate()} ${MONTH_LABELS[weekStart.getMonth()]}`,
          Easy: weekEntries
            .filter((e) => e.difficulty === "Easy")
            .reduce((s, e) => s + e.timeMinutes, 0),
          Medium: weekEntries
            .filter((e) => e.difficulty === "Medium")
            .reduce((s, e) => s + e.timeMinutes, 0),
          Hard: weekEntries
            .filter((e) => e.difficulty === "Hard")
            .reduce((s, e) => s + e.timeMinutes, 0),
        });
      }
      return weeks;
    } else {
      // Last 6 months
      const months: {
        label: string;
        Easy: number;
        Medium: number;
        Hard: number;
      }[] = [];
      for (let m = 5; m >= 0; m--) {
        const d = new Date();
        d.setMonth(d.getMonth() - m);
        const year = d.getFullYear();
        const month = d.getMonth();
        const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;

        const monthEntries = entries.filter((e) => e.date.startsWith(prefix));
        months.push({
          label: `${MONTH_LABELS[month]} ${year.toString().slice(-2)}`,
          Easy: monthEntries
            .filter((e) => e.difficulty === "Easy")
            .reduce((s, e) => s + e.timeMinutes, 0),
          Medium: monthEntries
            .filter((e) => e.difficulty === "Medium")
            .reduce((s, e) => s + e.timeMinutes, 0),
          Hard: monthEntries
            .filter((e) => e.difficulty === "Hard")
            .reduce((s, e) => s + e.timeMinutes, 0),
        });
      }
      return months;
    }
  }, [entries, mode]);

  return (
    <div className="p-6 bg-card border border-white/10 rounded-xl">
      {/* Toggle */}
      <div className="flex gap-2 mb-6">
        {(["weekly", "monthly"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-4 py-2 text-xs font-display font-bold uppercase tracking-wide rounded-lg border transition-all ${
              mode === m
                ? "bg-neon/20 text-neon border-neon/40 ring-1 ring-neon/20"
                : "bg-white/5 text-muted-foreground border-white/10 hover:border-neon/30"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="label"
            tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 11, fontFamily: "Poppins" }}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
          />
          <YAxis
            tick={{ fill: "rgba(255,255,255,0.5)", fontSize: 12, fontFamily: "Poppins" }}
            axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            label={{
              value: "Minutes",
              angle: -90,
              position: "insideLeft",
              style: { fill: "rgba(255,255,255,0.4)", fontSize: 11 },
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "rgba(12,12,21,0.95)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "12px",
              fontSize: "13px",
              fontFamily: "Poppins",
            }}
            formatter={(value: number) => [`${formatTimeVerbose(value)}`, ""]}
          />
          <Bar dataKey="Easy" stackId="a" fill="#34d399" radius={[0, 0, 0, 0]} />
          <Bar dataKey="Medium" stackId="a" fill="#fbbf24" radius={[0, 0, 0, 0]} />
          <Bar dataKey="Hard" stackId="a" fill="#f87171" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-emerald-400" />
          <span className="text-xs text-muted-foreground font-sans">Easy</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-yellow-400" />
          <span className="text-xs text-muted-foreground font-sans">Medium</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-red-400" />
          <span className="text-xs text-muted-foreground font-sans">Hard</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Heatmap Calendar ─── */

function TimeHeatmapCalendar({ entries }: { entries: SolveEntry[] }) {
  const heatmapData = useMemo(() => {
    // Build a map of date → total minutes
    const dateMap: Record<string, number> = {};
    entries.forEach((e) => {
      dateMap[e.date] = (dateMap[e.date] ?? 0) + e.timeMinutes;
    });

    const today = new Date();
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    // Align to Sunday
    const start = new Date(oneYearAgo);
    start.setDate(start.getDate() - start.getDay());

    const weeks: { date: Date; dateStr: string; minutes: number }[][] = [];
    let currentWeek: { date: Date; dateStr: string; minutes: number }[] = [];

    for (
      let d = new Date(start);
      d <= today;
      d.setDate(d.getDate() + 1)
    ) {
      const date = new Date(d);
      const dateStr = date.toISOString().slice(0, 10);
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      currentWeek.push({
        date,
        dateStr,
        minutes: dateMap[dateStr] ?? 0,
      });
    }
    if (currentWeek.length > 0) weeks.push(currentWeek);

    // Month label positions
    const monthPositions: { label: string; weekIdx: number }[] = [];
    let lastMonth = -1;
    weeks.forEach((week, weekIdx) => {
      const firstDay = week[0];
      if (firstDay) {
        const month = firstDay.date.getMonth();
        if (month !== lastMonth) {
          monthPositions.push({
            label: MONTH_LABELS[month],
            weekIdx,
          });
          lastMonth = month;
        }
      }
    });

    return { weeks, monthPositions };
  }, [entries]);

  const getColor = (minutes: number) => {
    if (minutes === 0) return "bg-white/[0.04]";
    if (minutes < 15) return "bg-emerald-900/50";
    if (minutes < 30) return "bg-emerald-700/60";
    if (minutes < 60) return "bg-emerald-500/70";
    return "bg-neon/80";
  };

  const { weeks, monthPositions } = heatmapData;

  return (
    <div className="p-8 bg-card border border-white/10 rounded-xl overflow-x-auto">
      {/* Month labels */}
      <div className="inline-flex gap-1 min-w-min mb-1 ml-8">
        {(() => {
          const labels: React.ReactNode[] = [];
          let lastEnd = 0;
          monthPositions.forEach((mp, idx) => {
            const left = mp.weekIdx * 16;
            if (left >= lastEnd) {
              labels.push(
                <span
                  key={idx}
                  className="text-[10px] text-muted-foreground font-sans absolute"
                  style={{ left: `${left}px` }}
                >
                  {mp.label}
                </span>,
              );
              lastEnd = left + 28;
            }
          });
          return <div className="relative h-4 w-full">{labels}</div>;
        })()}
      </div>

      <div className="flex gap-0">
        {/* Day labels */}
        <div className="flex flex-col gap-1 mr-2 pt-0">
          {["", "Mon", "", "Wed", "", "Fri", ""].map((label, i) => (
            <div key={i} className="h-3 flex items-center">
              <span className="text-[10px] text-muted-foreground font-sans w-6">
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Grid */}
        <div className="inline-flex gap-1 min-w-min">
          {weeks.map((week, weekIdx) => (
            <div key={weekIdx} className="flex flex-col gap-1">
              {week.map((cell, dayIdx) => (
                <div
                  key={`${weekIdx}-${dayIdx}`}
                  className={`w-3 h-3 rounded-sm ${getColor(cell.minutes)} cursor-glow transition-all hover:ring-2 ring-neon/50`}
                  title={`${cell.date.toLocaleDateString()}: ${cell.minutes > 0 ? formatTimeVerbose(cell.minutes) : "No activity"}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between mt-6">
        <p className="text-xs text-muted-foreground font-sans">
          Past 12 months • Color = time spent solving
        </p>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground font-sans mr-1">
            Less
          </span>
          <div className="w-3 h-3 rounded-sm bg-white/[0.04]" />
          <div className="w-3 h-3 rounded-sm bg-emerald-900/50" />
          <div className="w-3 h-3 rounded-sm bg-emerald-700/60" />
          <div className="w-3 h-3 rounded-sm bg-emerald-500/70" />
          <div className="w-3 h-3 rounded-sm bg-neon/80" />
          <span className="text-xs text-muted-foreground font-sans ml-1">
            More
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Smart Insights Panel ─── */

function SmartInsightsPanel({ entries }: { entries: SolveEntry[] }) {
  const insights = useMemo(() => {
    const result: {
      icon: React.ReactNode;
      text: string;
      color: string;
    }[] = [];

    // Avg by difficulty
    const grouped: Record<string, number[]> = {
      Easy: [],
      Medium: [],
      Hard: [],
    };
    entries.forEach((e) => grouped[e.difficulty]?.push(e.timeMinutes));

    const avgs: Record<string, number> = {};
    for (const [d, times] of Object.entries(grouped)) {
      avgs[d] = times.length
        ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
        : 0;
    }

    // Which difficulty takes most time
    const maxDiff = Object.entries(avgs).sort((a, b) => b[1] - a[1])[0];
    if (maxDiff && maxDiff[1] > 0) {
      result.push({
        icon: <Timer className="size-5" />,
        text: `${maxDiff[0]} problems take the most time — avg ${formatTimeVerbose(maxDiff[1])}`,
        color: "text-amber-400",
      });
    }

    // This week vs last week for Easy
    const thisWeekStart = daysAgoISO(6);
    const lastWeekStart = daysAgoISO(13);
    const lastWeekEnd = daysAgoISO(7);

    for (const diff of ["Easy", "Medium", "Hard"] as const) {
      const thisWeek = entries.filter(
        (e) =>
          e.difficulty === diff &&
          e.date >= thisWeekStart,
      );
      const lastWeek = entries.filter(
        (e) =>
          e.difficulty === diff &&
          e.date >= lastWeekStart &&
          e.date < lastWeekEnd,
      );

      if (thisWeek.length >= 2 && lastWeek.length >= 2) {
        const thisAvg =
          thisWeek.reduce((s, e) => s + e.timeMinutes, 0) / thisWeek.length;
        const lastAvg =
          lastWeek.reduce((s, e) => s + e.timeMinutes, 0) / lastWeek.length;

        if (lastAvg > 0) {
          const pctChange = Math.round(
            ((lastAvg - thisAvg) / lastAvg) * 100,
          );
          if (pctChange > 5) {
            result.push({
              icon: <ArrowUp className="size-5" />,
              text: `You solve ${diff} problems ${pctChange}% faster this week`,
              color: "text-emerald-400",
            });
          } else if (pctChange < -5) {
            result.push({
              icon: <ArrowDown className="size-5" />,
              text: `${diff} problems are taking ${Math.abs(pctChange)}% longer this week`,
              color: "text-red-400",
            });
          }
        }
      }
    }

    // Most productive day of the week
    const dayTotals: Record<number, { total: number; count: number }> = {};
    entries.forEach((e) => {
      const day = new Date(e.date + "T00:00:00").getDay();
      if (!dayTotals[day]) dayTotals[day] = { total: 0, count: 0 };
      dayTotals[day].count++;
      dayTotals[day].total += e.timeMinutes;
    });
    const bestDay = Object.entries(dayTotals).sort(
      (a, b) => b[1].count - a[1].count,
    )[0];
    if (bestDay) {
      result.push({
        icon: <Trophy className="size-5" />,
        text: `Most productive day: ${DAY_NAMES_FULL[Number(bestDay[0])]}`,
        color: "text-neon",
      });
    }

    // Total this month
    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthEntries = entries.filter((e) => e.date.startsWith(thisMonth));
    if (monthEntries.length > 0) {
      const monthTotal = monthEntries.reduce(
        (s, e) => s + e.timeMinutes,
        0,
      );
      result.push({
        icon: <Brain className="size-5" />,
        text: `You've logged ${formatTimeVerbose(monthTotal)} this month across ${monthEntries.length} problems`,
        color: "text-blue-400",
      });
    }

    return result;
  }, [entries]);

  if (insights.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {insights.map((insight, idx) => (
        <div
          key={idx}
          className="p-5 bg-card border border-white/10 rounded-xl cursor-glow hover:border-neon/30 transition-all flex items-start gap-4"
        >
          <div
            className={`p-2.5 rounded-lg bg-white/5 ${insight.color} shrink-0`}
          >
            {insight.icon}
          </div>
          <p className="text-sm font-sans text-foreground/90 leading-relaxed">
            {insight.text}
          </p>
        </div>
      ))}
    </div>
  );
}

/* ─── Recent Entries Table ─── */

function RecentEntriesTable({
  entries,
  onDelete,
}: {
  entries: SolveEntry[];
  onDelete: (id: string) => void;
}) {
  const sorted = useMemo(
    () => [...entries].sort((a, b) => b.date.localeCompare(a.date)),
    [entries],
  );

  const diffBadge = (d: string) => {
    if (d === "Easy") return "bg-emerald-500/20 text-emerald-400";
    if (d === "Medium") return "bg-yellow-500/20 text-yellow-400";
    return "bg-red-500/20 text-red-400";
  };

  return (
    <div className="bg-card border border-white/10 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-white/[0.02] border-b border-white/[0.06] text-xs font-display font-bold uppercase tracking-wide text-muted-foreground">
        <div className="col-span-2">Date</div>
        <div className="col-span-4">Problem</div>
        <div className="col-span-2">Difficulty</div>
        <div className="col-span-2">Time</div>
        <div className="col-span-2 text-right">Action</div>
      </div>

      {/* Rows */}
      <div className="max-h-[400px] overflow-y-auto">
        {sorted.slice(0, 50).map((entry) => (
          <div
            key={entry.id}
            className="grid grid-cols-12 gap-4 px-6 py-3.5 border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors items-center"
          >
            <div className="col-span-2 text-xs text-muted-foreground font-sans tabular-nums">
              {new Date(entry.date + "T00:00:00").toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}
            </div>
            <div className="col-span-4 text-sm font-sans truncate">
              {entry.problemTitle}
            </div>
            <div className="col-span-2">
              <span
                className={`inline-block px-2 py-0.5 text-[10px] font-bold uppercase rounded ${diffBadge(entry.difficulty)}`}
              >
                {entry.difficulty}
              </span>
            </div>
            <div className="col-span-2 text-sm font-sans font-semibold text-neon tabular-nums">
              {formatTime(entry.timeMinutes)}
            </div>
            <div className="col-span-2 text-right">
              <button
                onClick={() => onDelete(entry.id)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all"
                title="Delete entry"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {sorted.length > 50 && (
        <div className="px-6 py-3 text-xs text-muted-foreground font-sans text-center border-t border-white/[0.06]">
          Showing first 50 of {sorted.length} entries
        </div>
      )}
    </div>
  );
}
