import path from "node:path";
import fs from "node:fs";
import express, { type Express } from "express";
import cors, { type CorsOptions } from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
const defaultCorsOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];
const allowedCorsOrigins = new Set(
  (process.env.API_CORS_ORIGINS ?? defaultCorsOrigins.join(","))
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);
const corsOptions: CorsOptions = {
  allowedHeaders: ["Authorization", "Content-Type"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  origin(origin, callback) {
    if (!origin) {
      callback(null, false);
      return;
    }
    callback(null, allowedCorsOrigins.has(origin));
  },
};

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);
// Terminal 404 for unmatched /api paths — without it, kiosk mode's SPA
// catch-all below would answer unknown GET /api/* routes with index.html
// and a 200, which the frontend's req() helper then fails to JSON-parse.
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ---------------------------------------------------------------------------
// Kiosk / production static file serving
//
// In kiosk mode (APP_ENV=kiosk or NODE_ENV=production) the Express server
// serves the Vite-built frontend at "/". The install.sh deploys the Vite
// build output to $LETSLEARNOS_INSTALL/web/ (default /opt/letslearnos/web/).
//
// In development, Vite's own dev server serves the frontend; this block is
// not active.
// ---------------------------------------------------------------------------
const isKiosk =
  process.env["APP_ENV"] === "kiosk" ||
  process.env["NODE_ENV"] === "production";

if (isKiosk) {
  const webDir =
    process.env["LETSLEARNOS_WEB_DIR"] ??
    path.join(
      process.env["LETSLEARNOS_INSTALL"] ?? path.join(__dirname, "../../.."),
      "web",
    );

  if (fs.existsSync(webDir)) {
    app.use(express.static(webDir));
    // SPA catch-all: any path that doesn't match an API route or static file
    // returns index.html so React Router can handle client-side navigation.
    // Express 5 (path-to-regexp v8) syntax — "*" alone is no longer valid.
    app.get("/{*splat}", (req, res) => {
      // Asset-like paths (anything with a file extension) must 404 — serving
      // index.html as a 200 here gets cached by the service worker under the
      // asset URL, permanently breaking that image/script even after the
      // file is added.
      if (path.extname(req.path)) {
        res.status(404).end();
        return;
      }
      res.sendFile(path.join(webDir, "index.html"));
    });
    logger.info({ webDir }, "Serving static frontend from disk");
  } else {
    logger.warn({ webDir }, "Kiosk mode: web dir not found — frontend not served");
  }
}

export default app;
