import { toast } from "sonner";

const SETTINGS_KEY = "lc:settings";
const NOTIF_STATE_KEY = "lc:notification-state";
const MILESTONE_THRESHOLDS = [10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000];

interface NotificationState {
  lastDailyReminder?: string; // ISO date string
  lastStreakAlert?: string; // ISO date string
  lastWeeklySummary?: string; // ISO date string
  celebratedMilestones?: number[];
  dailyReminderTimerId?: number;
  streakAlertTimerId?: number;
  weeklySummaryTimerId?: number;
}

function loadNotifState(): NotificationState {
  try {
    const raw = localStorage.getItem(NOTIF_STATE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveNotifState(state: NotificationState) {
  localStorage.setItem(NOTIF_STATE_KEY, JSON.stringify(state));
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Request browser notification permission. Returns true if granted.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

/**
 * Send a browser notification (if permission granted) + in-app toast
 */
function sendNotification(title: string, body: string, icon?: string) {
  // Always show in-app toast
  toast(title, { description: body, duration: 8000 });

  // Also attempt browser notification
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(title, {
        body,
        icon: icon || "/logo.png",
        badge: "/logo.png",
      });
    } catch {
      // Service worker may be needed on some platforms - fallback silently
    }
  }
}

/**
 * Check and fire daily reminder if needed
 */
export function checkDailyReminder() {
  const settings = loadSettings();
  if (!settings.dailyReminder) return;

  const state = loadNotifState();
  const today = new Date().toISOString().slice(0, 10);

  if (state.lastDailyReminder === today) return;

  // Fire the daily reminder
  sendNotification(
    "🎯 Daily Reminder",
    "Time to solve a LeetCode problem! Keep your streak alive and your skills sharp.",
  );

  state.lastDailyReminder = today;
  saveNotifState(state);
}

/**
 * Check streak alert — fires if user hasn't solved today and has an active streak
 */
export function checkStreakAlert(streak: number, hasSubmittedToday: boolean) {
  const settings = loadSettings();
  if (!settings.streakAlerts) return;
  if (streak <= 0) return;
  if (hasSubmittedToday) return;

  const state = loadNotifState();
  const today = new Date().toISOString().slice(0, 10);

  if (state.lastStreakAlert === today) return;

  // Check if it's getting late in the day (after 6 PM)
  const hour = new Date().getHours();
  if (hour >= 18) {
    sendNotification(
      "🔥 Streak at Risk!",
      `Your ${streak}-day streak is about to break! Solve a problem before midnight to keep it alive.`,
    );
    state.lastStreakAlert = today;
    saveNotifState(state);
  }
}

/**
 * Check milestone celebrations
 */
export function checkMilestone(totalSolved: number) {
  const settings = loadSettings();
  if (!settings.milestoneNotifications) return;

  const state = loadNotifState();
  const celebrated = state.celebratedMilestones ?? [];

  for (const threshold of MILESTONE_THRESHOLDS) {
    if (totalSolved >= threshold && !celebrated.includes(threshold)) {
      celebrated.push(threshold);
      sendNotification(
        "🏆 Milestone Reached!",
        `Congratulations! You've solved ${threshold} LeetCode problems! Keep grinding! 🎉`,
      );
    }
  }

  state.celebratedMilestones = celebrated;
  saveNotifState(state);
}

/**
 * Check weekly summary
 */
export function checkWeeklySummary(
  totalSolved: number,
  streak: number,
  easySolved: number,
  mediumSolved: number,
  hardSolved: number,
) {
  const settings = loadSettings();
  if (!settings.weeklySummary) return;

  const state = loadNotifState();
  const now = new Date();
  // Only trigger on Sunday
  if (now.getDay() !== 0) return;

  const today = now.toISOString().slice(0, 10);
  if (state.lastWeeklySummary === today) return;

  sendNotification(
    "📊 Weekly Summary",
    `This week's stats: ${totalSolved} total solved (E:${easySolved} M:${mediumSolved} H:${hardSolved}). Current streak: ${streak} days. Keep it up!`,
  );

  state.lastWeeklySummary = today;
  saveNotifState(state);
}

/**
 * Initialize all notification timers — call on app mount
 */
export function initNotificationSchedulers() {
  // Check daily reminder immediately and every hour
  checkDailyReminder();
  const dailyInterval = setInterval(checkDailyReminder, 60 * 60 * 1000);

  return () => {
    clearInterval(dailyInterval);
  };
}

/**
 * Handle notification toggle — when user enables a notification type,
 * request browser permission and show a confirmation
 */
export async function handleNotificationToggle(
  type: "dailyReminder" | "streakAlerts" | "milestoneNotifications" | "weeklySummary",
  enabled: boolean,
): Promise<void> {
  if (!enabled) {
    toast.success(`${getNotifLabel(type)} disabled`);
    return;
  }

  // Request permission when enabling any notification
  const granted = await requestNotificationPermission();

  if (granted) {
    toast.success(`${getNotifLabel(type)} enabled with browser notifications!`, {
      description: "You'll receive both in-app and browser notifications.",
    });
  } else if ("Notification" in window && Notification.permission === "denied") {
    toast.warning(`${getNotifLabel(type)} enabled (in-app only)`, {
      description: "Browser notifications are blocked. Enable them in browser settings for full experience.",
    });
  } else {
    toast.success(`${getNotifLabel(type)} enabled`, {
      description: "You'll receive in-app toast notifications.",
    });
  }
}

function getNotifLabel(type: string): string {
  switch (type) {
    case "dailyReminder": return "Daily Reminder";
    case "streakAlerts": return "Streak Alerts";
    case "milestoneNotifications": return "Milestone Notifications";
    case "weeklySummary": return "Weekly Summary";
    default: return "Notification";
  }
}
