import React, { useState, useEffect, useCallback, useRef } from "react";
import { GameCanvas } from "./components/GameCanvas";
import { HUD } from "./components/ui/HUD";
import { ShopModal } from "./components/ui/ShopModal";
import { EditorBar } from "./components/ui/EditorBar";
import { SeedBagModal } from "./components/ui/SeedBagModal";
import { NeighborsPanel } from "./components/ui/NeighborsPanel";
import { PetsModal } from "./components/ui/PetsModal";
import { QuestsPanel } from "./components/ui/QuestsPanel";
import { TutorialOverlay } from "./components/ui/TutorialOverlay";
import { ConfirmationModal } from "./components/ui/ConfirmationModal";
import { GameEngine } from "./services/gameEngine";
import { discordService } from "./services/discord"; // REAL Service
import { UserState, ItemType, RoomType } from "./types";
import {
  ITEMS,
  CROPS,
  loadContent,
  refreshArrayRefs,
  startContentPolling,
} from "./constants";
import { Loader2, ArrowLeft } from "lucide-react";
import Phaser from "phaser";
import { gameBus } from "./services/eventBus";

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserState | null>(null); // Me
  const [displayUser, setDisplayUser] = useState<UserState | null>(null); // Who we are looking at

  // Modals
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [isSeedBagOpen, setIsSeedBagOpen] = useState(false);
  const [isNeighborsOpen, setIsNeighborsOpen] = useState(false);
  const [isPetsModalOpen, setIsPetsModalOpen] = useState(false);
  const [isQuestsOpen, setIsQuestsOpen] = useState(false);

  // IAP Confirmation
  const [pendingSku, setPendingSku] = useState<string | null>(null);

  // Editor / Interaction State
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [targetPlanterId, setTargetPlanterId] = useState<string | null>(null);
  const [playerGridPos, setPlayerGridPos] = useState({ x: 7, y: 7 });

  // Visiting State
  const [wateredPlants, setWateredPlants] = useState<Set<string>>(new Set());

  // Notification System
  const [notification, setNotification] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);
  const notificationTimeoutRef = useRef<any>(null);
  const lastActionRef = useRef<number>(0);

  const prevLevelRef = useRef<number>(1);

  // Derived State
  const isVisiting = currentUser?.id !== displayUser?.id;

  // Initialize Discord & Fetch User
  useEffect(() => {
    const initGame = async () => {
      try {
        await loadContent(); // Load dynamic content from API
        refreshArrayRefs(); // Update array-based constants
        await discordService.init(); // Wait for Discord SDK
        const u = await GameEngine.getUser();
        setCurrentUser(u);
        setDisplayUser(u);

        // Set Initial Activity
        discordService.setActivity("Tending to the garden", "Lvl " + u.level);

        // Start polling for CMS content updates (every 30s)
        startContentPolling(() => {
          refreshArrayRefs();
          console.log("Content refreshed from CMS");
        });
      } catch (e) {
        console.error("Game Init Failed", e);
      }
    };
    initGame();
  }, []);

  // Poll for Updates & Activity
  useEffect(() => {
    if (!currentUser) return;

    // Level Up Notification
    if (currentUser.level > prevLevelRef.current) {
      showNotification(
        `LEVEL UP! You are now level ${currentUser.level}`,
        "success",
      );
      prevLevelRef.current = currentUser.level;
    }

    // Update Discord Rich Presence
    const petText =
      currentUser.pets.length > 0
        ? `w/ ${currentUser.pets.find((p) => p.id === currentUser.equippedPetId)?.name || "Pet"}`
        : "Solo";

    discordService.setActivity(`Lvl ${currentUser.level} Gardener`, petText);
  }, [currentUser]);

  // Polling loop for state sync (simulated backend sync)
  useEffect(() => {
    const interval = setInterval(async () => {
      if (!isEditMode && currentUser) {
        // Don't overwrite optimistic updates from recent actions
        if (Date.now() - lastActionRef.current < 3000) return;
        const u = await GameEngine.getUser();
        setCurrentUser(u);
        if (!isVisiting) setDisplayUser(u);
      }
    }, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, [isEditMode, isVisiting, currentUser]);

  // ESC key handler: deselect item → exit edit mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedItemId) {
          setSelectedItemId(null);
        } else if (isEditMode) {
          setIsEditMode(false);
        } else if (isShopOpen) {
          setIsShopOpen(false);
        } else if (isPetsModalOpen) {
          setIsPetsModalOpen(false);
        } else if (isQuestsOpen) {
          setIsQuestsOpen(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedItemId, isEditMode, isShopOpen, isPetsModalOpen, isQuestsOpen]);

  const showNotification = useCallback(
    (msg: string, type: "success" | "error") => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
      setNotification({ msg, type });
      notificationTimeoutRef.current = setTimeout(() => {
        setNotification(null);
        notificationTimeoutRef.current = null;
      }, 3000);
    },
    [],
  );

  // Floating Text Helper — via EventBus (decoupled from Phaser)
  const triggerFloatingText = (
    x: number,
    y: number,
    text: string,
    color: string,
  ) => {
    gameBus.emit("floatingText", x, y, text, color);
  };

  const handleOpenShop = async () => {
    setIsShopOpen(true);
    if (currentUser && !currentUser.completedTutorial) {
      const updatedUser = await GameEngine.triggerTutorial("OPEN_SHOP");
      setCurrentUser(updatedUser);
    }
  };

  const handleBuy = async (itemId: string) => {
    if (!currentUser) return;
    const result = await GameEngine.buyItem(itemId);
    if (result.success && result.newState) {
      setCurrentUser(result.newState);
      if (!isVisiting) setDisplayUser(result.newState);
      lastActionRef.current = Date.now();
      showNotification("Item purchased!", "success");
    } else {
      showNotification(result.message || "Failed to buy", "error");
    }
  };

  // IAP Flow
  const handleBuyGemRequest = (skuId: string) => {
    setPendingSku(skuId);
  };

  const confirmBuyGem = async () => {
    if (!pendingSku) return;
    const result = await GameEngine.buyPremiumCurrency(pendingSku);
    if (result.success && result.newState) {
      setCurrentUser(result.newState);
      showNotification(result.message || "Purchase successful!", "success");
    } else {
      showNotification("Purchase failed", "error");
    }
    setPendingSku(null);
  };

  const handlePlant = async (cropId: string) => {
    if (!targetPlanterId) return;
    const result = await GameEngine.plantSeed(targetPlanterId, cropId);
    if (result.success && result.newState) {
      setCurrentUser(result.newState);
      if (!isVisiting) setDisplayUser(result.newState);
      lastActionRef.current = Date.now();
      showNotification(result.message || "Planted!", "success");
      setIsSeedBagOpen(false);
      setTargetPlanterId(null);
    } else {
      showNotification(result.message || "Could not plant", "error");
    }
  };

  const handleVisit = async (neighborId: string) => {
    setNotification({ msg: "Traveling...", type: "success" });
    const neighborState = await GameEngine.visitNeighbor(neighborId);
    setDisplayUser(neighborState);
    setIsNeighborsOpen(false);
    setIsEditMode(false);
    // setWateredPlants(new Set()); // Removed local clear to rely on backend
    setPlayerGridPos({ x: 7, y: 7 }); // Reset spawn
    showNotification(`Visiting ${neighborState.username}`, "success");

    // Update Rich Presence
    discordService.setActivity("Visiting a neighbor", "Helping out");
  };

  const handleReturnHome = () => {
    setDisplayUser(currentUser);
    // setWateredPlants(new Set()); // Removed local clear
    setPlayerGridPos({ x: 7, y: 7 });
    showNotification("Returned Home", "success");
  };

  const handleEquipPet = async (petId: string) => {
    const result = await GameEngine.equipPet(petId);
    if (result.success && result.newState) {
      setCurrentUser(result.newState);
      if (!isVisiting) setDisplayUser(result.newState);
      showNotification("Pet equipped!", "success");
    }
  };

  const handleSwitchRoom = async (type: RoomType) => {
    // When visiting, switch the displayed neighbor's room locally (no server call)
    if (isVisiting && displayUser) {
      if (!displayUser.rooms[type]?.unlocked) {
        showNotification("This room is locked", "error");
        return;
      }
      setDisplayUser({ ...displayUser, currentRoom: type });
      showNotification(`Viewing ${type}`, "success");
      return;
    }

    const result = await GameEngine.switchRoom(type);
    if (result.success && result.newState) {
      setCurrentUser(result.newState);
      setDisplayUser(result.newState);
      showNotification(`Entered ${type}`, "success");
    } else {
      showNotification(result.message || "Locked", "error");
    }
  };

  const handleTileClick = useCallback(
    async (x: number, y: number) => {
      if (!currentUser || !displayUser) return;

      // Move Player
      setPlayerGridPos({ x, y });

      const currentRoomItems = displayUser.rooms[displayUser.currentRoom].items;

      // --- VISITOR MODE ---
      if (isVisiting) {
        const item = currentRoomItems.find(
          (i) => i.gridX === x && i.gridY === y,
        );
        if (item && item.cropData) {
          // Optimistic check
          if (wateredPlants.has(item.id)) {
            showNotification("Already watered this plant!", "error");
            return;
          }

          const res = await GameEngine.waterNeighborPlant(
            displayUser.id,
            item.id,
          );
          if (res.success) {
            showNotification(res.message, "success");
            setWateredPlants((prev) => new Set(prev).add(item.id));
            triggerFloatingText(x, y, "+5 Soc XP", "#ffff00");
          } else {
            showNotification(res.message, "error");
          }
        }
        return;
      }

      // --- OWNER MODE ---

      // 1. CONSUMABLE USAGE (New)
      // If edit mode is open and an item is selected, check if it is consumable
      if (isEditMode && selectedItemId) {
        const itemConfig = ITEMS[selectedItemId];
        if (itemConfig && itemConfig.type === ItemType.CONSUMABLE) {
          const result = await GameEngine.useConsumable(selectedItemId, x, y);
          if (result.success && result.newState) {
            setCurrentUser(result.newState);
            setDisplayUser(result.newState);
            triggerFloatingText(x, y, "MAGIC!", "#ff00ff");
            showNotification(result.message || "Item Used", "success");
          } else {
            showNotification(result.message || "Cannot use item here", "error");
          }
          return; // Don't proceed to place logic
        }
      }

      // 2. PLACE MODE
      if (isEditMode && selectedItemId) {
        const result = await GameEngine.placeItem(
          selectedItemId,
          x,
          y,
          rotation,
        );
        if (result.success && result.newState) {
          setCurrentUser(result.newState);
          setDisplayUser(result.newState);
        } else {
          showNotification(result.message || "Cannot place here", "error");
        }
        return;
      }

      // 3. INTERACTION MODE
      if (!isEditMode) {
        const item = currentRoomItems.find(
          (i) => i.gridX === x && i.gridY === y,
        );
        if (!item) return;

        const config = ITEMS[item.itemId];

        // INCUBATOR
        if (config.type === ItemType.INCUBATOR) {
          if (!item.meta?.eggId) {
            const eggId = Object.keys(currentUser.inventory).find(
              (k) =>
                ITEMS[k]?.type === ItemType.EGG && currentUser.inventory[k] > 0,
            );

            if (eggId) {
              const res = await GameEngine.placeEgg(item.id, eggId);
              if (res.success && res.newState) {
                setCurrentUser(res.newState);
                setDisplayUser(res.newState);
                showNotification("Egg placed!", "success");
              } else {
                showNotification(res.message || "Failed to place egg", "error");
              }
            } else {
              showNotification(
                "You don't have any eggs! Buy one at the shop.",
                "error",
              );
            }
            return;
          }
        }

        // PLANTER
        if (config.type === ItemType.PLANTER) {
          if (!item.cropData) {
            setTargetPlanterId(item.id);
            setIsSeedBagOpen(true);
            return;
          }
        }

        // GENERIC INTERACT
        const result = await GameEngine.harvestOrPickup(x, y);
        if (result.success && result.newState) {
          setCurrentUser(result.newState);
          setDisplayUser(result.newState);

          if (result.action === "harvest") {
            if (result.reward) {
              triggerFloatingText(x, y, `+${result.reward}G`, "#ffff00");
              showNotification(`+${result.reward} Gold | +XP`, "success");
            } else showNotification(result.message || "Harvested", "success");
          } else if (result.action === "pickup") {
            showNotification("Item put in inventory", "success");
          } else if (result.action === "hatch") {
            triggerFloatingText(x, y, "HATCHED!", "#ff00ff");
            showNotification(result.message || "Hatched!", "success");
          }
        } else {
          // Silent fail or low priority message
        }
      }
    },
    [
      currentUser,
      displayUser,
      isVisiting,
      isEditMode,
      selectedItemId,
      rotation,
      wateredPlants,
      showNotification,
    ],
  );

  const toggleEditMode = () => {
    setIsEditMode(!isEditMode);
    setSelectedItemId(null);
    setRotation(0);
    setIsSeedBagOpen(false);
  };

  if (!currentUser || !displayUser) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#2f3136] text-white flex-col gap-4">
        <Loader2 className="animate-spin w-12 h-12 text-indigo-500" />
        <p className="font-mono animate-pulse">Connecting to Discord...</p>
      </div>
    );
  }

  // Determine current pet to display
  // Use currentUser's pet if available (My pet follows me)
  const myPetId = currentUser.equippedPetId;
  const myPet = myPetId ? currentUser.pets.find((p) => p.id === myPetId) : null;

  const currentRoomItems = displayUser.rooms[displayUser.currentRoom].items;

  return (
    <div className="relative w-full h-full overflow-hidden font-sans select-none">
      <GameCanvas
        items={currentRoomItems}
        roomType={displayUser.currentRoom}
        onTileClick={handleTileClick}
        ghostItem={
          isEditMode && selectedItemId ? { id: selectedItemId, rotation } : null
        }
        currentPet={myPet || null}
        isVisiting={isVisiting}
        wateredPlants={wateredPlants}
        playerGridPos={playerGridPos}
        tutorialStep={currentUser.tutorialStep}
        lastAction={isVisiting ? displayUser.lastAction : null}
      />

      {isVisiting && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-blue-600 px-6 py-2 rounded-full shadow-lg z-50 flex items-center gap-4 animate-slide-down">
          <span className="text-white font-bold">
            Visiting {displayUser.username}
          </span>
          <button
            onClick={handleReturnHome}
            className="bg-white text-blue-600 px-3 py-1 rounded-full text-sm font-bold hover:bg-gray-100 flex items-center gap-1 transition-colors"
          >
            <ArrowLeft size={14} /> Return Home
          </button>
        </div>
      )}

      <HUD
        user={currentUser}
        displayUser={displayUser || undefined}
        onOpenShop={handleOpenShop}
        onOpenPets={() => setIsPetsModalOpen(true)}
        onOpenQuests={() => setIsQuestsOpen(true)}
        onToggleEdit={toggleEditMode}
        onToggleNeighbors={() => setIsNeighborsOpen(!isNeighborsOpen)}
        onSwitchRoom={handleSwitchRoom}
        isEditMode={isEditMode}
        isNeighborsOpen={isNeighborsOpen}
      />

      <TutorialOverlay user={currentUser} onUpdateUser={setCurrentUser} />

      <NeighborsPanel
        isOpen={isNeighborsOpen}
        onToggle={() => setIsNeighborsOpen(!isNeighborsOpen)}
        onVisit={handleVisit}
      />

      {isEditMode && (
        <EditorBar
          user={currentUser}
          selectedItemId={selectedItemId}
          rotation={rotation}
          onSelect={setSelectedItemId}
          onRotate={() => setRotation((r) => (r + 1) % 4)}
          onClose={toggleEditMode}
        />
      )}

      <ShopModal
        isOpen={isShopOpen}
        onClose={() => setIsShopOpen(false)}
        onBuy={handleBuy}
        onBuyGem={handleBuyGemRequest}
        userCoins={currentUser.coins}
        userGems={currentUser.gems}
        tutorialStep={currentUser.tutorialStep}
      />

      <SeedBagModal
        isOpen={isSeedBagOpen}
        onClose={() => setIsSeedBagOpen(false)}
        onPlant={handlePlant}
        user={currentUser}
      />

      <PetsModal
        isOpen={isPetsModalOpen}
        onClose={() => setIsPetsModalOpen(false)}
        onEquip={handleEquipPet}
        user={currentUser}
      />

      <QuestsPanel
        isOpen={isQuestsOpen}
        onClose={() => setIsQuestsOpen(false)}
        user={currentUser}
      />

      <ConfirmationModal
        isOpen={!!pendingSku}
        title="Confirm Purchase"
        message="Do you want to buy this item? This is a simulation of the Discord IAP flow."
        onConfirm={confirmBuyGem}
        onCancel={() => setPendingSku(null)}
        confirmText="Purchase"
      />

      {notification && (
        <div
          className={`absolute top-24 left-1/2 -translate-x-1/2 px-6 py-2 rounded-full shadow-xl z-50 text-white font-bold animate-bounce ${
            notification.type === "success" ? "bg-green-500" : "bg-red-500"
          }`}
        >
          {notification.msg}
        </div>
      )}
    </div>
  );
};

export default App;
