/**
 * ═══════════════════════════════════════════════════════
 *  Game Hub — Building Blox Routes
 *  Start game (energy gate), end game (gold reward)
 * ═══════════════════════════════════════════════════════
 */
import { Router } from "express";
import { ECONOMY, calcRegen, calcBloxReward } from "../game-logic.js";
import { getPlayer, debouncedSaveDb } from "../playerManager.js";

export default function bloxRoutes(requireAuth, resolveUser) {
  const router = Router();

  router.post("/api/blox/start", requireAuth, (req, res) => {
    const { userId, username } = resolveUser(req);
    if (!userId) return res.status(400).json({ error: "userId required" });
    const p = getPlayer(userId, username);
    calcRegen(p);

    if (p.resources.energy.current < ECONOMY.COST_BLOX) {
      return res.status(400).json({
        error: "NOT_ENOUGH_ENERGY",
        required: ECONOMY.COST_BLOX,
        current: p.resources.energy.current,
      });
    }
    p.resources.energy.current -= ECONOMY.COST_BLOX;
    p.blox.totalGames++;
    debouncedSaveDb();
    res.json({
      success: true,
      resources: p.resources,
      highScore: p.blox.highScore,
    });
  });

  router.post("/api/blox/end", requireAuth, (req, res) => {
    const { userId } = resolveUser(req);
    const { score, linesCleared } = req.body;
    const p = getPlayer(userId);
    const goldReward = calcBloxReward(score);
    p.resources.gold += goldReward;
    if (typeof score === "number" && score > 0) {
      p.blox.highScore = Math.max(p.blox.highScore, score);
    }
    debouncedSaveDb();
    res.json({
      success: true,
      resources: p.resources,
      goldReward,
      highScore: p.blox.highScore,
    });
  });

  return router;
}
