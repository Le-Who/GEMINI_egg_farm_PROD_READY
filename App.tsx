import React, { useState, useEffect, useCallback, useRef } from "react";
import { LanguageProvider } from "./components/LanguageContext";
import { GameCanvas } from "./components/GameCanvas";
import { HUD } from "./components/ui/HUD";
import { ShopModal } from "./components/ui/ShopModal";
import { InventoryDrawer } from "./components/ui/InventoryDrawer";
import { SeedBagModal } from "./components/ui/SeedBagModal";
import { NeighborsPanel } from "./components/ui/NeighborsPanel";
import { PetsModal } from "./components/ui/PetsModal";
import { QuestsPanel } from "./components/ui/QuestsPanel";
import { TutorialOverlay } from "./components/ui/TutorialOverlay";
import { ConfirmationModal } from "./components/ui/ConfirmationModal";
import { GuestbookModal } from "./components/ui/GuestbookModal";
import { EchoSummaryBanner } from "./components/ui/EchoSummaryBanner";
import { GameEngine } from "./services/gameEngine";
import { discordService } from "./services/discord"; // REAL Service
import { UserState, ItemType, RoomType, StickerType } from "./types";
import {
  ITEMS,
  CROPS,
  loadContent,
  refreshArrayRefs,
  startContentPolling,
  SYNC_INTERVAL_MS,
  NOTIFICATION_DURATION,
} from "./constants";
import { Loader2, ArrowLeft } from "lucide-react";
import { gameBus } from "./services/eventBus";

const GameContent: React.FC = () => {
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

  // Billboard
  const [isStickerPickerOpen, setIsStickerPickerOpen] = useState(false);

  // Notification System
  const [notification, setNotification] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);
  const notificationTimeoutRef = useRef<any>(null);
  const lastActionRef = useRef<number>(0);

  // Echo Ghost banner
  const [showEchoBanner, setShowEchoBanner] = useState(false);

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

        // Check for new echo marks on load
        const newEchoes = (u.echoMarks || []).filter((m) => m.status === "new");
        if (newEchoes.length > 0) {
          setShowEchoBanner(true);
        }

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
    }, SYNC_INTERVAL_MS);
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
        } else if (isNeighborsOpen) {
          setIsNeighborsOpen(false);
        } else if (isSeedBagOpen) {
          setIsSeedBagOpen(false);
        } else if (isStickerPickerOpen) {
          setIsStickerPickerOpen(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedItemId,
    isEditMode,
    isShopOpen,
    isPetsModalOpen,
    isQuestsOpen,
    isNeighborsOpen,
    isSeedBagOpen,
    isStickerPickerOpen,
  ]);

  const showNotification = useCallback(
    (msg: string, type: "success" | "error") => {
      if (notificationTimeoutRef.current) {
        clearTimeout(notificationTimeoutRef.current);
      }
      setNotification({ msg, type });
      notificationTimeoutRef.current = setTimeout(() => {
        setNotification(null);
        notificationTimeoutRef.current = null;
      }, NOTIFICATION_DURATION);
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

  const handleOpenShop = useCallback(async () => {
    setIsShopOpen(true);
    if (currentUser && !currentUser.completedTutorial) {
      const updatedUser = await GameEngine.triggerTutorial("OPEN_SHOP");
      setCurrentUser(updatedUser);
    }
  }, [currentUser]);

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

  const handleReturnHome = async () => {
    // Refresh state to pick up any echoes that happened while we were away
    const freshUser = await GameEngine.getUser();
    setCurrentUser(freshUser);
    setDisplayUser(freshUser);
    setPlayerGridPos({ x: 7, y: 7 });
    showNotification("Returned Home", "success");

    // Check for new echo marks
    const newEchoes = (freshUser.echoMarks || []).filter(
      (m) => m.status === "new",
    );
    if (newEchoes.length > 0) {
      setShowEchoBanner(true);
    }
  };

  const handleDismissEchoBanner = async () => {
    setShowEchoBanner(false);
    await GameEngine.acknowledgeEchoMarks();
    // Refresh state to update echoMarks status
    const u = await GameEngine.getUser();
    setCurrentUser(u);
    if (!isVisiting) setDisplayUser(u);
  };

  const handleEquipPet = async (petId: string) => {
    const result = await GameEngine.equipPet(petId);
    if (result.success && result.newState) {
      setCurrentUser(result.newState);
      if (!isVisiting) setDisplayUser(result.newState);
      showNotification("Pet equipped!", "success");
    }
  };

  const handleSwitchRoom = useCallback(
    async (type: RoomType) => {
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
    },
    [isVisiting, displayUser, showNotification],
  );

  // Pet interaction — owner and visitors can pet
  const handlePetPet = useCallback(
    (petId: string) => {
      if (!currentUser) return;
      showNotification("You petted the pet! 💕", "success");
    },
    [currentUser],
  );

  const handleTileClick = useCallback(
    async (x: number, y: number) => {
      if (!currentUser || !displayUser) return;

      // Move Player
      setPlayerGridPos({ x, y });

      const currentRoomItems = displayUser.rooms[displayUser.currentRoom].items;

      // --- VISITOR MODE ---
      if (isVisiting) {
        // Allow billboard interaction for visitors
        const item = currentRoomItems.find(
          (i) => i.gridX === x && i.gridY === y,
        );
        if (item && item.itemId === "billboard_wood") {
          setIsStickerPickerOpen(true);
          return;
        }

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

      // 1. DYE USAGE — select dye in EditorBar → click furniture to tint
      if (isEditMode && selectedItemId) {
        const itemConfig = ITEMS[selectedItemId];
        if (itemConfig && itemConfig.type === ItemType.DYE) {
          const placedItem = currentRoomItems.find(
            (i) => i.gridX === x && i.gridY === y,
          );
          if (placedItem) {
            const result = await GameEngine.applyDye(
              placedItem.id,
              selectedItemId,
            );
            if (result.success && result.newState) {
              setCurrentUser(result.newState);
              setDisplayUser(result.newState);
              const colorHex = itemConfig.dyeColor || "#ffffff";
              triggerFloatingText(x, y, "DYED! 🎨", colorHex);
              showNotification(result.message || "Dye applied!", "success");
            } else {
              showNotification(
                result.message || "Can't dye this item",
                "error",
              );
            }
          } else {
            showNotification("Click on furniture to apply dye", "error");
          }
          return;
        }
      }

      // 2. CONSUMABLE USAGE
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
          // FIX: Check if we ran out of stock
          if ((result.newState.inventory[selectedItemId] || 0) <= 0) {
            setSelectedItemId(null);
          }
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

        // Visitor Billboard Fix
        if (item && item.itemId === "billboard_wood") {
          setIsStickerPickerOpen(true);
          return;
        }

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

        // BILLBOARD — open guestbook when visiting
        if (item.itemId === "billboard_wood") {
          setIsStickerPickerOpen(true);
          return;
        }

        // GENERIC INTERACT
        // Play Mode: interacting with furniture/decor should NOT pick it up
        // We only allow "harvesting" or "hatching" here.
        // If it's just a decoration, do nothing (maybe show "Entering Edit Mode" hint?)

        if (
          config.type === ItemType.FURNITURE ||
          config.type === ItemType.DECORATION
        ) {
          // Passive objects - do nothing in Play Mode
          return;
        }

        const result = await GameEngine.harvestOrPickup(x, y);
        if (result.success && result.newState) {
          setCurrentUser(result.newState);
          setDisplayUser(result.newState);

          if (result.action === "harvest") {
            if (result.reward) {
              triggerFloatingText(x, y, `+${result.reward}G`, "#ffff00");
              showNotification(`+${result.reward} Gold | +XP`, "success");
            } else showNotification(result.message || "Harvested", "success");
          } else if (result.action === "hatch") {
            triggerFloatingText(x, y, "HATCHED!", "#ff00ff");
            showNotification(result.message || "Hatched!", "success");
          } else if (result.action === "pickup") {
            // This case should theoretically be unreachable now for Furniture/Decor if logic above holds,
            // but 'harvestOrPickup' still handles generic pickup.
            // We'll allow it for now if GameEngine allowed it (e.g. maybe a loose item dropped?)
            showNotification("Item put in inventory", "success");
          }
        } else {
          // Silent fail or low priority message
        }
      }

      // 4. EDITOR PICKUP (Click to Pick Up)
      if (isEditMode && !selectedItemId) {
        const item = currentRoomItems.find(
          (i) => i.gridX === x && i.gridY === y,
        );
        if (item) {
          const result = await GameEngine.harvestOrPickup(x, y); // Pickup
          if (result.success && result.newState) {
            setCurrentUser(result.newState);
            setDisplayUser(result.newState);
            // Auto-select the item we just picked up to move it?
            // result.action is 'pickup'
            // We can select it immediately for placement:
            setSelectedItemId(item.itemId);
            setRotation(item.rotation);
            showNotification("Moving item...", "success");
          }
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

  const toggleEditMode = useCallback(() => {
    if (isVisiting) {
      showNotification("Cannot edit neighbor's farm!", "error");
      return;
    }
    setIsEditMode((prev) => !prev);
    setSelectedItemId(null);
    setRotation(0);
    setIsSeedBagOpen(false);
  }, [isVisiting, showNotification]);

  // Stable handlers for UI components to prevent re-renders
  const handleOpenPets = useCallback(() => setIsPetsModalOpen(true), []);
  const handleOpenQuests = useCallback(() => setIsQuestsOpen(true), []);
  const handleToggleNeighbors = useCallback(
    () => setIsNeighborsOpen((prev) => !prev),
    [],
  );
  const handleRotate = useCallback(() => setRotation((r) => (r + 1) % 4), []);

  if (!currentUser || !displayUser) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#2f3136] text-white flex-col gap-4">
        <Loader2 className="animate-spin w-12 h-12 text-indigo-500" />
        <p className="font-mono animate-pulse">Connecting to Discord...</p>
      </div>
    );
  }

  // Determine current pet to display
  // Show Host's pet (displayUser) logic:
  // If visiting, show displayUser.equippedPetId
  // If home, show currentUser.equippedPetId (which IS displayUser)
  const petOwner = displayUser;
  const displayPetId = petOwner.equippedPetId;
  const displayPet = displayPetId
    ? petOwner.pets.find((p) => p.id === displayPetId)
    : null;

  const currentRoomItems = displayUser.rooms[displayUser.currentRoom].items;

  return (
    <div className="relative w-full h-full overflow-hidden font-sans select-none">
      <GameCanvas
        items={currentRoomItems}
        roomType={displayUser.currentRoom}
        onTileClick={handleTileClick}
        onPetClick={handlePetPet}
        ghostItem={
          isEditMode && selectedItemId ? { id: selectedItemId, rotation } : null
        }
        currentPet={displayPet || null}
        isVisiting={isVisiting}
        wateredPlants={wateredPlants}
        playerGridPos={playerGridPos}
        tutorialStep={currentUser.tutorialStep}
        echoMarks={!isVisiting ? currentUser.echoMarks || [] : []}
      />

      {/* Echo Ghost Summary Banner */}
      {showEchoBanner && currentUser && (
        <EchoSummaryBanner
          echoMarks={currentUser.echoMarks || []}
          onDismiss={handleDismissEchoBanner}
        />
      )}

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
        avatarUrl={discordService.user?.avatar}
        onOpenShop={handleOpenShop}
        onOpenPets={handleOpenPets}
        onOpenQuests={handleOpenQuests}
        onToggleEdit={toggleEditMode}
        onToggleNeighbors={handleToggleNeighbors}
        onSwitchRoom={handleSwitchRoom}
        isEditMode={isEditMode}
        isNeighborsOpen={isNeighborsOpen}
      />

      <TutorialOverlay user={currentUser} onUpdateUser={setCurrentUser} />

      <NeighborsPanel
        isOpen={isNeighborsOpen}
        onToggle={handleToggleNeighbors}
        onVisit={handleVisit}
      />

      {!isVisiting && (
        <InventoryDrawer
          user={currentUser}
          selectedItemId={selectedItemId}
          rotation={rotation}
          onSelect={setSelectedItemId}
          onRotate={handleRotate}
          onClose={toggleEditMode}
          isEditMode={isEditMode}
          onToggleEditMode={toggleEditMode}
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

      <GuestbookModal
        isOpen={isStickerPickerOpen}
        onClose={() => setIsStickerPickerOpen(false)}
        onSend={async (sticker: StickerType, message?: string) => {
          if (!displayUser) return;
          try {
            const token = discordService.accessToken;
            const res = await fetch(`/api/billboard/${displayUser.id}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ sticker, message }),
            });
            const data = await res.json();
            if (data.success) {
              showNotification("Sticker sent! 🎉", "success");
              setIsStickerPickerOpen(false);
            } else {
              showNotification(data.error || "Failed to send sticker", "error");
            }
          } catch {
            showNotification("Network error", "error");
          }
        }}
        billboard={displayUser?.billboard}
        ownerName={displayUser?.username || ""}
      />

      {notification && (
        <div className="fixed top-24 inset-x-0 flex justify-center z-50 pointer-events-none">
          <div
            className={`px-6 py-2 rounded-full shadow-xl text-white font-bold animate-bounce ${
              notification.type === "success" ? "bg-green-500" : "bg-red-500"
            }`}
          >
            {notification.msg}
          </div>
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <GameContent />
    </LanguageProvider>
  );
};

export default App;
