import coinFlip from "../controller/coinflip.ts";
import express from "express";
import User from "../models/User.ts";
import checkAuth from "../middleware/checkAuth.ts";

const router = express.Router();

router.post("/coinflip", checkAuth, async (req, res) => {
  const { decision, bet } = req.body;
  const { id } = req.user;
  const result = await coinFlip(id, decision, bet);
  const user = await User.findByPk(id);
  return res.json({ userWon: result, availableCoins: user.coins, result });
});

export default router;
