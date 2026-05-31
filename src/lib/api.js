const API_BASE = import.meta.env.VITE_API_URL || "/api";

async function request(url, options) {
  const res = await fetch(`${API_BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── LeetCode API ───

export function fetchProfile(username) {
  return request("/leetcode/profile", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
}

export function fetchSubmissions(username) {
  return request("/leetcode/submissions", {
    method: "POST",
    body: JSON.stringify({ username }),
  });
}

// ─── AI API ───

export function suggestProblem(data) {
  return request("/ai/suggest", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function searchProblems(data) {
  return request("/ai/search", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getSolution(data) {
  return request("/ai/solution", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getGroqStatus() {
  return request("/ai/status");
}
