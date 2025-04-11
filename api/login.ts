import Express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import User from "../models/User.ts";
import toml from "toml";
import fs from "node:fs";
import axios from "axios";

const router = Express.Router();

// Move config parsing outside of the route handler for better performance
const config = toml.parse(
  fs.readFileSync(process.cwd() + "/config.toml", "utf-8")
);

router.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      status: "failed",
      message: "All fields are required",
    });
  }

  try {
    const user = await User.findOne({
      where: {
        username,
      },
    });

    if (!user) {
      // Use 401 for authentication failures
      return res.status(401).json({
        success: false,
        status: "failed",
        message: "Invalid credentials",
      });
    }

    // Compare password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      // Use 401 for authentication failures and don't reveal specific info
      return res.status(401).json({
        success: false,
        status: "failed",
        message: "Invalid credentials",
      });
    }

    // Get IP address
    const ip =
      // Get from x-forwarded-for header (typical with proxies)
      (typeof req.headers["x-forwarded-for"] === "string"
        ? req.headers["x-forwarded-for"].split(",")[0].trim()
        : Array.isArray(req.headers["x-forwarded-for"])
        ? req.headers["x-forwarded-for"][0]
        : undefined) ||
      // Try other common headers
      req.headers["x-real-ip"] ||
      req.headers["x-client-ip"] ||
      req.headers["cf-connecting-ip"] ||
      // Fall back to socket
      req.socket.remoteAddress;

    // Update last login IP
    user.lastLoggedInFrom = ip;
    await user.save();

    try {
      // Fetch user details from Pterodactyl API
      const ptrlUserResponse = await axios.get(
        `${config.pterodactyl.panel}/api/application/users/${user.id}`,
        {
          headers: {
            Authorization: `Bearer ${config.pterodactyl.api}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          timeout: 5000, // Add timeout to prevent hanging
        }
      );

      const ptrlUser = ptrlUserResponse.data.attributes;

      // Generate token with environment secret key
      const token = jwt.sign(
        {
          id: user.id,
          username: user.username,
          email: user.email,
          admin: ptrlUser.root_admin,
          iat: Math.floor(Date.now() / 1000), // Include issued at time
        },
        config.general.jwtSecret,
        { expiresIn: "1h" }
      );

      // Set token as an HttpOnly cookie
      res.cookie("authToken", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict", // Use lowercase for consistency
        maxAge: 3600000, // 1 hour
        path: "/", // Explicitly set path
      });

      return res.json({
        success: true,
        message: "Login successful",
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          admin: ptrlUser.root_admin,
        },
      });
    } catch (apiError) {
      console.error("Error fetching user from Pterodactyl API:", apiError);

      // Handle API failure gracefully - still allow login but without admin status
      const token = jwt.sign(
        {
          id: user.id,
          username: user.username,
          email: user.email,
          admin: false, // Default to non-admin if API fails
          iat: Math.floor(Date.now() / 1000), // Include issued at time
        },
        config.general.jwtSecret,
        { expiresIn: "1h" }
      );

      res.cookie("authToken", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 3600000, // 1 hour
        path: "/",
      });

      return res.json({
        success: true,
        message:
          "Login successful with limited access (admin status unavailable)",
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          admin: false,
        },
      });
    }
  } catch (error) {
    console.error("Error during login:", error);
    return res.status(500).json({
      success: false,
      status: "failed",
      message: "Internal server error",
    });
  }
});

export default router;
