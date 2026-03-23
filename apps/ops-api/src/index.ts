import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createServer } from "node:http";
import { Server } from "socket.io";
import routes from "./routes";
import { setIO } from "./socket";
import { startConvosoKpiPoller } from "./workers/convosoKpiPoller";

// ── Validate required environment variables ─────────────────────
const required = ["DATABASE_URL", "AUTH_JWT_SECRET"];
const missing = required.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`\n  FATAL: Missing required environment variables:\n${missing.map(k => `    - ${k}`).join("\n")}\n\n  Set them in your .env file or environment before starting.\n`);
  process.exit(1);
}

// ── Express app ─────────────────────────────────────────────────
const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:3011,http://localhost:3013").split(",").map(s => s.trim());

// CORS must be registered before body parsers so that preflight OPTIONS
// requests are handled immediately and never reach the JSON parser.
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, curl, mobile apps)
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// Parse JSON bodies with an explicit error handler so a malformed payload
// (e.g. double-escaped characters) returns a clean 400 instead of a 500.
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  express.json()(req, res, (err) => {
    if (err) {
      console.error("[body-parser] JSON parse error:", err.message, "| path:", req.path);
      return res.status(400).json({ error: "Invalid JSON in request body. Ensure the body is not double-encoded." });
    }
    next();
  });
});

app.use(cookieParser());

app.get("/health", (_req, res) => res.json({ ok: true, service: "ops-api" }));
app.use("/api", routes);

// Global error handler for async route errors
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[error]", err.message ?? err);
  if (!res.headersSent) {
    const status = typeof err.statusCode === "number" ? err.statusCode : typeof err.status === "number" ? err.status : 500;
    const message = err.expose && err.message ? err.message : "Internal server error";
    res.status(status).json({ error: message });
  }
});

// ── HTTP server + Socket.IO ─────────────────────────────────────
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});
setIO(io);

io.on("connection", (socket) => {
  console.log(`[socket.io] Client connected: ${socket.id}`);
  socket.on("disconnect", () => {
    console.log(`[socket.io] Client disconnected: ${socket.id}`);
  });
});

const port = Number(process.env.PORT || 8080);
server.listen(port, () => {
  console.log(`ops-api listening on ${port}`);
  startConvosoKpiPoller();
});
