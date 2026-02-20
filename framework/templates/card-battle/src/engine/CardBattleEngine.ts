/**
 * {{GAME_TITLE}} — Card Battle Engine
 *
 * Handles deck building, card combat, and battle resolution.
 */

import type {
  CardBattleState,
  BattleState,
  CardInstance,
  CardConfig,
} from "../types";

export class CardBattleEngine {
  private cards: Record<string, CardConfig> = {};

  /** Load card definitions */
  loadCards(cards: Record<string, CardConfig>): void {
    this.cards = cards;
  }

  /** Create initial player state */
  createDefaultState(id: string, username: string): CardBattleState {
    return {
      id,
      username,
      coins: 100,
      deck: [
        "fire_imp",
        "water_sprite",
        "earth_golem",
        "wind_fairy",
        "shadow_bat",
      ],
      collection: [
        "fire_imp",
        "water_sprite",
        "earth_golem",
        "wind_fairy",
        "shadow_bat",
      ],
      wins: 0,
      losses: 0,
      currentBattle: null,
    };
  }

  /** Start a battle between two players */
  startBattle(
    playerState: CardBattleState,
    opponentId: string,
    opponentName: string,
  ): BattleState {
    const playerHand = this.drawHand(playerState.deck, 3);
    const opponentHand = this.drawHand(playerState.deck, 3); // AI uses same pool for now

    return {
      opponentId,
      opponentName,
      playerHand,
      opponentHand,
      playerHP: 30,
      opponentHP: 30,
      turn: "player",
      turnNumber: 1,
      log: [
        {
          turn: 0,
          actor: "player",
          action: "start",
          message: "Battle started!",
        },
      ],
    };
  }

  /** Play a card from hand */
  playCard(battle: BattleState, cardIndex: number): BattleState {
    if (battle.turn !== "player" || cardIndex >= battle.playerHand.length) {
      return battle;
    }

    const card = battle.playerHand[cardIndex];
    const config = this.cards[card.cardId];
    const damage = card.currentATK;

    battle.opponentHP = Math.max(0, battle.opponentHP - damage);
    battle.log.push({
      turn: battle.turnNumber,
      actor: "player",
      action: "attack",
      target: "opponent",
      damage,
      message: `${config?.name ?? card.cardId} attacks for ${damage} damage!`,
    });

    if (battle.opponentHP <= 0) {
      battle.log.push({
        turn: battle.turnNumber,
        actor: "player",
        action: "win",
        message: "Victory! 🎉",
      });
      return battle;
    }

    // AI turn
    battle.turn = "opponent";
    return this.aiTurn(battle);
  }

  /** AI opponent takes a turn */
  private aiTurn(battle: BattleState): BattleState {
    if (battle.opponentHand.length === 0) {
      battle.turn = "player";
      battle.turnNumber++;
      return battle;
    }

    const cardIdx = Math.floor(Math.random() * battle.opponentHand.length);
    const card = battle.opponentHand[cardIdx];
    const config = this.cards[card.cardId];
    const damage = card.currentATK;

    battle.playerHP = Math.max(0, battle.playerHP - damage);
    battle.log.push({
      turn: battle.turnNumber,
      actor: "opponent",
      action: "attack",
      target: "player",
      damage,
      message: `${config?.name ?? card.cardId} attacks for ${damage} damage!`,
    });

    if (battle.playerHP <= 0) {
      battle.log.push({
        turn: battle.turnNumber,
        actor: "opponent",
        action: "win",
        message: "Defeat... 😞",
      });
      return battle;
    }

    battle.turn = "player";
    battle.turnNumber++;
    return battle;
  }

  /** Draw cards from deck to create a hand */
  private drawHand(deck: string[], count: number): CardInstance[] {
    const shuffled = [...deck].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count).map((cardId, i) => {
      const config = this.cards[cardId];
      return {
        id: `card_${i}_${Date.now()}`,
        cardId,
        currentHP: config?.health ?? 5,
        currentATK: config?.attack ?? 3,
        effects: [],
      };
    });
  }
}
