import User from "../models/User.ts";
import express from "express";
import checkAuth from "../middleware/checkAuth.ts";
import config from "../controller/config.ts";

const router = express.Router();

// Get shop items and pricing
router.get("/shop", (noneed, res) => {
  res.json({ success: true, items: config.shop });
});

// Purchase route for resources
router.post("/shop/buy", checkAuth, async (req, res) => {
  try {
    const { resourceType, amount } = req.body;
    const userId = req.user.id;

    // Get the user
    const user = await User.findByPk(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Check if resource type exists
    if (!config.shop[resourceType]) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid resource type" });
    }

    // Calculate total cost
    const unitPrice = config.shop[resourceType];
    const totalCost = unitPrice * amount;

    // Check if user has enough coins
    if (user.coins < totalCost) {
      return res
        .status(400)
        .json({ success: false, message: "Insufficient coins" });
    }

    // Update user resources
    user.coins -= totalCost;
    user[resourceType] += amount;

    await user.save();

    return res.json({
      success: true,
      message: "Purchase successful",
      newBalance: user.coins,
      resourceUpdated: {
        type: resourceType,
        amount: user[resourceType],
      },
    });
  } catch (error) {
    console.error("Shop purchase error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
});

// Get user's current resources
router.get("/shop/resources", checkAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findByPk(userId, {
      attributes: [
        "coins",
        "ram",
        "disk",
        "cpu",
        "allocations",
        "databases",
        "backups",
        "slots",
        "servers",
      ],
    });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    return res.json({
      success: true,
      resources: {
        coins: user.coins,
        ram: user.ram,
        disk: user.disk,
        cpu: user.cpu,
        allocations: user.allocations,
        databases: user.databases,
        backups: user.backups,
        slots: user.slots,
        servers: user.servers,
      },
      pricing: config.shop,
    });
  } catch (error) {
    console.error("Shop resources error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
});

export default router;
