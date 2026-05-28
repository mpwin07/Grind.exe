import express from "express";
import { suggestNextProblem, searchProblems, getSolution } from "../lib/ai-suggest.js";
import { getGroqApiStatus } from "../lib/groq.js";

const router = express.Router();

// GET /api/ai/status
router.get("/status", (req, res) => {
  res.json({ status: getGroqApiStatus() });
});

// POST /api/ai/suggest
router.post("/suggest", async (req, res) => {
  try {
    const data = req.body;
    if (!data.username || typeof data.totalSolved !== "number") {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const suggestion = await suggestNextProblem(data);
    res.json(suggestion);
  } catch (error) {
    console.error("AI suggest error:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ai/search
router.post("/search", async (req, res) => {
  try {
    const data = req.body;
    if (!data.topic || !data.username) {
      return res.status(400).json({ error: "Missing topic or username" });
    }

    const results = await searchProblems(data);
    res.json(results);
  } catch (error) {
    console.error("AI search error:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/ai/solution
router.post("/solution", async (req, res) => {
  try {
    const data = req.body;
    if (!data.title || !data.slug || !data.language) {
      return res.status(400).json({ error: "Missing title, slug, or language" });
    }

    const validLanguages = ["java", "python", "cpp", "javascript", "typescript", "go", "rust"];
    if (!validLanguages.includes(data.language)) {
      return res.status(400).json({ error: "Invalid language" });
    }

    const solution = await getSolution(data);
    res.json(solution);
  } catch (error) {
    console.error("AI solution error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
