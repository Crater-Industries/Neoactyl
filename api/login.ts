import Express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import User from "../models/User.ts";
import toml from "toml";
import fs from "node:fs";
import axios from "axios";

const router = Express.Router();

const config = toml.parse(
  fs.readFileSync(process.cwd() + "/config.toml", "utf-8")
);

router.post("/api/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.json({
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
      return res.json({
        success: false,
        status: "failed",
        message: "No user found with those credentials",
      });
    }

    // Compare password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.json({
        success: false,
        status: "failed",
        message: "Password mismatched, try again or reset your password",
      });
    }

    // Fetch user details from Pterodactyl API
    const ptrlUserResponse = await axios.get(
      `${config.pterodactyl.panel}/api/application/users/${user.id}`,
      {
        headers: {
          Authorization: `Bearer ${config.pterodactyl.api}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );

    const ptrlUser = ptrlUserResponse.data.attributes;

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
    user.lastLoggedInFrom = ip;
    await user.save();

    // Generate token with environment secret key
    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email,

        admin: ptrlUser.root_admin, // true if user is an admin
      },
      config.general.jwtSecret,
      { expiresIn: "1h" }
    );

    // Set token as an HttpOnly cookie
    res.cookie("authToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" || false,
      sameSite: "Strict",
      maxAge: 3600000, // 1 hour
    });

    return res.json({
      success: true,
      message: "Login successful",
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        admin: ptrlUser.root_admin, // true if user is an admin
      },
    });
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
