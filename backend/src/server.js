import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import adminRoutes from "./routes/adminRoutes.js";
import publicRoutes from "./routes/publicRoutes.js";
import clientRoutes from "./routes/clientRoutes.js";
import setupRoutes from "./routes/setupRoutes.js";
import webhooksRoutes from "./routes/webhooksRoutes.js";
import seatingRoutes, { startTableDispatchScheduler } from "./routes/seatingRoutes.js";
import seatingTemplateRoutes from "./routes/seatingTemplateRoutes.js";
import agentRoutes from "./routes/agentRoutes.js";
import eventManagerRoutes from "./routes/eventManagerRoutes.js";
import hostessRoutes from "./routes/hostessRoutes.js";
import vendorRoutes from "./routes/vendorRoutes.js";
import clientVendorRoutes from "./routes/clientVendorRoutes.js";
import { logPerf, nowMs } from "./utils/requestTiming.js";

const processStartedAt = Date.now();
dotenv.config();
const modulesLoadedAt = Date.now();

const app = express();
const port = process.env.PORT || 5000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDistPath = path.resolve(__dirname, "../../frontend/dist");

app.use(cors());
const bodyLimit = "50mb";
app.use(express.json({ limit: bodyLimit }));
app.use(express.urlencoded({ limit: bodyLimit, extended: true }));

app.get("/api/health", (_req, res) => {
  const mongoState = mongoose.connection.readyState;
  const mongoReady = mongoState === 1;
  res.status(mongoReady ? 200 : 503).json({
    ok: mongoReady,
    mongo: {
      readyState: mongoState,
      ready: mongoReady
    },
    uptimeSec: Math.round(process.uptime()),
    startedAt: new Date(processStartedAt).toISOString()
  });
});

app.use("/api/admin", adminRoutes);
app.use("/api/public", publicRoutes);
app.use("/api/public", setupRoutes);
app.use("/api/client", clientRoutes);
app.use("/api/client", seatingRoutes);
app.use("/api/client", clientVendorRoutes);
app.use("/api/hostess", hostessRoutes);
app.use("/api/seating-templates", seatingTemplateRoutes);
app.use("/api/agent", agentRoutes);
app.use("/api/manager", eventManagerRoutes);
app.use("/api/manager", vendorRoutes);
app.use("/api/webhooks", webhooksRoutes);

app.use((err, req, res, next) => {
  if (err?.type === "entity.too.large") {
    return res.status(413).json({
      message: "הקובץ גדול מדי. נסו להקטין את תמונת הקאבר או את נתוני האירוע."
    });
  }
  if (err?.name === "MulterError") {
    return res.status(400).json({ message: err.message || "העלאת הקובץ נכשלה" });
  }
  return res.status(err.status || 500).json({ message: err.message || "שגיאת שרת" });
});

app.use(
  express.static(frontendDistPath, {
    index: false,
    setHeaders(res, filePath) {
      const normalized = String(filePath).replace(/\\/g, "/");
      if (normalized.includes("/assets/")) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        return;
      }
      if (normalized.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache");
      }
    }
  })
);

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next();
  }
  res.setHeader("Cache-Control", "no-cache");
  return res.sendFile(path.join(frontendDistPath, "index.html"));
});

async function startServer() {
  const startupStarted = nowMs();
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing");
    }
    logPerf("startup", {
      phase: "process_start",
      processStartedAt: new Date(processStartedAt).toISOString(),
      modulesLoadedMs: modulesLoadedAt - processStartedAt
    });

    const mongoStarted = nowMs();
    await mongoose.connect(process.env.MONGO_URI);
    const mongoConnectedMs = nowMs() - mongoStarted;
    logPerf("startup", {
      phase: "mongo_connected",
      mongoConnectedMs,
      sinceProcessStartMs: Date.now() - processStartedAt
    });

    app.listen(port, () => {
      logPerf("startup", {
        phase: "listening",
        port,
        totalStartupMs: nowMs() - startupStarted,
        sinceProcessStartMs: Date.now() - processStartedAt,
        regionHint: process.env.RAILWAY_REGION || process.env.RAILWAY_REPLICA_REGION || null
      });
      console.log(`Server running on port ${port}`);
      startTableDispatchScheduler(30000);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

startServer();
