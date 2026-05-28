import express from "express";
import { fetchLeetCodeProfile, fetchRecentSubmissionsWithDetails } from "../lib/leetcode.js";

const router = express.Router();

// POST /api/leetcode/profile
router.post("/profile", async (req, res) => {
  try {
    const { username } = req.body;
    if (!username || typeof username !== "string" || username.length < 1 || username.length > 64) {
      return res.status(400).json({ error: "Invalid username" });
    }
    if (!/^[A-Za-z0-9_-]+$/.test(username)) {
      return res.status(400).json({ error: "Invalid username format" });
    }

    const profile = await fetchLeetCodeProfile(username);
    res.json(profile);
  } catch (error) {
    console.error("Profile fetch error:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/leetcode/submissions
router.post("/submissions", async (req, res) => {
  try {
    const { username } = req.body;
    if (!username || typeof username !== "string" || username.length < 1 || username.length > 64) {
      return res.status(400).json({ error: "Invalid username" });
    }
    if (!/^[A-Za-z0-9_-]+$/.test(username)) {
      return res.status(400).json({ error: "Invalid username format" });
    }

    const submissions = await fetchRecentSubmissionsWithDetails(username);
    res.json(submissions);
  } catch (error) {
    console.error("Submissions fetch error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
