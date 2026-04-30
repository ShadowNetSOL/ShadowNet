import express, { type Express } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import slowDown from "express-slow-down";
import router from "./routes";

const app: Express = express();

// Disable framework fingerprint at the Express level. The lower-level
// http.Server in index.ts strips it again on raw responses.
app.disable("x-powered-by");

// Trust the first hop. Railway terminates TLS at its edge proxy and forwards
// the original client IP via X-Forwarded-For. Without this, express-rate-limit
// sees only the proxy's IP and throws ERR_ERL_UNEXPECTED_X_FORWARDED_FOR for
// every request (visible in deploy logs).
app.set("trust proxy", 1);

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
});

const speedLimiter = slowDown({
  windowMs: 60 * 1000,
  delayAfter: 20,
  // express-slow-down v2 takes a function of (hits) → ms. The number form
  // is deprecated and emits WRN_ESD_DELAYMS at boot on Railway.
  delayMs: (hits) => (hits - 20) * 500,
});

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use((_req, res, next) => {
  res.setTimeout(10000, () => {
    res.status(408).send("Request timeout");
  });
  next();
});

app.use("/api/intelligence", limiter);
app.use("/api/relay", limiter, speedLimiter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

app.use("/api", router);

export default app;
