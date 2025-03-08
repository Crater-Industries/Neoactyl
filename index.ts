import Express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import fs from "node:fs";
import toml from "toml";
import fetchEggs from "./controller/fetchEggs.ts";
import { spawn } from "child_process"; // Import child_process

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

// Start the frontend development server
const startFrontend = () => {
  const frontendProcess = spawn('npm', ['run', 'dev'], {
    cwd: './app', // Path to your frontend directory
    stdio: 'inherit', // Inherit stdio to see the output in the terminal
    shell: true, // Use shell to execute the command
  });

  frontendProcess.on('close', (code) => {
    console.log(`Frontend process exited with code ${code}`);
  });
};

// Start the backend server
app.listen(config.domain.port, () => {
  console.log(`Dashboard Running on port ${config.domain.port}`);
  startFrontend(); // Start the frontend when the backend starts
});

fetchEggs();
