import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";

import leetcodeRoutes from "./routes/leetcode.js";
import aiRoutes from "./routes/ai.js";
import healthRoutes from "./routes/health.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
// In production, frontend is served by this same Express server (same-origin),
// so CORS is only needed for local development.
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:5000",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (curl, Postman, same-origin browser requests)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS policy: origin ${origin} not allowed`));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
app.use(express.json());

// API Routes
app.use("/api/leetcode", leetcodeRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/health", healthRoutes);



// Serve the built frontend if dist/ folder exists (i.e. after running vite build)
// This avoids relying on NODE_ENV being set correctly on the host.
const distPath = path.join(__dirname, "..", "dist");
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  // All non-API routes → serve index.html (React Router handles client-side routing)
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`🚀 Express server running on http://localhost:${PORT}`);
});
