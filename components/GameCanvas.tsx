import React, { useEffect, useRef } from "react";
import Phaser from "phaser";
import { MainScene } from "../game/scenes/MainScene";
import { CANVAS_BG_COLOR } from "../constants";
import { PlacedItem, PetData, RoomType, EchoMark } from "../types";
import { gameBus } from "../services/eventBus";

interface GameCanvasProps {
  items: PlacedItem[];
  roomType: RoomType;
  ghostItem: { id: string; rotation: number } | null;
  onTileClick: (x: number, y: number) => void;
  onPetClick?: (petId: string) => void;
  currentPet: PetData | null;
  isVisiting: boolean;
  wateredPlants?: Set<string>;
  playerGridPos?: { x: number; y: number };
  tutorialStep: number;
  echoMarks?: EchoMark[];
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  items,
  roomType,
  ghostItem,
  onTileClick,
  onPetClick,
  currentPet,
  isVisiting,
  wateredPlants,
  playerGridPos,
  tutorialStep,
  echoMarks,
}) => {
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<MainScene | null>(null);

  // --- Boot Phaser once ---
  useEffect(() => {
    if (gameRef.current) return;

    const width = window.innerWidth;
    const height = window.innerHeight;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: "phaser-container",
      width: width,
      height: height,
      backgroundColor: CANVAS_BG_COLOR,
      scene: [MainScene],
      physics: { default: "arcade" },
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.NO_CENTER,
      },
      render: {
        antialias: true,
        pixelArt: false,
        roundPixels: true,
        powerPreference: "high-performance",
      },
      autoFocus: true,
    };

    const game = new Phaser.Game(config);
    gameRef.current = game;
    (window as any).game = game;

    game.events.on("ready", () => {
      const scene = game.scene.getScene("MainScene") as MainScene;
      if (scene) {
        sceneRef.current = scene;
        // Initial data push
        scene.setRoomData(
          items,
          roomType,
          currentPet,
          isVisiting,
          wateredPlants,
          tutorialStep,
          echoMarks,
        );
        scene.onTileClick = onTileClick;
        if (onPetClick) scene.onPetClick = onPetClick;
        if (playerGridPos) scene.setPlayerPos(playerGridPos.x, playerGridPos.y);
      }
    });

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
        sceneRef.current = null;
      }
    };
  }, []);

  // --- Room data (items, room type, visiting, pets, tutorial, echoes) ---
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.setRoomData(
        items,
        roomType,
        currentPet,
        isVisiting,
        wateredPlants,
        tutorialStep,
        echoMarks,
      );
    }
  }, [
    items,
    roomType,
    currentPet,
    isVisiting,
    wateredPlants,
    tutorialStep,
    echoMarks,
  ]);

  // --- Ghost item (editor mode) ---
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.setGhostItem(
        ghostItem ? ghostItem.id : null,
        ghostItem ? ghostItem.rotation : 0,
      );
    }
  }, [ghostItem]);

  // --- Tile click handler ---
  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.onTileClick = onTileClick;
    }
  }, [onTileClick]);

  // --- Player position ---
  useEffect(() => {
    if (sceneRef.current && playerGridPos) {
      sceneRef.current.setPlayerPos(playerGridPos.x, playerGridPos.y);
    }
  }, [playerGridPos]);

  // --- Pet click handler ---
  useEffect(() => {
    if (sceneRef.current && onPetClick) {
      sceneRef.current.onPetClick = onPetClick;
    }
  }, [onPetClick]);

  // --- EventBus: floating text ---
  useEffect(() => {
    const handleFloat = (x: number, y: number, text: string, color: string) => {
      sceneRef.current?.showFloatingText(x, y, text, color);
    };
    gameBus.on("floatingText", handleFloat);
    return () => gameBus.off("floatingText", handleFloat);
  }, []);

  return (
    <div
      id="phaser-container"
      className="absolute inset-0 z-0 overflow-hidden"
      style={{ width: "100%", height: "100%" }}
    />
  );
};
