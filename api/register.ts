import Express from "express";
import bcrypt from "bcrypt";
import User from "../models/User.ts";
import toml from "toml";
import fs from "node:fs";
import axios from "axios";
import { Op } from "sequelize";

const router = Express.Router();

// Load and parse config file
const config = toml.parse(
  fs.readFileSync(process.cwd() + "/config.toml", "utf-8")
);

// Ensure config values exist
if (!config.pterodactyl?.panel || !config.pterodactyl?.api) {
  console.error("Pterodactyl panel URL or API key is missing in config.toml");
  process.exit(1);
}

router.post("/api/register", async (req, res) => {
  const { username, email, firstname, lastname, password } = req.body;

  if (!email || !username || !password) {
    return res.status(400).json({
      success: false,
      status: "failed",
      message: "All fields are required",
    });
  }

  try {
    // Check if user already exists
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [{ email }, { username }],
      },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        status: "failed",
        message: "User with that email or username already exists",
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Post to Pterodactyl API
    let pterodactylUser;
    try {
      const response = await axios.post(
        `${config.pterodactyl.panel}/api/application/users`,
        {
          email,
          username,
          first_name: firstname,
          last_name: lastname,
        },
        {
          headers: {
            Authorization: `Bearer ${config.pterodactyl.api}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        }
      );

      if (!response.data || !response.data.attributes) {
        throw new Error("Invalid response from Pterodactyl API");
      }

      pterodactylUser = response.data.attributes;
    } catch (error) {
      console.error(
        "Pterodactyl API error:",
        error.response?.data || error.message
      );
      return res.status(500).json({
        success: false,
        status: "failed",
        message: "Failed to create user in Pterodactyl",
      });
    }

    // Create user in the database
    const newUser = await User.create({
      id: pterodactylUser.id, // Ensure this ID matches Pterodactyl's response
      username,
      email,
      password: hashedPassword,
    });

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: newUser.get({ plain: true }), // Convert Sequelize model to plain object
    });
  } catch (error) {
    console.error("Error during registration:", error);
    return res.status(500).json({
      success: false,
      status: "failed",
      message: "Internal server error",
    });
  }
});

export default router;
