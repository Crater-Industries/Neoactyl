import express from "express";
import jwt from "jsonwebtoken";
import config from "../controller/config.ts"; // Import the config file

const jwtSecret = config.general.jwtSecret;

const checkAuth = async (req, res, next) => {
  try {
    // Get token from cookie
    const token = req.cookies?.authToken;
    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Verify token
    const decoded = jwt.verify(token, jwtSecret);
    const user = await axios.get(
      config.pterodactyl.panel + "/api/application/users/" + decoded.id,
      {
        Headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.pterodactyl.api}`,
        },
      }
    );
    req.user = user.attributes; // Attach user data to request

    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

export default checkAuth;
