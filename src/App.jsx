import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";

import Dashboard from "@/pages/Dashboard";
import AIMode from "@/pages/AIMode";
import Streaks from "@/pages/Streaks";
import TimeAnalytics from "@/pages/TimeAnalytics";
import Settings from "@/pages/Settings";

const queryClient = new QueryClient();

const ACCENT_COLORS = [
  { id: "neon-pink", color: "oklch(0.68 0.28 330)" },
  { id: "electric-blue", color: "#3b82f6" },
  { id: "lime-green", color: "#84cc16" },
  { id: "amber", color: "#f59e0b" },
  { id: "purple", color: "#a855f7" },
  { id: "cyan", color: "#06b6d4" },
  { id: "red", color: "#ef4444" },
  { id: "orange", color: "#f97316" },
];

function RootLayout() {
  useEffect(() => {
    try {
      const raw = localStorage.getItem("lc:settings");
      if (raw) {
        const settings = JSON.parse(raw);
        if (settings.accentColor) {
          const color = ACCENT_COLORS.find((c) => c.id === settings.accentColor)?.color;
          if (color) {
            document.documentElement.style.setProperty("--neon", color);
            document.documentElement.style.setProperty("--neon-glow", color);
            document.documentElement.style.setProperty("--primary", color);
            document.documentElement.style.setProperty("--accent", color);
            document.documentElement.style.setProperty("--ring", color);
          }
        }
        if (settings.compactMode) {
          document.documentElement.classList.add("compact-mode");
        }
        if (settings.animationsEnabled === false) {
          document.documentElement.classList.add("no-animations");
        }
      }
    } catch {
      // ignore
    }
  }, []);

  return (
    <>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/ai-mode" element={<AIMode />} />
        <Route path="/streaks" element={<Streaks />} />
        <Route path="/time-analytics" element={<TimeAnalytics />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster theme="dark" position="top-right" />
    </>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <RootLayout />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
