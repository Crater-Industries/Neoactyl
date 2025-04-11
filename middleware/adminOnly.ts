import express from "express";
import jwt from "jsonwebtoken";
import axios from "axios"; // Missing import
import config from "../controller/config.ts";
import User from "../models/User.ts";
const jwtSecret = config.general.jwtSecret;

const checkAuth = async (req, res, next) => {
  try {
    // Get token from cookie
    const token = req.cookies?.authToken;
    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Ip validation
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

    // Verify token
    const decoded = jwt.verify(token, jwtSecret);

    // Find user in database
    const dbUser = await User.findByPk(decoded.id);
    if (!dbUser) {
      return res.status(401).json({ message: "User not found" });
    }

    // Check IP match
    if (ip !== dbUser.lastLoggedInFrom) {
      return res
        .clearCookie("authToken")
        .status(401)
        .json({ success: false, error: "Last logged in IP doesn't match" });
    }

    // Verify admin status with Pterodactyl API
    try {
      const pterodactylResponse = await axios.get(
        `${config.pterodactyl.panel}/api/application/users/${decoded.id}`,
        {
          headers: {
            // Fixed from "Headers" to "headers"
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.pterodactyl.api}`,
          },
        }
      );

      const pterodactylUser = pterodactylResponse.data;

      if (!pterodactylUser.attributes.admin) {
        return res.status(403).json({ success: false, error: "Not an admin" });
      }

      // Attach user data to request
      req.user = pterodactylUser.attributes;

      next();
    } catch (apiError) {
      console.error("Pterodactyl API error:", apiError);
      return res.status(500).json({ message: "Error verifying admin status" });
    }
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

export default checkAuth;
