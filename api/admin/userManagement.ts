import User from "../../models/User.ts";
import express from "express";
import config from "../../controller/config.ts";
import bcrypt from "bcrypt";
import axios from "axios";
import adminOnly from "../../middleware/adminOnly.ts";
import sequelize from "sequelize";

const router = express.Router();

/**
 * @desc CRUD operations for admin User management with Pterodactyl integration
 */

/**
 * @route GET /api/admin/users
 * @desc Get all users
 * @access Admin only
 */
router.get("/users", adminOnly, async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ["password"] },
    });
    return res.status(200).json({ success: true, data: users });
  } catch (error) {
    console.error("Error fetching users:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * @route GET /api/admin/users/:id
 * @desc Get user by ID
 * @access Admin only
 */
router.get("/users/:id", adminOnly, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ["password"] },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error("Error fetching user:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * @route POST /api/admin/users
 * @desc Create a new user
 * @access Admin only
 */
router.post("/users", adminOnly, async (req, res) => {
  try {
    const {
      username,
      email,
      password,
      ram,
      disk,
      cpu,
      allocations,
      databases,
      backups,
      slots,
      coins,
    } = req.body;

    // Check if user with email already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, error: "Email already in use" });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user in database
    const newUser = await User.create({
      username,
      email,
      password: hashedPassword,
      ram: ram || config.Resources.ram,
      disk: disk || config.Resources.disk,
      cpu: cpu || config.Resources.cpu,
      allocations: allocations || config.Resources.allocations,
      databases: databases || config.Resources.database,
      backups: backups || config.Resources.backup,
      slots: slots || config.Resources.slots,
      coins: coins || 0,
      servers: 0,
      googleId: null,
    });

    // Create user in Pterodactyl panel
    const pterodactylApiUrl = `${config.pterodactyl.panel}/api/application/users`;

    try {
      const response = await axios.post(
        pterodactylApiUrl,
        {
          username: username,
          email: email,
          first_name: username,
          last_name: "User",
          password: password,
          root_admin: false,
        },
        {
          headers: {
            Authorization: `Bearer ${config.pterodactyl.api}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        }
      );

      // Return success with user data (exclude password)
      const userData = newUser.toJSON();
      delete userData.password;

      return res.status(201).json({
        success: true,
        data: userData,
        pterodactyl: response.data.attributes,
      });
    } catch (pterodactylError) {
      // If Pterodactyl user creation fails, delete the user from our database
      await User.destroy({ where: { id: newUser.id } });

      console.error(
        "Pterodactyl API error:",
        pterodactylError.response?.data || pterodactylError.message
      );
      return res.status(500).json({
        success: false,
        error: "Failed to create user in Pterodactyl panel",
        details: pterodactylError.response?.data || pterodactylError.message,
      });
    }
  } catch (error) {
    console.error("Error creating user:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * @route PUT /api/admin/users/:id
 * @desc Update a user
 * @access Admin only
 */
router.put("/users/:id", adminOnly, async (req, res) => {
  try {
    const userId = req.params.id;
    const {
      username,
      email,
      password,
      ram,
      disk,
      cpu,
      allocations,
      databases,
      backups,
      slots,
      coins,
      isSuspended,
    } = req.body;

    // Find user
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // Prepare update data
    const updateData: any = {};

    if (username) updateData.username = username;
    if (email) updateData.email = email;
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }
    if (ram !== undefined) updateData.ram = ram;
    if (disk !== undefined) updateData.disk = disk;
    if (cpu !== undefined) updateData.cpu = cpu;
    if (allocations !== undefined) updateData.allocations = allocations;
    if (databases !== undefined) updateData.databases = databases;
    if (backups !== undefined) updateData.backups = backups;
    if (slots !== undefined) updateData.slots = slots;
    if (coins !== undefined) updateData.coins = coins;
    if (isSuspended !== undefined) updateData.isSuspended = isSuspended;

    // Update user in our database
    await user.update(updateData);

    // If email or username is being updated, update in Pterodactyl as well
    if (
      email ||
      username ||
      password !== undefined ||
      isSuspended !== undefined
    ) {
      try {
        // First, get the Pterodactyl user ID by email
        const userSearchResponse = await axios.get(
          `${config.pterodactyl.panel}/api/application/users?filter[email]=${user.email}`,
          {
            headers: {
              Authorization: `Bearer ${config.pterodactyl.api}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
          }
        );

        const pterodactylUsers = userSearchResponse.data.data;
        if (pterodactylUsers.length === 0) {
          throw new Error("User not found in Pterodactyl panel");
        }

        const pterodactylUserId = pterodactylUsers[0].attributes.id;

        // Update the user in Pterodactyl
        const pterodactylUpdateData: any = {};

        if (username) {
          pterodactylUpdateData.username = username;
          pterodactylUpdateData.first_name = username;
        }
        if (email) pterodactylUpdateData.email = email;
        if (password) pterodactylUpdateData.password = password;

        await axios.patch(
          `${config.pterodactyl.panel}/api/application/users/${pterodactylUserId}`,
          pterodactylUpdateData,
          {
            headers: {
              Authorization: `Bearer ${config.pterodactyl.api}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
          }
        );

        // Handle suspension in Pterodactyl if needed
        if (isSuspended !== undefined) {
          const suspensionEndpoint = isSuspended
            ? `/api/application/users/${pterodactylUserId}/suspend`
            : `/api/application/users/${pterodactylUserId}/unsuspend`;

          await axios.post(
            `${config.pterodactyl.panel}${suspensionEndpoint}`,
            {},
            {
              headers: {
                Authorization: `Bearer ${config.pterodactyl.api}`,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
            }
          );
        }
      } catch (pterodactylError) {
        console.error(
          "Pterodactyl API error:",
          pterodactylError.response?.data || pterodactylError.message
        );
        // We'll continue and just return a warning since the user was updated in our DB
      }
    }

    // Return updated user
    const updatedUser = await User.findByPk(userId, {
      attributes: { exclude: ["password"] },
    });

    return res.status(200).json({ success: true, data: updatedUser });
  } catch (error) {
    console.error("Error updating user:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * @route DELETE /api/admin/users/:id
 * @desc Delete a user
 * @access Admin only
 */
router.delete("/users/:id", adminOnly, async (req, res) => {
  try {
    const userId = req.params.id;

    // Find user
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // Delete from Pterodactyl first
    try {
      // Find Pterodactyl user ID by email
      const userSearchResponse = await axios.get(
        `${config.pterodactyl.panel}/api/application/users?filter[email]=${user.email}`,
        {
          headers: {
            Authorization: `Bearer ${config.pterodactyl.api}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
        }
      );

      const pterodactylUsers = userSearchResponse.data.data;
      if (pterodactylUsers.length > 0) {
        const pterodactylUserId = pterodactylUsers[0].attributes.id;

        // Delete the user in Pterodactyl
        await axios.delete(
          `${config.pterodactyl.panel}/api/application/users/${pterodactylUserId}`,
          {
            headers: {
              Authorization: `Bearer ${config.pterodactyl.api}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
          }
        );
      }
    } catch (pterodactylError) {
      console.error(
        "Pterodactyl API error:",
        pterodactylError.response?.data || pterodactylError.message
      );
      // Continue with deletion in our database even if Pterodactyl deletion fails
    }

    // Delete user from our database
    await user.destroy();

    return res
      .status(200)
      .json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * @route GET /api/admin/users/search
 * @desc Search users by username or email
 * @access Admin only
 */
router.get("/users/search", adminOnly, async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || typeof query !== "string") {
      return res
        .status(400)
        .json({ success: false, error: "Search query is required" });
    }

    const users = await User.findAll({
      where: {
        [sequelize.Op.or]: [
          { username: { [sequelize.Op.like]: `%${query}%` } },
          { email: { [sequelize.Op.like]: `%${query}%` } },
        ],
      },
      attributes: { exclude: ["password"] },
    });

    return res.status(200).json({ success: true, data: users });
  } catch (error) {
    console.error("Error searching users:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * @route GET /api/admin/pterodactyl/users
 * @desc Get all users from Pterodactyl panel
 * @access Admin only
 */
router.get("/pterodactyl/users", adminOnly, async (req, res) => {
  try {
    const response = await axios.get(
      `${config.pterodactyl.panel}/api/application/users`,
      {
        headers: {
          Authorization: `Bearer ${config.pterodactyl.api}`,
          Accept: "application/json",
        },
      }
    );

    return res.status(200).json({ success: true, data: response.data.data });
  } catch (error) {
    console.error(
      "Pterodactyl API error:",
      error.response?.data || error.message
    );
    return res.status(500).json({
      success: false,
      error: "Failed to fetch users from Pterodactyl panel",
      details: error.response?.data || error.message,
    });
  }
});

/**
 * @route POST /api/admin/users/sync-with-pterodactyl
 * @desc Sync a user with Pterodactyl panel (create if doesn't exist)
 * @access Admin only
 */
router.post("/users/sync-with-pterodactyl/:id", adminOnly, async (req, res) => {
  try {
    const userId = req.params.id;

    // Find user
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // Check if user exists in Pterodactyl
    let pterodactylUserId = null;
    try {
      const userSearchResponse = await axios.get(
        `${config.pterodactyl.panel}/api/application/users?filter[email]=${user.email}`,
        {
          headers: {
            Authorization: `Bearer ${config.pterodactyl.api}`,
            Accept: "application/json",
          },
        }
      );

      const pterodactylUsers = userSearchResponse.data.data;
      if (pterodactylUsers.length > 0) {
        // User exists, get ID
        pterodactylUserId = pterodactylUsers[0].attributes.id;
      } else {
        // User doesn't exist, create
        const createResponse = await axios.post(
          `${config.pterodactyl.panel}/api/application/users`,
          {
            username: user.username,
            email: user.email,
            first_name: user.username,
            last_name: "User",
            password: Math.random().toString(36).slice(-10), // Generate random password
            root_admin: false,
          },
          {
            headers: {
              Authorization: `Bearer ${config.pterodactyl.api}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
          }
        );

        pterodactylUserId = createResponse.data.attributes.id;
      }

      // Apply suspension status if needed
      if (user.isSuspended) {
        await axios.post(
          `${config.pterodactyl.panel}/api/application/users/${pterodactylUserId}/suspend`,
          {},
          {
            headers: {
              Authorization: `Bearer ${config.pterodactyl.api}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
          }
        );
      } else {
        // Make sure user is unsuspended
        await axios.post(
          `${config.pterodactyl.panel}/api/application/users/${pterodactylUserId}/unsuspend`,
          {},
          {
            headers: {
              Authorization: `Bearer ${config.pterodactyl.api}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
          }
        );
      }

      return res.status(200).json({
        success: true,
        message: "User synchronized with Pterodactyl panel",
        pterodactylUserId,
      });
    } catch (pterodactylError) {
      console.error(
        "Pterodactyl API error:",
        pterodactylError.response?.data || pterodactylError.message
      );
      return res.status(500).json({
        success: false,
        error: "Failed to sync user with Pterodactyl panel",
        details: pterodactylError.response?.data || pterodactylError.message,
      });
    }
  } catch (error) {
    console.error("Error syncing user:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

/**
 * @route POST /api/admin/users/batch-update
 * @desc Update multiple users at once
 * @access Admin only
 */
router.post("/users/batch-update", adminOnly, async (req, res) => {
  try {
    const { userIds, updateData } = req.body;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "User IDs array is required" });
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "Update data is required" });
    }

    // Extract only allowed fields for batch update
    const allowedFields = [
      "ram",
      "disk",
      "cpu",
      "allocations",
      "databases",
      "backups",
      "slots",
      "coins",
      "isSuspended",
    ];
    const sanitizedUpdateData: any = {};

    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        sanitizedUpdateData[field] = updateData[field];
      }
    }

    if (Object.keys(sanitizedUpdateData).length === 0) {
      return res
        .status(400)
        .json({ success: false, error: "No valid update fields provided" });
    }

    // Update users in database
    const [updatedCount] = await User.update(sanitizedUpdateData, {
      where: { id: userIds },
    });

    // If suspension status is updated, sync with Pterodactyl
    if (sanitizedUpdateData.isSuspended !== undefined) {
      const users = await User.findAll({
        where: { id: userIds },
        attributes: ["email"],
      });

      const emails = users.map((user) => user.email);

      try {
        // Get all users from Pterodactyl that match our emails
        const userSearchResponse = await axios.get(
          `${config.pterodactyl.panel}/api/application/users`,
          {
            headers: {
              Authorization: `Bearer ${config.pterodactyl.api}`,
              Accept: "application/json",
            },
          }
        );

        const pterodactylUsers = userSearchResponse.data.data.filter(
          (user: any) => emails.includes(user.attributes.email)
        );

        // Apply suspension/unsuspension for each user
        for (const pterodactylUser of pterodactylUsers) {
          const pterodactylUserId = pterodactylUser.attributes.id;
          const suspensionEndpoint = sanitizedUpdateData.isSuspended
            ? `/api/application/users/${pterodactylUserId}/suspend`
            : `/api/application/users/${pterodactylUserId}/unsuspend`;

          await axios.post(
            `${config.pterodactyl.panel}${suspensionEndpoint}`,
            {},
            {
              headers: {
                Authorization: `Bearer ${config.pterodactyl.api}`,
                "Content-Type": "application/json",
                Accept: "application/json",
              },
            }
          );
        }
      } catch (pterodactylError) {
        console.error(
          "Pterodactyl API error:",
          pterodactylError.response?.data || pterodactylError.message
        );
        // Continue despite Pterodactyl API errors
      }
    }

    return res.status(200).json({
      success: true,
      message: `Successfully updated ${updatedCount} users`,
    });
  } catch (error) {
    console.error("Error in batch update:", error);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

export default router;
