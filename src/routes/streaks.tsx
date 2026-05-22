import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Flame,
  TrendingUp,
  Calendar,
  Target,
  Zap,
  BarChart3,
  Award,
  Lightbulb,
  Clock,
  CheckCircle2,
  AlertCircle,
  Star,
  Timer,
  Trophy,
} from "lucide-react";

import { AppSidebar } from "@/components/AppSidebar";
import { UsernameDialog } from "@/components/UsernameDialog";
import { fetchLeetCodeProfile, type LCProfile } from "@/lib/leetcode.functions";

export const Route = createFileRoute("/streaks")({
  head: () => ({
    meta: [
      { title: "Streaks | grind.exe" },
      {
        name: "description",
        content: "Track your LeetCode solving streaks and milestones.",
      },
    ],
  }),
  component: StreaksComponent,
});

const STORAGE_KEY = "lc:username";

/* ─── helpers ─── */

/** Normalize a Date to midnight UTC and return its unix timestamp in seconds */
function startOfDayUTC(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  return Math.floor(d.getTime() / 1000);
}

/** Get submission count for a specific day from calendar */
function getSubmissionsForDay(
  calendar: Record<string, number> | undefined,
  date: Date,
): number {
  if (!calendar) return 0;
  const dayStart = startOfDayUTC(date);
  // Check the exact timestamp key
  if (calendar[String(dayStart)] !== undefined) {
    return calendar[String(dayStart)];
  }
  // Also scan keys that fall within this day (some APIs return non-midnight timestamps)
  const dayEnd = dayStart + 86400;
  let total = 0;
  for (const key of Object.keys(calendar)) {
    const ts = Number(key);
    if (ts >= dayStart && ts < dayEnd) {
      total += calendar[key];
    }
  }
  return total;
}

/** Sum submissions over a date range (inclusive of startDate, exclusive of endDate) */
function sumSubmissions(
  calendar: Record<string, number> | undefined,
  startDate: Date,
  days: number,
): number {
  if (!calendar) return 0;
  let total = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    total += getSubmissionsForDay(calendar, d);
  }
  return total;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* ─── Root component ─── */

function StreaksComponent() {
  const [username, setUsername] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [active] = useState("streaks");

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

  useEffect(() => {
    if (profileQ.error) toast.error(`Couldn't load LeetCode: ${(profileQ.error as Error).message}`);
  }, [profileQ.error]);

  const saveUsername = (u: string) => {
    localStorage.setItem(STORAGE_KEY, u);
    setUsername(u);
  };

  const profile = profileQ.data;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppSidebar
        active={active}
        onSelect={() => {}}
        onSettings={() => setDialogOpen(true)}
        avatarUrl={profile?.avatar}
      />
      <main className="ml-20 p-8 lg:p-12 max-w-[1400px]">
        <Header username={username} />

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Current Streak */}
          <section className="lg:col-span-1">
            <StreakShowcase streak={profile?.streak ?? 0} loading={profileQ.isLoading} />
          </section>

          {/* Stats */}
          <section className="lg:col-span-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <StatCard
                label="Best Streak"
                value={profile?.streak ?? 0}
                icon={Flame}
                color="text-red-400"
              />
              <StatCard
                label="Total Solved"
                value={profile?.totalSolved ?? 0}
                icon={TrendingUp}
                color="text-neon"
              />
            </div>
          </section>
        </div>

        {/* Weekly/Monthly Statistics Dashboard */}
        <section className="mt-12">
          <h2 className="font-display text-2xl font-bold mb-6 flex items-center gap-2">
            <BarChart3 className="size-6 text-neon" />
            Weekly &amp; Monthly Statistics
          </h2>
          <StatisticsDashboard profile={profile} loading={profileQ.isLoading} />
        </section>

        {/* Calendar Heatmap */}
        <section className="mt-12">
          <h2 className="font-display text-2xl font-bold mb-6 flex items-center gap-2">
            <Calendar className="size-6 text-neon" />
            Solving Heatmap
          </h2>
          <CalendarHeatmap profile={profile} loading={profileQ.isLoading} />
        </section>

        {/* Difficulty Breakdown */}
        <section className="mt-12">
          <h2 className="font-display text-2xl font-bold mb-6 flex items-center gap-2">
            <Target className="size-6 text-neon" />
            Difficulty Breakdown
          </h2>
          <DifficultyBreakdown profile={profile} loading={profileQ.isLoading} />
        </section>

        {/* Milestones */}
        <section className="mt-12">
          <h2 className="font-display text-2xl font-bold mb-6 flex items-center gap-2">
            <Flame className="size-6 text-neon" />
            Achievements &amp; Milestones
          </h2>
          <MilestonesList profile={profile} loading={profileQ.isLoading} />
        </section>

        {/* Challenge Suggestions */}
        <section className="mt-12">
          <h2 className="font-display text-2xl font-bold mb-6 flex items-center gap-2">
            <Lightbulb className="size-6 text-neon" />
            Personalized Challenges
          </h2>
          <ChallengeSuggestions profile={profile} loading={profileQ.isLoading} />
        </section>

        {/* Activity Timeline */}
        <section className="mt-12">
          <h2 className="font-display text-2xl font-bold mb-6 flex items-center gap-2">
            <Calendar className="size-6 text-neon" />
            Solving Timeline
          </h2>
          <ActivityTimeline profile={profile} loading={profileQ.isLoading} />
        </section>
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
      <p className="font-display text-sm font-bold text-neon mb-2 uppercase tracking-wide">Streaks</p>
      <h1 className="font-display text-4xl lg:text-5xl font-bold tracking-tight">
        Your Journey
      </h1>
      <p className="text-muted-foreground mt-3 font-sans">
        Track your solving streaks, milestones, and achievements as you progress through LeetCode.
      </p>
    </header>
  );
}

/* ─── StreakShowcase ─── */

function StreakShowcase({ streak, loading }: { streak: number; loading: boolean }) {
  const MAX_STREAK = 365;
  const percentage = Math.min((streak / MAX_STREAK) * 100, 100);

  return (
    <div className="bg-gradient-to-br from-neon/20 to-primary/20 border border-neon/50 rounded-3xl p-12 text-center cursor-glow">
      <div className="flex justify-center mb-6">
        <Flame className="size-16 text-neon" />
      </div>
      <h3 className="font-display text-sm font-bold text-muted-foreground mb-3 uppercase">
        Current Streak
      </h3>
      <div className="text-7xl font-display font-bold text-neon tabular-nums mb-2">
        {loading ? "—" : streak}
      </div>
      <p className="text-muted-foreground font-sans mb-6">days in a row</p>

      <div className="w-full h-4 bg-white/10 rounded-full overflow-hidden mb-4">
        <div
          className="h-full bg-gradient-to-r from-neon to-primary shadow-neon transition-all duration-700"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground font-sans">
        {streak} / {MAX_STREAK} day goal
      </p>

      {streak > 0 && (
        <div className="mt-6 p-4 bg-white/5 border border-white/10 rounded-lg">
          <p className="text-sm font-sans text-emerald-400">
            🎉 Keep the momentum! Solve one more today!
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── StatCard ─── */

function StatCard({
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
    <div className="p-6 bg-card border border-white/10 rounded-lg cursor-glow hover:border-neon transition-all">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground font-sans">
          {label}
        </h3>
        {Icon && <Icon className={`size-5 ${color || "text-neon"}`} />}
      </div>
      <div className="text-4xl font-display font-bold">{value}</div>
    </div>
  );
}

/* ─── StatisticsDashboard – uses real submissionCalendar data ─── */

function StatisticsDashboard({ profile, loading }: { profile?: LCProfile; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="p-6 bg-white/5 border border-white/10 rounded-lg animate-pulse h-32" />
        ))}
      </div>
    );
  }

  if (!profile) {
    return <div className="text-center py-12 text-muted-foreground font-sans">Link your account to see statistics</div>;
  }

  const today = new Date();

  // Compute real weekly solved from submissionCalendar
  const weekStartDate = new Date(today);
  weekStartDate.setDate(today.getDate() - 6); // past 7 days including today
  const weeklySolved = sumSubmissions(profile.submissionCalendar, weekStartDate, 7);

  // Compute real monthly solved from submissionCalendar
  const monthStartDate = new Date(today);
  monthStartDate.setDate(today.getDate() - 29); // past 30 days including today
  const monthlySolved = sumSubmissions(profile.submissionCalendar, monthStartDate, 30);

  const weeklyAvg = (weeklySolved / 7).toFixed(1);
  const monthlyAvg = (monthlySolved / 30).toFixed(1);

  const stats = [
    {
      label: "Past 7 Days",
      primary: weeklySolved.toString(),
      secondary: `${weeklyAvg} per day`,
      icon: "📊",
      gradient: "from-blue-500/20 to-cyan-500/20",
      borderColor: "border-blue-500/30",
    },
    {
      label: "Past 30 Days",
      primary: monthlySolved.toString(),
      secondary: `${monthlyAvg} per day`,
      icon: "📈",
      gradient: "from-purple-500/20 to-pink-500/20",
      borderColor: "border-purple-500/30",
    },
    {
      label: "Next Milestone",
      primary: `${Math.floor(profile.totalSolved / 100) * 100 + 100}`,
      secondary: `${100 - (profile.totalSolved % 100)} problems away`,
      icon: "🎯",
      gradient: "from-amber-500/20 to-orange-500/20",
      borderColor: "border-amber-500/30",
    },
    {
      label: "Streak Status",
      primary: profile.streak.toString(),
      secondary: `${Math.max(30 - profile.streak, 0)} days to 30-day goal`,
      icon: "🔥",
      gradient: "from-red-500/20 to-orange-500/20",
      borderColor: "border-red-500/30",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {stats.map((stat, idx) => (
        <div
          key={idx}
          className={`relative p-8 bg-gradient-to-br ${stat.gradient} border ${stat.borderColor} rounded-xl cursor-glow transition-all hover:border-opacity-60`}
        >
          <div className="absolute top-0 right-0 w-24 h-24 opacity-10 text-4xl flex items-center justify-center">
            {stat.icon}
          </div>
          <div className="relative z-10">
            <h3 className="font-display text-sm font-bold uppercase tracking-wide text-muted-foreground mb-4">
              {stat.label}
            </h3>
            <div className="text-5xl font-display font-bold text-neon mb-2">{stat.primary}</div>
            <p className="text-sm text-muted-foreground font-sans">{stat.secondary}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── CalendarHeatmap – uses real submissionCalendar data ─── */

function CalendarHeatmap({ profile, loading }: { profile?: LCProfile; loading: boolean }) {
  const heatmapData = useMemo(() => {
    if (!profile) return null;

    const today = new Date();
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    // Align to the start of the week (Sunday)
    const start = new Date(oneYearAgo);
    start.setDate(start.getDate() - start.getDay());

    const weeks: { date: Date; count: number }[][] = [];
    let currentWeek: { date: Date; count: number }[] = [];
    let maxCount = 0;

    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      const date = new Date(d);
      const count = getSubmissionsForDay(profile.submissionCalendar, date);
      if (count > maxCount) maxCount = count;

      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      currentWeek.push({ date, count });
    }
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    // Compute month label positions
    const monthPositions: { label: string; weekIdx: number }[] = [];
    let lastMonth = -1;
    weeks.forEach((week, weekIdx) => {
      // Use the first day of the week to determine the month
      const firstDay = week[0];
      if (firstDay) {
        const month = firstDay.date.getMonth();
        if (month !== lastMonth) {
          monthPositions.push({ label: MONTH_LABELS[month], weekIdx });
          lastMonth = month;
        }
      }
    });

    return { weeks, maxCount, monthPositions };
  }, [profile]);

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground font-sans">Loading heatmap...</div>;
  }

  if (!profile || !heatmapData) {
    return <div className="text-center py-12 text-muted-foreground font-sans">Link your account to see heatmap</div>;
  }

  const { weeks, maxCount, monthPositions } = heatmapData;

  const getColor = (count: number) => {
    if (count === 0) return "bg-white/5";
    if (maxCount === 0) return "bg-white/5";
    const ratio = count / maxCount;
    if (ratio <= 0.25) return "bg-green-900/50";
    if (ratio <= 0.5) return "bg-green-700/60";
    if (ratio <= 0.75) return "bg-green-500/70";
    return "bg-neon/80";
  };

  return (
    <div className="p-8 bg-card border border-white/10 rounded-lg overflow-x-auto">
      {/* Month labels */}
      <div className="inline-flex gap-1 min-w-min mb-1 ml-8">
        {(() => {
          const labels: React.ReactNode[] = [];
          let lastEnd = 0;
          monthPositions.forEach((mp, idx) => {
            const offset = mp.weekIdx;
            // Each cell is 12px (w-3) + 4px gap = 16px
            const left = offset * 16;
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
              <span className="text-[10px] text-muted-foreground font-sans w-6">{label}</span>
            </div>
          ))}
        </div>

        {/* Heatmap grid */}
        <div className="inline-flex gap-1 min-w-min">
          {weeks.map((week, weekIdx) => (
            <div key={weekIdx} className="flex flex-col gap-1">
              {week.map((cell, dayIdx) => (
                <div
                  key={`${weekIdx}-${dayIdx}`}
                  className={`w-3 h-3 rounded-sm ${getColor(cell.count)} cursor-glow transition-all hover:ring-2 ring-neon/50`}
                  title={`${cell.date.toLocaleDateString()}: ${cell.count} submission${cell.count !== 1 ? "s" : ""}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between mt-6">
        <p className="text-xs text-muted-foreground font-sans">
          Past 12 months of activity. Hover for details.
        </p>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground font-sans mr-1">Less</span>
          <div className="w-3 h-3 rounded-sm bg-white/5" />
          <div className="w-3 h-3 rounded-sm bg-green-900/50" />
          <div className="w-3 h-3 rounded-sm bg-green-700/60" />
          <div className="w-3 h-3 rounded-sm bg-green-500/70" />
          <div className="w-3 h-3 rounded-sm bg-neon/80" />
          <span className="text-xs text-muted-foreground font-sans ml-1">More</span>
        </div>
      </div>
    </div>
  );
}

/* ─── DifficultyBreakdown – with SVG donut charts ─── */

function DonutChart({
  solved,
  total,
  strokeColor,
  size = 100,
}: {
  solved: number;
  total: number;
  strokeColor: string;
  size?: number;
}) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = total > 0 ? (solved / total) * 100 : 0;
  const offset = circumference - (percentage / 100) * circumference;
  const center = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
      {/* Background ring */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        className="text-white/10"
      />
      {/* Progress ring */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={strokeColor}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-1000"
      />
      {/* Center text */}
      <text
        x={center}
        y={center}
        textAnchor="middle"
        dominantBaseline="central"
        className="transform rotate-90 origin-center fill-current text-foreground font-display"
        fontSize="16"
        fontWeight="bold"
      >
        {Math.round(percentage)}%
      </text>
    </svg>
  );
}

function DifficultyBreakdown({ profile, loading }: { profile?: LCProfile; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[0, 1, 2].map((i) => (
          <div key={i} className="p-6 bg-white/5 border border-white/10 rounded-lg animate-pulse h-64" />
        ))}
      </div>
    );
  }

  if (!profile) {
    return <div className="text-center py-12 text-muted-foreground font-sans">Link your account to see breakdown</div>;
  }

  const difficulties = [
    {
      name: "Easy",
      solved: profile.easySolved,
      total: profile.totalQuestions.easy,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/20",
      borderColor: "border-emerald-500/30",
      strokeColor: "#34d399",
      icon: "🌱",
    },
    {
      name: "Medium",
      solved: profile.mediumSolved,
      total: profile.totalQuestions.medium,
      color: "text-amber-400",
      bgColor: "bg-amber-500/20",
      borderColor: "border-amber-500/30",
      strokeColor: "#fbbf24",
      icon: "⚡",
    },
    {
      name: "Hard",
      solved: profile.hardSolved,
      total: profile.totalQuestions.hard,
      color: "text-red-400",
      bgColor: "bg-red-500/20",
      borderColor: "border-red-500/30",
      strokeColor: "#f87171",
      icon: "💎",
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {difficulties.map((diff, idx) => {
        const percentage = diff.total > 0 ? (diff.solved / diff.total) * 100 : 0;

        return (
          <div
            key={idx}
            className={`relative p-8 border rounded-lg cursor-glow transition-all ${diff.bgColor} ${diff.borderColor} hover:border-opacity-60`}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-display text-sm font-bold uppercase tracking-wide text-muted-foreground mb-2">
                  {diff.name}
                </h3>
                <div className={`text-3xl font-display font-bold ${diff.color}`}>
                  {diff.solved}/{diff.total}
                </div>
              </div>
              <span className="text-3xl">{diff.icon}</span>
            </div>

            {/* Donut chart */}
            <div className="flex justify-center my-4">
              <DonutChart
                solved={diff.solved}
                total={diff.total}
                strokeColor={diff.strokeColor}
                size={110}
              />
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-xs text-muted-foreground font-sans">Progress</span>
                  <span className={`text-xs font-bold ${diff.color}`}>{Math.round(percentage)}%</span>
                </div>
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${percentage}%`,
                      backgroundColor: diff.strokeColor,
                    }}
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-white/10">
                <p className="text-xs text-muted-foreground font-sans">
                  {diff.total - diff.solved} remaining
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── MilestonesList – expanded with XP / level system ─── */

function MilestonesList({ profile, loading }: { profile?: LCProfile; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="p-6 bg-white/5 border border-white/10 rounded-lg animate-pulse h-20" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-4 bg-white/5 border border-white/10 rounded-lg animate-pulse h-24" />
          ))}
        </div>
      </div>
    );
  }

  const hasTopicMaster = (profile?.topTags ?? []).some((t) => t.problemsSolved >= 50);

  const milestones = [
    {
      title: "First Solve",
      description: "Solve your first problem",
      achieved: (profile?.totalSolved ?? 0) > 0,
      progress: Math.min(profile?.totalSolved ?? 0, 1),
      target: 1,
      icon: "🎯",
    },
    {
      title: "10 Problems",
      description: "Solve 10 problems",
      achieved: (profile?.totalSolved ?? 0) >= 10,
      progress: Math.min(profile?.totalSolved ?? 0, 10),
      target: 10,
      icon: "📈",
    },
    {
      title: "50 Problems",
      description: "Solve 50 problems",
      achieved: (profile?.totalSolved ?? 0) >= 50,
      progress: Math.min(profile?.totalSolved ?? 0, 50),
      target: 50,
      icon: "🌟",
    },
    {
      title: "Century Club",
      description: "Solve 100 problems",
      achieved: (profile?.totalSolved ?? 0) >= 100,
      progress: Math.min(profile?.totalSolved ?? 0, 100),
      target: 100,
      icon: "👑",
    },
    {
      title: "500 Club",
      description: "Solve 500 problems",
      achieved: (profile?.totalSolved ?? 0) >= 500,
      progress: Math.min(profile?.totalSolved ?? 0, 500),
      target: 500,
      icon: "💫",
    },
    {
      title: "Easy Master",
      description: "Solve 50 easy problems",
      achieved: (profile?.easySolved ?? 0) >= 50,
      progress: Math.min(profile?.easySolved ?? 0, 50),
      target: 50,
      icon: "🌱",
    },
    {
      title: "Medium Challenger",
      description: "Solve 30 medium problems",
      achieved: (profile?.mediumSolved ?? 0) >= 30,
      progress: Math.min(profile?.mediumSolved ?? 0, 30),
      target: 30,
      icon: "⚡",
    },
    {
      title: "Hard Conqueror",
      description: "Solve 20 hard problems",
      achieved: (profile?.hardSolved ?? 0) >= 20,
      progress: Math.min(profile?.hardSolved ?? 0, 20),
      target: 20,
      icon: "💎",
    },
    {
      title: "All Rounder",
      description: "At least 10 in each difficulty",
      achieved:
        (profile?.easySolved ?? 0) >= 10 &&
        (profile?.mediumSolved ?? 0) >= 10 &&
        (profile?.hardSolved ?? 0) >= 10,
      progress: Math.min(
        profile?.easySolved ?? 0,
        profile?.mediumSolved ?? 0,
        profile?.hardSolved ?? 0,
        10,
      ),
      target: 10,
      icon: "🎲",
    },
    {
      title: "7-Day Streak",
      description: "Maintain a 7-day streak",
      achieved: (profile?.streak ?? 0) >= 7,
      progress: Math.min(profile?.streak ?? 0, 7),
      target: 7,
      icon: "🔥",
    },
    {
      title: "Speed Demon",
      description: "Maintain a 14-day streak",
      achieved: (profile?.streak ?? 0) >= 14,
      progress: Math.min(profile?.streak ?? 0, 14),
      target: 14,
      icon: "⚡",
    },
    {
      title: "30-Day Streak",
      description: "Maintain a 30-day streak",
      achieved: (profile?.streak ?? 0) >= 30,
      progress: Math.min(profile?.streak ?? 0, 30),
      target: 30,
      icon: "🚀",
    },
    {
      title: "Consistency King",
      description: "30+ total active days",
      achieved: (profile?.totalActiveDays ?? 0) >= 30,
      progress: Math.min(profile?.totalActiveDays ?? 0, 30),
      target: 30,
      icon: "📅",
    },
    {
      title: "Topic Master",
      description: "50+ solved in any topic tag",
      achieved: hasTopicMaster,
      progress: hasTopicMaster
        ? 50
        : Math.max(...(profile?.topTags ?? []).map((t) => Math.min(t.problemsSolved, 50)), 0),
      target: 50,
      icon: "🏆",
    },
  ];

  const achievedCount = milestones.filter((m) => m.achieved).length;
  const totalXP = achievedCount * 50;
  const level = Math.floor(totalXP / 200) + 1;
  const xpInLevel = totalXP % 200;
  const xpToNextLevel = 200;

  return (
    <div className="space-y-6">
      {/* XP & Level header */}
      <div className="p-6 bg-gradient-to-br from-neon/10 to-primary/10 border border-neon/30 rounded-xl cursor-glow transition-all">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-neon/20 border-2 border-neon flex items-center justify-center">
              <Star className="size-7 text-neon" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-sans uppercase tracking-wide">Level</p>
              <p className="text-3xl font-display font-bold text-neon">{level}</p>
            </div>
          </div>

          <div className="flex-1 w-full">
            <div className="flex justify-between mb-2">
              <span className="text-sm font-sans text-muted-foreground">
                {totalXP} XP total ({achievedCount}/{milestones.length} achievements)
              </span>
              <span className="text-sm font-bold text-neon font-sans">
                {xpInLevel}/{xpToNextLevel} XP to level {level + 1}
              </span>
            </div>
            <div className="w-full h-3 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-neon to-primary shadow-neon transition-all duration-700 rounded-full"
                style={{ width: `${(xpInLevel / xpToNextLevel) * 100}%` }}
              />
            </div>
          </div>

          <div className="text-center px-4">
            <p className="text-xs text-muted-foreground font-sans uppercase tracking-wide">Per Milestone</p>
            <p className="text-xl font-display font-bold text-amber-400">+50 XP</p>
          </div>
        </div>
      </div>

      {/* Milestone cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {milestones.map((milestone) => {
          const progressPercent = milestone.target > 0 ? (milestone.progress / milestone.target) * 100 : 0;

          return (
            <div
              key={milestone.title}
              className={`p-6 border rounded-lg cursor-glow transition-all ${
                milestone.achieved
                  ? "bg-neon/10 border-neon shadow-neon"
                  : "bg-card border-white/10 hover:border-white/20"
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-3xl">{milestone.icon}</span>
                {milestone.achieved && <CheckCircle2 className="size-5 text-neon" />}
              </div>
              <h3 className="font-display text-sm font-bold uppercase mb-1 tracking-wide">
                {milestone.title}
              </h3>
              <p className="text-xs text-muted-foreground mb-3 font-sans">
                {milestone.description}
              </p>

              {/* Mini progress bar */}
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    milestone.achieved ? "bg-neon" : "bg-white/30"
                  }`}
                  style={{ width: `${Math.min(progressPercent, 100)}%` }}
                />
              </div>

              <div className={`text-lg font-display font-bold ${milestone.achieved ? "text-neon" : "text-muted-foreground"}`}>
                {milestone.achieved ? "✓ +50 XP" : `${milestone.progress}/${milestone.target}`}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── ChallengeSuggestions – with daily countdown, speed run, topic deep dive ─── */

function DailyCountdown() {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const midnight = new Date(now);
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight.getTime() - now.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(
        `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="col-span-full p-6 bg-gradient-to-br from-neon/20 to-primary/10 border border-neon/40 rounded-xl cursor-glow transition-all hover:border-neon">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-neon/20 border border-neon/50 flex items-center justify-center">
            <Timer className="size-6 text-neon" />
          </div>
          <div>
            <h3 className="font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">
              Daily Challenge
            </h3>
            <p className="text-sm text-muted-foreground font-sans">
              Solve today's daily problem before reset
            </p>
          </div>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground font-sans uppercase tracking-wide mb-1">
            Resets in
          </p>
          <div className="text-3xl font-display font-bold text-neon tabular-nums">
            {timeLeft}
          </div>
        </div>
        <a
          href="https://leetcode.com/problemset/"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-neon/20 border border-neon/50 rounded-lg hover:bg-neon/30 transition-all text-neon font-bold text-sm font-sans"
        >
          Go to LeetCode →
        </a>
      </div>
    </div>
  );
}

function ChallengeSuggestions({ profile, loading }: { profile?: LCProfile; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="p-6 bg-white/5 border border-white/10 rounded-lg animate-pulse h-32" />
        ))}
      </div>
    );
  }

  if (!profile) {
    return <div className="text-center py-12 text-muted-foreground font-sans">Link your account to see challenges</div>;
  }

  const easyPercentage = profile.totalQuestions.easy > 0 ? (profile.easySolved / profile.totalQuestions.easy) * 100 : 0;
  const mediumPercentage = profile.totalQuestions.medium > 0 ? (profile.mediumSolved / profile.totalQuestions.medium) * 100 : 0;
  const hardPercentage = profile.totalQuestions.hard > 0 ? (profile.hardSolved / profile.totalQuestions.hard) * 100 : 0;

  // Find weakest tag for "Topic Deep Dive"
  const sortedTags = [...(profile.topTags ?? [])].sort((a, b) => a.problemsSolved - b.problemsSolved);
  const weakestTag = sortedTags.length > 0 ? sortedTags[0] : null;

  const challenges = [];

  // Speed Run challenge
  challenges.push({
    title: "Speed Run",
    description: "Solve 3 problems within 1 hour. Test your speed!",
    difficulty: "Speed",
    icon: "⚡",
    reward: "+30 XP",
    color: "from-cyan-500/20 to-blue-500/20",
    borderColor: "border-cyan-500/30",
    progress: 0,
    extra: null as string | null,
    href: "https://leetcode.com/problemset/all/",
  });

  // Topic Deep Dive
  if (weakestTag) {
    challenges.push({
      title: "Topic Deep Dive",
      description: `Strengthen your weakest area: solve 5 more "${weakestTag.tagName}" problems`,
      difficulty: weakestTag.tagName,
      icon: "🔬",
      reward: "+20 XP",
      color: "from-violet-500/20 to-purple-500/20",
      borderColor: "border-violet-500/30",
      progress: Math.min((weakestTag.problemsSolved / (weakestTag.problemsSolved + 5)) * 100, 100),
      extra: `Current: ${weakestTag.problemsSolved} solved`,
      href: `https://leetcode.com/tag/${weakestTag.tagName.toLowerCase().replace(/ /g, '-')}/`,
    });
  }

  if (easyPercentage < 50) {
    challenges.push({
      title: "Easy Foundation",
      description: "Complete 10 more easy problems this week",
      difficulty: "Easy",
      icon: "🌱",
      reward: "+5 XP",
      color: "from-emerald-500/20 to-teal-500/20",
      borderColor: "border-emerald-500/30",
      progress: easyPercentage,
      extra: null,
      href: "https://leetcode.com/problemset/all/?difficulty=EASY",
    });
  }

  if (mediumPercentage < 40) {
    challenges.push({
      title: "Medium Mastery",
      description: "Solve 5 medium problems in the next 3 days",
      difficulty: "Medium",
      icon: "🔥",
      reward: "+10 XP",
      color: "from-amber-500/20 to-orange-500/20",
      borderColor: "border-amber-500/30",
      progress: mediumPercentage,
      extra: null,
      href: "https://leetcode.com/problemset/all/?difficulty=MEDIUM",
    });
  } else {
    challenges.push({
      title: "Hard Challenge",
      description: `Solve ${Math.min(5, profile.totalQuestions.hard - profile.hardSolved)} hard problems this month`,
      difficulty: "Hard",
      icon: "💎",
      reward: "+20 XP",
      color: "from-red-500/20 to-pink-500/20",
      borderColor: "border-red-500/30",
      progress: hardPercentage,
      extra: null,
      href: "https://leetcode.com/problemset/all/?difficulty=HARD",
    });
  }

  if (profile.streak < 7) {
    challenges.push({
      title: "Week Warrior",
      description: "Maintain a 7-day solving streak",
      difficulty: "Streak",
      icon: "🔥",
      reward: "+15 XP",
      color: "from-orange-500/20 to-red-500/20",
      borderColor: "border-orange-500/30",
      progress: (profile.streak / 7) * 100,
      extra: null,
      href: "https://leetcode.com/problemset/all/",
    });
  }

  if (challenges.length < 4) {
    challenges.push({
      title: "Problem Solver",
      description: `Solve ${Math.ceil((profile.totalQuestions.medium + profile.totalQuestions.hard) * 0.1)} more problems to unlock new achievements`,
      difficulty: "Daily",
      icon: "🎯",
      reward: "+25 XP",
      color: "from-purple-500/20 to-pink-500/20",
      borderColor: "border-purple-500/30",
      progress:
        (profile.totalSolved /
          (profile.totalQuestions.easy + profile.totalQuestions.medium + profile.totalQuestions.hard)) *
        100,
      extra: null,
      href: "https://leetcode.com/problemset/all/",
    });
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Daily Countdown */}
      <DailyCountdown />

      {/* Challenge cards */}
      {challenges.slice(0, 6).map((challenge, idx) => (
        <div
          key={idx}
          className={`relative p-6 bg-gradient-to-br ${challenge.color} border ${challenge.borderColor} rounded-lg cursor-glow transition-all hover:border-opacity-60 group flex flex-col justify-between`}
        >
          <div>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-display text-sm font-bold uppercase tracking-wide text-muted-foreground mb-1">
                  {challenge.title}
                </h3>
                <p className="text-xs text-muted-foreground font-sans">{challenge.difficulty}</p>
              </div>
              <span className="text-2xl">{challenge.icon}</span>
            </div>

            <p className="text-sm text-foreground mb-2 font-sans">{challenge.description}</p>
            {challenge.extra && (
              <p className="text-xs text-muted-foreground font-sans mb-2">{challenge.extra}</p>
            )}
          </div>

          <div className="space-y-3 mt-4">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-xs text-muted-foreground font-sans">Progress</span>
                <span className="text-xs text-neon font-bold">{Math.min(Math.round(challenge.progress), 100)}%</span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-neon to-primary transition-all duration-700"
                  style={{ width: `${Math.min(challenge.progress, 100)}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <span className="text-xs font-bold text-neon">{challenge.reward}</span>
              <a
                href={challenge.href}
                target="_blank"
                rel="noreferrer"
                className="text-xs px-3 py-1 bg-neon/20 border border-neon/50 rounded hover:bg-neon/30 transition-all text-neon font-bold"
              >
                Start
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── ActivityTimeline – 14-day SVG bar chart ─── */

function ActivityTimeline({ profile, loading }: { profile?: LCProfile; loading: boolean }) {
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  const chartData = useMemo(() => {
    if (!profile) return null;

    const today = new Date();
    const days: { date: Date; count: number; label: string }[] = [];

    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const count = getSubmissionsForDay(profile.submissionCalendar, d);
      days.push({
        date: d,
        count,
        label: DAY_LABELS[d.getDay()],
      });
    }

    const maxCount = Math.max(...days.map((d) => d.count), 1);

    return { days, maxCount };
  }, [profile]);

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground font-sans">Loading timeline...</div>;
  }

  if (!profile || !chartData) {
    return <div className="text-center py-12 text-muted-foreground font-sans">Link your account to see timeline</div>;
  }

  const { days, maxCount } = chartData;

  const chartWidth = 700;
  const chartHeight = 250;
  const paddingTop = 30;
  const paddingBottom = 40;
  const paddingLeft = 10;
  const paddingRight = 10;
  const barAreaWidth = chartWidth - paddingLeft - paddingRight;
  const barAreaHeight = chartHeight - paddingTop - paddingBottom;
  const barWidth = barAreaWidth / days.length;
  const barGap = 8;
  const actualBarWidth = barWidth - barGap;

  return (
    <div className="p-8 bg-card border border-white/10 rounded-lg cursor-glow transition-all hover:border-neon/30">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground font-sans">Daily submissions over the past 14 days</p>
        <p className="text-sm font-sans">
          <span className="text-muted-foreground">Total: </span>
          <span className="text-neon font-bold">{days.reduce((s, d) => s + d.count, 0)}</span>
        </p>
      </div>

      <svg
        width="100%"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="overflow-visible"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = paddingTop + barAreaHeight * (1 - ratio);
          return (
            <line
              key={ratio}
              x1={paddingLeft}
              y1={y}
              x2={chartWidth - paddingRight}
              y2={y}
              stroke="currentColor"
              strokeOpacity={0.07}
              strokeWidth={1}
            />
          );
        })}

        {/* Bars */}
        {days.map((day, i) => {
          const x = paddingLeft + i * barWidth + barGap / 2;
          const barHeight = maxCount > 0 ? (day.count / maxCount) * barAreaHeight : 0;
          const y = paddingTop + barAreaHeight - barHeight;
          const isHovered = hoveredBar === i;

          return (
            <g
              key={i}
              onMouseEnter={() => setHoveredBar(i)}
              onMouseLeave={() => setHoveredBar(null)}
              className="cursor-pointer"
            >
              {/* Invisible hit area */}
              <rect
                x={x}
                y={paddingTop}
                width={actualBarWidth}
                height={barAreaHeight}
                fill="transparent"
              />

              {/* Bar */}
              <rect
                x={x}
                y={y}
                width={actualBarWidth}
                height={Math.max(barHeight, 2)}
                rx={3}
                ry={3}
                fill={isHovered ? "oklch(0.78 0.25 330)" : "oklch(0.68 0.28 330)"}
                fillOpacity={isHovered ? 0.9 : day.count > 0 ? 0.7 : 0.15}
                className="transition-all duration-200"
              />

              {/* Glow effect on hover */}
              {isHovered && day.count > 0 && (
                <rect
                  x={x - 2}
                  y={y - 2}
                  width={actualBarWidth + 4}
                  height={barHeight + 4}
                  rx={4}
                  ry={4}
                  fill="none"
                  stroke="oklch(0.68 0.28 330)"
                  strokeOpacity={0.4}
                  strokeWidth={2}
                />
              )}

              {/* Count above bar */}
              <text
                x={x + actualBarWidth / 2}
                y={y - 6}
                textAnchor="middle"
                className="fill-current font-display"
                fontSize="11"
                fontWeight="bold"
                fill={isHovered ? "oklch(0.78 0.25 330)" : "oklch(0.68 0.28 330)"}
                fillOpacity={day.count > 0 || isHovered ? 1 : 0}
              >
                {day.count}
              </text>

              {/* Day label */}
              <text
                x={x + actualBarWidth / 2}
                y={chartHeight - paddingBottom + 16}
                textAnchor="middle"
                className="fill-current"
                fontSize="10"
                fill="currentColor"
                fillOpacity={0.5}
              >
                {day.label}
              </text>

              {/* Date label (shown on hover) */}
              {isHovered && (
                <text
                  x={x + actualBarWidth / 2}
                  y={chartHeight - paddingBottom + 30}
                  textAnchor="middle"
                  className="fill-current"
                  fontSize="9"
                  fill="oklch(0.68 0.28 330)"
                >
                  {day.date.getDate()}/{day.date.getMonth() + 1}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
