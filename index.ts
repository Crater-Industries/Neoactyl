import Express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import fs from "node:fs";
import toml from "toml";
import fetchEggs from "./controller/fetchEggs.ts";
import fetchNodes from "./controller/fetchNodes.ts";
import db from "./models/db.ts";

// config
const config = toml.parse(fs.readFileSync("./config.toml", "utf-8"));

// Router import
import loginRoute from "./api/login.ts";
import registerRoute from "./api/register.ts";
import createServerRoute from "./api/createServer.ts";
import deleteServerRoute from "./api/deleteServer.ts";
import configRoute from "./api/config.ts";
import renewRoute from "./api/renew.ts"; // Import the renew route
import eggsRoute from "./api/eggs.ts";
import discord from "./api/discord.ts";
import nodeRoute from "./api/nodes.ts";
import serverRoute from "./api/server.ts";
import meRoute from "./api/meRoute.ts";
import { ASCII_ART } from "./ascii.ts";
import googleAuthRoute from "./api/google.ts";
import coinFlipRoute from "./api/coinflip.ts";
import userManagementRoute from "./api/admin/userManagement.ts";
// app
const app = Express();

app.use(bodyParser());
app.use(cors("*"));
app.use(Express.json());
app.use(cookieParser());

// Router define

app.get("/api/", (req, res) => {
  res.json({ status: "running", success: true });
});

app.get("/api/check-auth", (req, res) => {
  const authCookie = req.cookies.authToken; // Adjust based on your auth cookie name
  res.json({ authenticated: !!authCookie });
});

app.use(loginRoute);
app.use(registerRoute);
app.use(createServerRoute);
app.use(deleteServerRoute);
app.use(configRoute);
app.use(renewRoute); // Use the renew route
app.use(eggsRoute);
app.use(discord);
app.use(nodeRoute);
app.use(serverRoute);
app.use(meRoute);
app.use(googleAuthRoute);
app.use(coinFlipRoute);
app.use(userManagementRoute);

app.listen(config.domain.port + 1, () => {
  console.clear();
  console.log("\x1b[36m%s\x1b[0m", ASCII_ART);
  console.log(
    "\x1b[32m%s\x1b[0m",
    "🚀 Dashboard Backend Started Successfully!"
  );
});

fetchEggs().catch((error) => {
  if (error.response?.status === 401) {
    console.log("\n");
    console.log("\x1b[33m%s\x1b[0m", "⚠️  Pterodactyl API Connection Error");
    console.log("\x1b[33m%s\x1b[0m", "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\x1b[37m%s\x1b[0m", "1. Go to your Pterodactyl panel");
    console.log("\x1b[37m%s\x1b[0m", "2. Navigate to: Admin > Application API");
    console.log("\x1b[37m%s\x1b[0m", "3. Create a new API key");
    console.log(
      "\x1b[37m%s\x1b[0m",
      "4. Update your config.toml with the new key"
    );
    console.log(
      "\x1b[37m%s\x1b[0m",
      '   Location: [pterodactyl] > api = "your_api_key"'
    );
    console.log("\x1b[33m%s\x1b[0m", "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  } else {
    console.log("\x1b[31m%s\x1b[0m", "❌ Error fetching eggs:", error.message);
  }
});
fetchNodes().catch((error) => {
  if (error.response?.status === 401) {
    console.log("\n");
    console.log("\x1b[33m%s\x1b[0m", "⚠️  Pterodactyl API Connection Error");
    console.log("\x1b[33m%s\x1b[0m", "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\x1b[37m%s\x1b[0m", "1. Go to your Pterodactyl panel");
    console.log("\x1b[37m%s\x1b[0m", "2. Navigate to: Admin > Application API");
    console.log("\x1b[37m%s\x1b[0m", "3. Create a new API key");
    console.log(
      "\x1b[37m%s\x1b[0m",
      "4. Update your config.toml with the new key"
    );
    console.log(
      "\x1b[37m%s\x1b[0m",
      '   Location: [pterodactyl] > api = "your_api_key"'
    );
    console.log("\x1b[33m%s\x1b[0m", "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  } else {
    console.log("\x1b[31m%s\x1b[0m", "❌ Error fetching Nodes:", error.message);
  }
});
