import express from "express";
import config from "../controller/config.ts";
import axios from "axios";
import checkAuth from "../middleware/checkAuth.ts";
import Server from "../models/Server.ts";
import { server } from "typescript";
import User from "../models/User.ts";
const router = express.Router();

router.get("/api/servers/", checkAuth, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "User not found" });
  }
  try {
    const response = await axios.get(
      `${config.pterodactyl.panel}/api/application/users/${req.user.id}/?include=servers`,
      {
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.pterodactyl.api}`,
        },
      }
    );
    // Extract server list and filter out unnecessary fields
    let servers =
      response.data.attributes.relationships?.servers?.data.map(
        (server: any) => ({
          id: server.attributes.id,
          name: server.attributes.name,
          description: server.attributes.description,
          identifier: server.attributes.identifier,
          owner_id: server.attributes.user, // User who owns the server
          memory: server.attributes.limits.memory,
          disk: server.attributes.limits.disk,
          cpu: server.attributes.limits.cpu,
          databases: server.attributes.feature_limits.databases,
          allocations: server.attributes.feature_limits.allocations,
          suspended: server.attributes.suspended,
        })
      ) || [];
    if (servers.length > 0) {
      // Fetch renewal info for all server IDs
      const renewalInfo = await Server.findAll({
        where: {
          id: servers.map((s) => s.id),
        },
      });
      // Convert renewalInfo to a lookup table
      const renewalMap = renewalInfo.reduce((acc: any, info: any) => {
        acc[info.id] = info;
        return acc;
      }, {});
      // Attach renewal data to each server
      servers = servers.map((server) => ({
        ...server,
        renewal: renewalMap[server.id] || null, // Add renewal info or null if not found
      }));
    }
    return res.json({ success: true, servers });
  } catch (error) {
    console.error(
      "Error fetching servers:",
      error.response?.data || error.message
    );
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
});
router.patch("/api/update-server/:id", checkAuth, async (req, res) => {
  const { ram, disk, cpu, databases, allocations, backups, io, swap } =
    req.body;

  if (!req.params.id) {
    return res
      .status(400)
      .json({ success: false, message: "Server ID is required" });
  }

  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const server = await Server.findOne({ where: { id: req.params.id } });
    if (!server) {
      return res
        .status(404)
        .json({ success: false, message: "Server not found!" });
    }

    const serverDetails = await axios.get(
      `${config.pterodactyl.panel}/api/application/servers/${server.identifier}`,
      {
        headers: {
          Authorization: `Bearer ${config.pterodactyl.api}`,
          Accept: "application/json",
        },
      }
    );

    const allocationId = serverDetails.data.attributes.allocation; // Default allocation ID

    if (ram > user.ram)
      return res
        .status(403)
        .json({ success: false, message: "Insufficient RAM" });
    if (disk > user.disk)
      return res
        .status(403)
        .json({ success: false, message: "Insufficient Disk" });
    if (cpu > user.cpu)
      return res
        .status(403)
        .json({ success: false, message: "Insufficient CPU" });
    if (databases > user.databases)
      return res
        .status(403)
        .json({ success: false, message: "Insufficient Databases" });
    if (allocations > user.allocations)
      return res
        .status(403)
        .json({ success: false, message: "Insufficient Allocations" });
    if (backups > user.backups)
      return res
        .status(403)
        .json({ success: false, message: "Insufficient backups" });

    // ✅ Step 3: Send PATCH request to update server limits
    const updateData = {
      allocation: allocationId, // Use fetched allocation ID
      memory: ram,
      swap: swap || 0, // Default 0 (disabled)
      disk: disk,
      io: io || 500, // Default IO priority
      cpu: cpu,
      threads: null, // Allow all cores
      feature_limits: {
        databases: databases,
        allocations: allocations,
        backups: backups || 2, // Default 2 backups
      },
    };

    await axios.patch(
      `${config.pterodactyl.panel}/api/application/servers/${server.identifier}/build`,
      updateData,
      {
        headers: {
          Authorization: `Bearer ${config.pterodactyl.api}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );

    return res.json({
      success: true,
      message: "Server updated successfully",
      server,
    });
  } catch (error) {
    console.error(
      "Error updating server:",
      error.response?.data || error.message
    );
    return res
      .status(500)
      .json({ success: false, message: "Failed to update server" });
  }
});

export default router;
