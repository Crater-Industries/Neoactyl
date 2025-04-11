import User from "../models/User";

/**
 * @name coinFlip
 * @desc coinFlip gambling
 * @param userId
 * @param decision
 * @param bet
 */

export default async function coinflip(
  userId: number,
  decision: number,
  bet: number
) {
  const user = await User.findOne({ where: { id: userId } });
  if (!user) return null;
  if (bet > user.coins) return null;
  const result = Math.random();
  if (result !== decision) {
    user.coins -= bet;
    await user.save();
    return false;
  }
  user.coins += bet;
  await user.save();
  return true;
}
