import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import {
  Settings as SettingsIcon,
  Save,
  AlertCircle,
  Download,
  Copy,
  Palette,
  Bell,
  Eye,
  Zap,
  Check,
  ExternalLink,
  Keyboard,
  Info,
  Sliders,
  User,
  Shield,
  Github,
  Trophy,
  Flame,
  Target,
  Mail,
  BarChart3,
  Sparkles,
  Monitor,
} from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { AppSidebar } from "@/components/AppSidebar";
import { UsernameDialog } from "@/components/UsernameDialog";
import { fetchLeetCodeProfile, type LCProfile } from "@/lib/leetcode.functions";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings | grind.exe" },
      {
        name: "description",
        content: "Manage your LeetCode account and application settings.",
      },
    ],
  }),
  component: SettingsComponent,
});

const STORAGE_KEY = "lc:username";
const SETTINGS_KEY = "lc:settings";

type TabId = "account" | "appearance" | "notifications" | "about";

interface AppSettings {
  accentColor: string;
  compactMode: boolean;
  animationsEnabled: boolean;
  dailyReminder: boolean;
  streakAlerts: boolean;
  milestoneNotifications: boolean;
  weeklySummary: boolean;
  defaultDifficulty: "all" | "easy" | "medium" | "hard";
}

const DEFAULT_SETTINGS: AppSettings = {
  accentColor: "neon-pink",
  compactMode: false,
  animationsEnabled: true,
  dailyReminder: false,
  streakAlerts: true,
  milestoneNotifications: true,
  weeklySummary: false,
  defaultDifficulty: "all",
};

function loadSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT_SETTINGS;
}

function saveSettings(settings: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

const ACCENT_COLORS = [
  { id: "neon-pink", label: "Neon Pink", color: "oklch(0.68 0.28 330)" },
  { id: "electric-blue", label: "Electric Blue", color: "#3b82f6" },
  { id: "lime-green", label: "Lime Green", color: "#84cc16" },
  { id: "amber", label: "Amber", color: "#f59e0b" },
  { id: "purple", label: "Purple", color: "#a855f7" },
  { id: "cyan", label: "Cyan", color: "#06b6d4" },
  { id: "red", label: "Red", color: "#ef4444" },
  { id: "orange", label: "Orange", color: "#f97316" },
];

const TABS: Array<{ id: TabId; label: string; icon: typeof User }> = [
  { id: "account", label: "Account", icon: User },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "about", label: "About", icon: Info },
];

function SettingsComponent() {
  const [username, setUsername] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [active] = useState("settings");
  const [activeTab, setActiveTab] = useState<TabId>("account");
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeyStatus, setApiKeyStatus] = useState<"configured" | "missing">("missing");
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(STORAGE_KEY) ?? "";
    setUsername(stored);
    setSettings(loadSettings());

    const hasApiKey = !!import.meta.env.VITE_API_KEY_CONFIGURED;
    setApiKeyStatus(hasApiKey ? "configured" : "missing");
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
    if (profileQ.error) toast.error(`Couldn't load profile: ${(profileQ.error as Error).message}`);
  }, [profileQ.error]);

  const updateSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      saveSettings(next);
      
      if (key === "accentColor") {
        const colorObj = ACCENT_COLORS.find(c => c.id === value);
        if (colorObj) {
          document.documentElement.style.setProperty('--neon', colorObj.color);
          document.documentElement.style.setProperty('--neon-glow', colorObj.color);
        }
      }
      
      return next;
    });
    toast.success("Setting saved!");
  }, []);

  const saveUsername = (u: string) => {
    localStorage.setItem(STORAGE_KEY, u);
    setUsername(u);
    setDialogOpen(false);
    toast.success("LeetCode account updated!");
  };

  const handleClearCache = () => {
    localStorage.clear();
    sessionStorage.clear();
    setUsername("");
    toast.success("Cache cleared! Page will refresh...");
    setTimeout(() => window.location.reload(), 1500);
  };

  const handleExportJSON = () => {
    const data: Record<string, string | null> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) data[key] = localStorage.getItem(key);
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leetcode-data-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Data exported as JSON!");
  };

  const handleCopyProfileSummary = () => {
    const p = profileQ.data;
    if (!p) {
      toast.error("No profile data to copy.");
      return;
    }
    const summary = [
      `🧑 LeetCode Profile: ${p.username}`,
      p.realName ? `   Name: ${p.realName}` : null,
      `📊 Total Solved: ${p.totalSolved}`,
      `   Easy: ${p.easySolved} | Medium: ${p.mediumSolved} | Hard: ${p.hardSolved}`,
      `🔥 Streak: ${p.streak} days`,
      `🏆 Ranking: ${p.ranking ? `#${p.ranking.toLocaleString()}` : "N/A"}`,
      `📅 Active Days: ${p.totalActiveDays}`,
      `---`,
      `Generated by grind.exe Dashboard`,
    ]
      .filter(Boolean)
      .join("\n");
    navigator.clipboard.writeText(summary).then(() => {
      toast.success("Profile summary copied to clipboard!");
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppSidebar
        active={active}
        onSelect={() => {}}
        onSettings={() => {}}
        avatarUrl={profileQ.data?.avatar ?? null}
      />
      <main className="ml-20 p-8 lg:p-12 max-w-[1400px]">
        <Header />

        {/* Profile Summary Card */}
        <ProfileSummaryCard profile={profileQ.data} loading={profileQ.isLoading} username={username} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-10">
          {/* Tab Navigation */}
          <nav className="lg:col-span-1 flex flex-col gap-2">
            {TABS.map((tab) => (
              <SettingNavItem
                key={tab.id}
                label={tab.label}
                icon={tab.icon}
                active={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
              />
            ))}
          </nav>

          {/* Content */}
          <div className="lg:col-span-2">
            {activeTab === "account" && (
              <AccountTab
                username={username}
                apiKeyStatus={apiKeyStatus}
                showApiKey={showApiKey}
                setShowApiKey={setShowApiKey}
                settings={settings}
                updateSetting={updateSetting}
                onOpenDialog={() => setDialogOpen(true)}
                onClearCache={handleClearCache}
                onExportJSON={handleExportJSON}
                onCopyProfile={handleCopyProfileSummary}
                hasProfile={!!profileQ.data}
              />
            )}
            {activeTab === "appearance" && (
              <AppearanceTab settings={settings} updateSetting={updateSetting} />
            )}
            {activeTab === "notifications" && (
              <NotificationsTab settings={settings} updateSetting={updateSetting} />
            )}
            {activeTab === "about" && <AboutTab />}
          </div>
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

function Header() {
  return (
    <header>
      <p className="font-display text-sm font-bold text-neon mb-2 uppercase tracking-wide flex items-center gap-2">
        <SettingsIcon className="size-4" />
        Settings
      </p>
      <h1 className="font-display text-4xl lg:text-5xl font-bold tracking-tight">
        Configuration
      </h1>
      <p className="text-muted-foreground mt-3 font-sans">
        Manage your LeetCode account connection, preferences, and application settings.
      </p>
    </header>
  );
}

/* ─── Profile Summary Card ─── */

function ProfileSummaryCard({
  profile,
  loading,
  username,
}: {
  profile?: LCProfile;
  loading: boolean;
  username: string;
}) {
  if (!username) return null;

  return (
    <section className="mt-8 p-6 bg-card border border-white/10 rounded-2xl">
      {loading ? (
        <div className="flex items-center gap-6">
          <div className="size-16 rounded-full bg-white/10 animate-pulse shrink-0" />
          <div className="flex-1 space-y-3">
            <div className="h-5 w-40 bg-white/10 rounded animate-pulse" />
            <div className="h-4 w-64 bg-white/5 rounded animate-pulse" />
          </div>
        </div>
      ) : profile ? (
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          {/* Avatar */}
          <div className="shrink-0">
            {profile.avatar ? (
              <img
                src={profile.avatar}
                alt={profile.username}
                className="size-16 rounded-full border-2 border-neon/50 shadow-neon"
              />
            ) : (
              <div className="size-16 rounded-full bg-gradient-to-br from-neon/40 to-primary/40 flex items-center justify-center border-2 border-neon/30">
                <User className="size-8 text-neon" />
              </div>
            )}
          </div>

          {/* User Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="font-display text-xl font-bold">{profile.username}</h2>
              {profile.realName && (
                <span className="text-sm text-muted-foreground font-sans">({profile.realName})</span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-2 flex-wrap text-sm font-sans text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Trophy className="size-3.5 text-neon" />
                <strong className="text-foreground">{profile.totalSolved}</strong> solved
              </span>
              <span className="flex items-center gap-1.5">
                <Flame className="size-3.5 text-orange-400" />
                <strong className="text-foreground">{profile.streak}</strong> day streak
              </span>
              {profile.ranking && (
                <span className="flex items-center gap-1.5">
                  <Target className="size-3.5 text-yellow-400" />
                  Rank <strong className="text-foreground">#{profile.ranking.toLocaleString()}</strong>
                </span>
              )}
              {profile.acceptanceRate !== null && (
                <span className="flex items-center gap-1.5">
                  <BarChart3 className="size-3.5 text-emerald-400" />
                  <strong className="text-foreground">{profile.acceptanceRate}%</strong> acceptance
                </span>
              )}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="flex gap-3 shrink-0">
            <DiffPill label="Easy" count={profile.easySolved} color="bg-emerald-500/20 text-emerald-400 border-emerald-500/30" />
            <DiffPill label="Med" count={profile.mediumSolved} color="bg-yellow-500/20 text-yellow-400 border-yellow-500/30" />
            <DiffPill label="Hard" count={profile.hardSolved} color="bg-red-500/20 text-red-400 border-red-500/30" />
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground font-sans">Could not load profile data.</p>
      )}
    </section>
  );
}

function DiffPill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className={`px-3 py-2 rounded-lg border text-center ${color}`}>
      <div className="text-lg font-display font-bold tabular-nums">{count}</div>
      <div className="text-[10px] uppercase tracking-wider font-display font-bold">{label}</div>
    </div>
  );
}

/* ─── Nav Item ─── */

function SettingNavItem({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: typeof User;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-3 rounded-lg font-display font-semibold text-sm tracking-wide transition-all cursor-glow text-left flex items-center gap-3 ${
        active
          ? "bg-neon/20 text-neon border border-neon/50 shadow-neon"
          : "hover:bg-white/10 text-muted-foreground border border-transparent"
      }`}
    >
      <Icon className="size-4" />
      {label}
    </button>
  );
}

/* ─── Toggle Switch ─── */

function ToggleSwitch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex items-center justify-between gap-4 py-3 cursor-pointer group">
      <div className="flex-1 min-w-0">
        <p className="font-display text-sm font-semibold group-hover:text-neon transition-colors">{label}</p>
        {description && <p className="text-xs text-muted-foreground font-sans mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all shrink-0 cursor-glow ${
          checked ? "bg-neon shadow-neon" : "bg-white/10"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </label>
  );
}

/* ─── Account Tab ─── */

function AccountTab({
  username,
  apiKeyStatus,
  showApiKey,
  setShowApiKey,
  settings,
  updateSetting,
  onOpenDialog,
  onClearCache,
  onExportJSON,
  onCopyProfile,
  hasProfile,
}: {
  username: string;
  apiKeyStatus: "configured" | "missing";
  showApiKey: boolean;
  setShowApiKey: (v: boolean) => void;
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  onOpenDialog: () => void;
  onClearCache: () => void;
  onExportJSON: () => void;
  onCopyProfile: () => void;
  hasProfile: boolean;
}) {
  const difficulties: Array<{ id: AppSettings["defaultDifficulty"]; label: string; color: string }> = [
    { id: "all", label: "All", color: "bg-white/10 text-foreground border-white/20" },
    { id: "easy", label: "Easy", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    { id: "medium", label: "Medium", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    { id: "hard", label: "Hard", color: "bg-red-500/20 text-red-400 border-red-500/30" },
  ];

  return (
    <>
      {/* Account Settings */}
      <section className="mb-12">
        <h2 className="font-display text-2xl font-bold mb-6 flex items-center gap-2">
          <User className="size-5 text-neon" /> Account
        </h2>

        <div className="space-y-6">
          {/* LeetCode Username */}
          <div className="p-6 bg-card border border-white/10 rounded-lg">
            <h3 className="font-display text-lg font-semibold mb-4">LeetCode Account</h3>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground mb-1 font-sans">Connected Account:</p>
                <p className="font-display text-lg font-bold">
                  {username || "Not connected"}
                </p>
              </div>
              <button
                onClick={onOpenDialog}
                className="px-6 py-3 bg-primary text-primary-foreground font-display text-sm font-bold tracking-wide rounded-lg hover:bg-primary/90 cursor-glow transition-all flex items-center gap-2"
              >
                <Save className="size-4" />
                {username ? "Change" : "Connect"}
              </button>
            </div>
            <p className="text-xs text-muted-foreground font-sans">
              Your LeetCode username is used to fetch your profile, stats, and recent solves.
            </p>
          </div>

          {/* Default Difficulty */}
          <div className="p-6 bg-card border border-white/10 rounded-lg">
            <h3 className="font-display text-lg font-semibold mb-2 flex items-center gap-2">
              <Sliders className="size-4 text-neon" /> Default Difficulty
            </h3>
            <p className="text-sm text-muted-foreground mb-4 font-sans">
              AI Mode will use this preference when suggesting problems.
            </p>
            <div className="flex gap-3 flex-wrap">
              {difficulties.map((d) => {
                const isActive = settings.defaultDifficulty === d.id;
                return (
                  <button
                    key={d.id}
                    onClick={() => updateSetting("defaultDifficulty", d.id)}
                    className={`px-5 py-2.5 rounded-lg font-display text-sm font-bold tracking-wide border transition-all cursor-glow ${
                      isActive
                        ? "bg-neon/20 text-neon border-neon/50 shadow-neon ring-1 ring-neon/30"
                        : `${d.color} hover:border-neon/30`
                    }`}
                  >
                    {isActive && <Check className="size-3.5 inline mr-1.5 -mt-0.5" />}
                    {d.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* API Configuration */}
          <div className="p-6 bg-card border border-white/10 rounded-lg">
            <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
              <Shield className="size-4 text-neon" /> API Configuration
            </h3>
            <div className="flex items-start gap-4 mb-6">
              <AlertCircle className="size-5 text-neon mt-1 shrink-0" />
              <div className="text-sm font-sans">
                <p className="font-semibold mb-1">API Key Status</p>
                <p className="text-muted-foreground">
                  {apiKeyStatus === "configured"
                    ? "✓ Your API key is properly configured"
                    : "⚠ No API key found. Some features may not work."}
                </p>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 rounded-lg p-4 mb-4">
              <p className="text-xs text-muted-foreground font-mono mb-2 font-sans">Environment Variable:</p>
              <p className="font-mono text-sm break-words">GEMINI_API_KEY</p>
            </div>

            <div className="text-sm text-muted-foreground font-sans space-y-2">
              <p>
                🤖 <strong>Gemini API</strong> is used for:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>AI-powered next problem recommendations</li>
                <li>Topic-based problem search and analysis</li>
                <li>Weakness analysis based on your solving history</li>
              </ul>
            </div>
          </div>

          {/* Data Management */}
          <div className="p-6 bg-card border border-white/10 rounded-lg">
            <h3 className="font-display text-lg font-semibold mb-4">Data Management</h3>
            <p className="text-sm text-muted-foreground mb-4 font-sans">
              Manage your cached data and preferences
            </p>
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={onClearCache}
                className="px-6 py-3 bg-red-500/20 text-red-400 border border-red-500/30 font-display text-sm font-bold tracking-wide rounded-lg hover:bg-red-500/30 cursor-glow transition-all"
              >
                Clear All Cached Data
              </button>
            </div>
          </div>

          {/* Export Data */}
          <div className="p-6 bg-card border border-white/10 rounded-lg">
            <h3 className="font-display text-lg font-semibold mb-2 flex items-center gap-2">
              <Download className="size-4 text-neon" /> Export Data
            </h3>
            <p className="text-sm text-muted-foreground mb-4 font-sans">
              Download your data or share your profile summary.
            </p>
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={onExportJSON}
                className="px-6 py-3 bg-neon/10 text-neon border border-neon/30 font-display text-sm font-bold tracking-wide rounded-lg hover:bg-neon/20 cursor-glow transition-all flex items-center gap-2"
              >
                <Download className="size-4" />
                Export as JSON
              </button>
              <button
                onClick={onCopyProfile}
                disabled={!hasProfile}
                className="px-6 py-3 bg-white/5 text-foreground border border-white/10 font-display text-sm font-bold tracking-wide rounded-lg hover:bg-white/10 hover:border-neon/30 cursor-glow transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Copy className="size-4" />
                Copy Profile Summary
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

/* ─── Appearance Tab ─── */

function AppearanceTab({
  settings,
  updateSetting,
}: {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}) {
  return (
    <section className="mb-12">
      <h2 className="font-display text-2xl font-bold mb-6 flex items-center gap-2">
        <Palette className="size-5 text-neon" /> Appearance
      </h2>

      <div className="space-y-6">
        {/* Accent Color */}
        <div className="p-6 bg-card border border-white/10 rounded-lg">
          <h3 className="font-display text-lg font-semibold mb-2 flex items-center gap-2">
            <Sparkles className="size-4 text-neon" /> Accent Color
          </h3>
          <p className="text-sm text-muted-foreground mb-5 font-sans">
            Choose a color accent for the interface. This preference is saved locally.
          </p>
          <div className="flex gap-3 flex-wrap">
            {ACCENT_COLORS.map((c) => {
              const isActive = settings.accentColor === c.id;
              return (
                <button
                  key={c.id}
                  title={c.label}
                  onClick={() => updateSetting("accentColor", c.id)}
                  className={`relative size-10 rounded-full border-2 transition-all cursor-glow hover:scale-110 ${
                    isActive ? "ring-2 ring-offset-2 ring-offset-background border-white" : "border-white/20 hover:border-white/50"
                  }`}
                  style={{ backgroundColor: c.color }}
                >
                  {isActive && (
                    <Check className="size-4 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 drop-shadow-lg" />
                  )}
                </button>
              );
            })}
          </div>
          {/* Preview */}
          <div className="mt-5 flex items-center gap-3">
            <span className="text-xs text-muted-foreground font-sans uppercase tracking-wider">Preview:</span>
            <div
              className="h-3 w-32 rounded-full"
              style={{
                backgroundColor: ACCENT_COLORS.find((c) => c.id === settings.accentColor)?.color ?? ACCENT_COLORS[0].color,
              }}
            />
            <span
              className="font-display text-sm font-bold"
              style={{
                color: ACCENT_COLORS.find((c) => c.id === settings.accentColor)?.color ?? ACCENT_COLORS[0].color,
              }}
            >
              {ACCENT_COLORS.find((c) => c.id === settings.accentColor)?.label ?? "Neon Pink"}
            </span>
          </div>
        </div>

        {/* Display Preferences */}
        <div className="p-6 bg-card border border-white/10 rounded-lg">
          <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
            <Monitor className="size-4 text-neon" /> Display Preferences
          </h3>
          <div className="divide-y divide-white/5">
            <ToggleSwitch
              checked={settings.compactMode}
              onChange={(v) => updateSetting("compactMode", v)}
              label="Compact Mode"
              description="Reduce card spacing and padding for a denser layout."
            />
            <ToggleSwitch
              checked={settings.animationsEnabled}
              onChange={(v) => updateSetting("animationsEnabled", v)}
              label="Animations"
              description="Enable smooth transitions and animated elements."
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Notifications Tab ─── */

function NotificationsTab({
  settings,
  updateSetting,
}: {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}) {
  return (
    <section className="mb-12">
      <h2 className="font-display text-2xl font-bold mb-6 flex items-center gap-2">
        <Bell className="size-5 text-neon" /> Notifications
      </h2>

      <div className="space-y-6">
        <div className="p-6 bg-card border border-white/10 rounded-lg">
          <h3 className="font-display text-lg font-semibold mb-4">Notification Preferences</h3>
          <div className="divide-y divide-white/5">
            <ToggleSwitch
              checked={settings.dailyReminder}
              onChange={(v) => updateSetting("dailyReminder", v)}
              label="Daily Reminder"
              description="Get a reminder to solve a problem every day."
            />
            <ToggleSwitch
              checked={settings.streakAlerts}
              onChange={(v) => updateSetting("streakAlerts", v)}
              label="Streak Alerts"
              description="Alert when your streak is about to break."
            />
            <ToggleSwitch
              checked={settings.milestoneNotifications}
              onChange={(v) => updateSetting("milestoneNotifications", v)}
              label="Milestone Notifications"
              description="Celebrate when you reach solving milestones (50, 100, 200…)."
            />
            <ToggleSwitch
              checked={settings.weeklySummary}
              onChange={(v) => updateSetting("weeklySummary", v)}
              label="Weekly Summary"
              description="Receive a weekly progress summary recap."
            />
          </div>
        </div>

        <div className="p-4 bg-white/5 border border-white/10 rounded-lg flex items-start gap-3">
          <Info className="size-4 text-neon mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground font-sans leading-relaxed">
            Notification preferences are stored locally in your browser. Browser notification
            permissions would need to be granted separately for push notifications. These
            preferences control in-app toast notifications.
          </p>
        </div>
      </div>
    </section>
  );
}

/* ─── About Tab ─── */

function AboutTab() {
  const buildTimestamp = "2026-05-22T22:00:00Z";

  const shortcuts: Array<{ keys: string; description: string }> = [
    { keys: "G then D", description: "Go to Dashboard" },
    { keys: "G then S", description: "Go to Streaks" },
    { keys: "G then A", description: "Go to AI Mode" },
    { keys: "G then T", description: "Go to Topics" },
    { keys: "G then ⚙", description: "Go to Settings" },
    { keys: "R", description: "Refresh data" },
    { keys: "?", description: "Show keyboard shortcuts" },
  ];

  const techStack = [
    { name: "React", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
    { name: "TypeScript", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
    { name: "TailwindCSS", color: "bg-teal-500/20 text-teal-400 border-teal-500/30" },
    { name: "TanStack Router", color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
    { name: "TanStack Query", color: "bg-red-500/20 text-red-400 border-red-500/30" },
    { name: "TanStack Start", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
    { name: "Gemini AI", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
    { name: "Sonner", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
    { name: "Lucide Icons", color: "bg-pink-500/20 text-pink-400 border-pink-500/30" },
    { name: "Zod", color: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" },
  ];

  return (
    <section className="mb-12">
      <h2 className="font-display text-2xl font-bold mb-6 flex items-center gap-2">
        <Info className="size-5 text-neon" /> About
      </h2>

      <div className="space-y-6">
        {/* App Info */}
        <div className="p-6 bg-card border border-white/10 rounded-lg space-y-6">
          <div>
            <h3 className="font-display text-xl font-bold mb-2 flex items-center gap-2">
              <Zap className="size-5 text-neon" />
              grind.exe
            </h3>
            <p className="text-sm text-muted-foreground font-sans leading-relaxed">
              A modern dashboard to track your grind.exe with AI-powered recommendations,
              streak tracking, and gamified milestones. Turn your grinding into a game.
            </p>
          </div>

          <div>
            <h3 className="font-display font-semibold mb-2">Features</h3>
            <ul className="text-sm text-muted-foreground font-sans space-y-2">
              <li className="flex items-center gap-2">
                <Check className="size-3.5 text-neon shrink-0" /> Real-time LeetCode profile syncing
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-3.5 text-neon shrink-0" /> AI-powered next problem recommendations
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-3.5 text-neon shrink-0" /> Topic-based problem search
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-3.5 text-neon shrink-0" /> Streak tracking and milestones
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-3.5 text-neon shrink-0" /> Submission heatmap
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-3.5 text-neon shrink-0" /> Difficulty breakdown analysis
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-3.5 text-neon shrink-0" /> Customizable appearance and preferences
              </li>
            </ul>
          </div>
        </div>

        {/* Version Info */}
        <div className="p-6 bg-card border border-white/10 rounded-lg">
          <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
            <Eye className="size-4 text-neon" /> Version Info
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm font-sans">
            <div>
              <p className="text-muted-foreground">Version</p>
              <p className="font-semibold font-display">1.0.0</p>
            </div>
            <div>
              <p className="text-muted-foreground">Build</p>
              <p className="font-semibold font-mono text-xs mt-0.5">{buildTimestamp}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Runtime</p>
              <p className="font-semibold font-display">React 19</p>
            </div>
            <div>
              <p className="text-muted-foreground">Platform</p>
              <p className="font-semibold font-display">Web</p>
            </div>
          </div>
        </div>

        {/* Links */}
        <div className="p-6 bg-card border border-white/10 rounded-lg">
          <h3 className="font-display text-lg font-semibold mb-4">Links</h3>
          <div className="flex gap-3 flex-wrap">
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="px-5 py-2.5 bg-white/5 border border-white/10 rounded-lg font-display text-sm font-bold tracking-wide hover:bg-white/10 hover:border-neon/30 cursor-glow transition-all flex items-center gap-2"
            >
              <Github className="size-4" />
              GitHub
              <ExternalLink className="size-3 text-muted-foreground" />
            </a>
            <a
              href="https://leetcode.com"
              target="_blank"
              rel="noreferrer"
              className="px-5 py-2.5 bg-yellow-500/10 border border-yellow-500/20 rounded-lg font-display text-sm font-bold tracking-wide text-yellow-400 hover:bg-yellow-500/20 cursor-glow transition-all flex items-center gap-2"
            >
              LeetCode
              <ExternalLink className="size-3" />
            </a>
            <a
              href="https://ai.google.dev"
              target="_blank"
              rel="noreferrer"
              className="px-5 py-2.5 bg-purple-500/10 border border-purple-500/20 rounded-lg font-display text-sm font-bold tracking-wide text-purple-400 hover:bg-purple-500/20 cursor-glow transition-all flex items-center gap-2"
            >
              Gemini API
              <ExternalLink className="size-3" />
            </a>
          </div>
        </div>

        {/* Keyboard Shortcuts */}
        <div className="p-6 bg-card border border-white/10 rounded-lg">
          <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
            <Keyboard className="size-4 text-neon" /> Keyboard Shortcuts
          </h3>
          <div className="space-y-2">
            {shortcuts.map((s) => (
              <div key={s.keys} className="flex items-center justify-between py-1.5">
                <span className="text-sm text-muted-foreground font-sans">{s.description}</span>
                <div className="flex gap-1">
                  {s.keys.split(" then ").map((key, i) => (
                    <span key={i} className="flex items-center gap-1">
                      {i > 0 && <span className="text-muted-foreground text-xs mx-1">→</span>}
                      <kbd className="px-2 py-1 bg-white/10 border border-white/20 rounded text-xs font-mono font-bold">
                        {key}
                      </kbd>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Tech Stack */}
        <div className="p-6 bg-card border border-white/10 rounded-lg">
          <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
            <Zap className="size-4 text-neon" /> Tech Stack
          </h3>
          <div className="flex gap-2 flex-wrap">
            {techStack.map((t) => (
              <span
                key={t.name}
                className={`px-3 py-1.5 rounded-full border text-xs font-display font-bold tracking-wide ${t.color}`}
              >
                {t.name}
              </span>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-white/10 text-center">
          <p className="text-xs text-muted-foreground font-sans">
            Made with ❤️ for the LeetCode grind. Keep solving, keep growing.
          </p>
        </div>
      </div>
    </section>
  );
}
