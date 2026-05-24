import { LayoutDashboard, Sparkles, Flame, Settings, Timer } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

const items = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, to: "/" as const },
  { id: "ai-mode", label: "AI Mode", icon: Sparkles, to: "/ai-mode" as const },
  { id: "streaks", label: "Streaks", icon: Flame, to: "/streaks" as const },
  { id: "time-analytics", label: "Analytics", icon: Timer, to: "/time-analytics" as const },
];

export function AppSidebar({
  active,
  onSelect,
  onSettings,
  avatarUrl,
}: {
  active?: string;
  onSelect?: (id: string) => void;
  onSettings?: () => void;
  avatarUrl?: string | null;
}) {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  return (
    <nav className="fixed left-0 top-0 h-screen w-20 border-r border-white/10 bg-night/60 backdrop-blur-xl flex flex-col items-center py-6 gap-8 z-40">
      <div className="size-10 rounded-lg shadow-neon flex items-center justify-center font-display font-bold text-night overflow-hidden">
        <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" />
      </div>

      <div className="flex-1 flex flex-col gap-1 items-center">
        {items.map((it) => {
          const Icon = it.icon;
          const isActive =
            active === it.id ||
            (active == null &&
              (it.to === "/"
                ? currentPath === "/"
                : currentPath.startsWith(it.to)));
          return (
            <Link
              key={it.id}
              to={it.to}
              onClick={() => onSelect?.(it.id)}
              title={it.label}
              className={cn(
                "group w-14 py-3 rounded-lg flex flex-col items-center gap-1 transition-all cursor-glow",
                isActive
                  ? "bg-neon/20 text-neon shadow-neon"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/10",
              )}
            >
              <Icon className="size-5" strokeWidth={2} />
              <span className="font-sans text-[10px] font-semibold">
                {it.label.split(" ")[0]}
              </span>
            </Link>
          );
        })}
      </div>

      <Link
        to="/settings"
        onClick={() => onSettings?.()}
        title="Settings"
        className={cn(
          "cursor-glow transition-colors p-3 rounded-lg",
          currentPath === "/settings"
            ? "text-neon bg-neon/20 shadow-neon"
            : "text-muted-foreground hover:text-neon hover:bg-white/10",
        )}
        aria-label="Settings"
      >
        <Settings className="size-5" strokeWidth={2} />
      </Link>

      <div className="size-10 rounded-lg overflow-hidden border border-white/20 hover:border-neon cursor-glow transition-all">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="avatar"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-neon/30 to-primary/30" />
        )}
      </div>
    </nav>
  );
}