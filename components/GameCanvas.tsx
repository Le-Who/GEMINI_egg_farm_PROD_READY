
import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import { MainScene } from '../game/scenes/MainScene';
import { CANVAS_BG_COLOR } from '../constants';
import { PlacedItem, PetData, RoomType } from '../types';

interface GameCanvasProps {
  items: PlacedItem[];
  roomType: RoomType;
  ghostItem: { id: string; rotation: number } | null;
  onTileClick: (x: number, y: number) => void;
  onFloatingText?: (x: number, y: number, text: string, color: string) => void;
  currentPet: PetData | null;
  isVisiting: boolean;
  wateredPlants?: Set<string>;
  playerGridPos?: { x: number; y: number };
  tutorialStep: number;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({ 
    items, roomType, ghostItem, onTileClick, currentPet, isVisiting, wateredPlants, playerGridPos, tutorialStep 
}) => {
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<MainScene | null>(null);

  useEffect(() => {
    if (gameRef.current) return;

    // Ensure valid dimensions to prevent "Framebuffer status: Incomplete Attachment"
    const width = Math.max(window.innerWidth, 800);
    const height = Math.max(window.innerHeight, 600);

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: 'phaser-container',
      width: width,
      height: height,
      backgroundColor: CANVAS_BG_COLOR,
      scene: [MainScene],
      physics: { default: 'arcade' },
      scale: {
        mode: Phaser.Scale.RESIZE,
        // When using RESIZE, use NO_CENTER to avoid conflicts with CSS layout
        autoCenter: Phaser.Scale.NO_CENTER,
      },
      render: {
        antialias: true,
        pixelArt: false,
        roundPixels: true,
        powerPreference: 'high-performance'
      },
      autoFocus: true,
    };

    const game = new Phaser.Game(config);
    gameRef.current = game;
    (window as any).game = game; // Expose for floating text trigger hack

    game.events.on('ready', () => {
      const scene = game.scene.getScene('MainScene') as MainScene;
      if (scene) {
        sceneRef.current = scene;
        scene.setRoomData(items, roomType, currentPet, isVisiting, wateredPlants, tutorialStep);
        scene.onTileClick = onTileClick;
        if(playerGridPos) scene.setPlayerPos(playerGridPos.x, playerGridPos.y);
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

  useEffect(() => {
    if (sceneRef.current) {
      sceneRef.current.setRoomData(items, roomType, currentPet, isVisiting, wateredPlants, tutorialStep);
      sceneRef.current.onTileClick = onTileClick;
      sceneRef.current.setGhostItem(ghostItem ? ghostItem.id : null, ghostItem ? ghostItem.rotation : 0);
      if(playerGridPos) sceneRef.current.setPlayerPos(playerGridPos.x, playerGridPos.y);
    }
  }, [items, roomType, ghostItem, onTileClick, currentPet, isVisiting, wateredPlants, playerGridPos, tutorialStep]);

  return <div id="phaser-container" className="absolute inset-0 z-0 overflow-hidden" style={{ width: '100%', height: '100%' }} />;
};
