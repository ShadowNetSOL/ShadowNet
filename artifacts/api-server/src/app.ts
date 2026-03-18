import express, { type Express } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import slowDown from "express-slow-down";
import router from "./routes";

const app: Express = express();

// Rate limiting and abuse protection
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60
});

const speedLimiter = slowDown({
  windowMs: 60 * 1000,
  delayAfter: 20,
  delayMs: 500
});

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Timeout protection
app.use((req, res, next) => {
  res.setTimeout(10000, () => {
    res.status(408).send("Request timeout");
  });
  next();
});

// Apply rate limiting to routes
app.use("/api/proxy", limiter, speedLimiter);
app.use("/api/intelligence", limiter);

// Health endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime()
  });
});

app.use("/api", router);

export default app;
