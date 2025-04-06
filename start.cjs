const express = require("express");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { createProxyMiddleware } = require("http-proxy-middleware");
const toml = require("toml");

// Load and parse config file
const config = toml.parse(fs.readFileSync("./config.toml", "utf-8"));
// configs
const CONTROLLER_PORT = config.domain.port;
const APP_PATH = path.join(__dirname, "index.ts");
const RESTART_HTML = path.join(__dirname, "/restarter/restarter.html");

// App state
let appProcess = null;
let isRestarting = false;
let intentionalExit = false;
let appPort = null;
let proxyMiddleware = null;

// Create controller server
const app = express();
const server = http.createServer(app);

// Serve static restart page
app.use(express.static(path.join(__dirname)));

// Status endpoint
app.get("/status", (req, res) => {
  res.json({
    status: isRestarting ? "restarting" : appProcess ? "running" : "crashed",
    since: new Date().toISOString(),
  });
});

// Function to create a new proxy middleware
function createNewProxy(port) {
  return createProxyMiddleware({
    target: `http://localhost:${port}`,
    ws: true, // Enable WebSocket proxying for Socket.IO
    changeOrigin: true,
    logLevel: "silent",
    onError: (err, req, res, next) => {
      console.log(`Proxy error: ${err.message}`);

      // If the response has already started, we can't send a new response
      if (res.headersSent) {
        return next(err);
      }

      // Set status to restarting since the app is unreachable
      isRestarting = true;

      // For API requests, return JSON error
      if (req.path.startsWith("/api/") || req.path === "/status") {
        res.status(503).json({
          error: "Service temporarily unavailable",
          status: "restarting",
        });
      }
      // For status checks, return appropriate status
      else if (req.path === "/status") {
        res.status(200).json({
          status: "restarting",
          since: new Date().toISOString(),
        });
      }
      // For all other requests, serve the restart page
      else {
        res.sendFile(RESTART_HTML);
      }
    },
    pathRewrite: {
      // Optionally rewrite paths here if needed
    },
  });
}
// Request handler - either proxy to app or show restart page
app.use((req, res, next) => {
  if (appProcess && !isRestarting && proxyMiddleware) {
    // App is running, proxy the request
    proxyMiddleware(req, res, next);
  } else {
    // App is restarting or crashed, serve the restart page
    if (req.path === "/status") {
      // Skip for status endpoint, as it's already handled
      return next();
    }
    res.sendFile(RESTART_HTML);
  }
});

app.get(":path", (req, res) => {
  if (!appProcess && !!isRestarting && !proxyMiddleware) {
    res.sendFile(RESTART_HTML);
  }
});

// Start controller server
server.listen(CONTROLLER_PORT, () => {
  console.log(`Controller running on port ${CONTROLLER_PORT}`);
  startApp();
});

// Function to start/restart the application
function startApp() {
  if (appProcess) {
    console.log("App is already running, restarting...");
    return;
  }

  isRestarting = true;
  console.log("Starting application...");

  // Find a free port for the app
  appPort = CONTROLLER_PORT + 1;

  // Spawn the app process
  appProcess = spawn("npx", ["ts-node", APP_PATH], {
    env: { ...process.env, PORT: appPort },
    stdio: "inherit",
  });

  // Create a new proxy middleware pointing to the app port
  proxyMiddleware = createNewProxy(appPort);

  // Handle app process exit
  appProcess.on("exit", (code) => {
    console.log(`App process exited with code ${code}`);
    appProcess = null;

    if (intentionalExit) {
      // If we intentionally killed it, restart
      intentionalExit = false;
      setTimeout(startApp, 1000);
    } else {
      // If it crashed, set restarting to false to show crash page
      isRestarting = false;
      console.log("App crashed. Waiting for manual restart or file changes");
      // Optionally auto-restart after crash
      setTimeout(startApp, 5000);
    }
  });

  // Once app is running
  setTimeout(() => {
    isRestarting = false;
    console.log(
      `App running on internal port ${appPort}, proxying from ${CONTROLLER_PORT}`
    );
  }, 3000); // Allow time for the app to start
}

// Watch for file changes to trigger restart
const watchDirs = [path.join(__dirname, "/")];

watchDirs.forEach((dir) => {
  fs.watch(dir, { recursive: true }, (eventType, filename) => {
    if (filename && !isRestarting) {
      console.log(`File ${filename} changed, restarting app...`);
      startApp();
    }
  });
});

// Handle controller process signals
process.on("SIGINT", () => {
  console.log("Controller shutting down...");
  if (appProcess) {
    intentionalExit = true;
    appProcess.kill();
  }
  server.close(() => {
    process.exit(0);
  });
});
