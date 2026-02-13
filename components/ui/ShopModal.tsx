import React, { useState } from "react";
import { ItemConfig, ItemType } from "../../types";
import { ITEMS, SKUS } from "../../constants";
import {
  X,
  ShoppingBag,
  Gem,
  Package,
  ChevronRight,
  Palette,
} from "lucide-react";

interface ShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBuy: (itemId: string) => void;
  onBuyGem: (skuId: string) => void;
  userCoins: number;
  userGems: number;
  tutorialStep: number;
}

export const ShopModal: React.FC<ShopModalProps> = ({
  isOpen,
  onClose,
  onBuy,
  onBuyGem,
  userCoins,
  userGems,
  tutorialStep,
}) => {
  const [activeTab, setActiveTab] = useState<"items" | "dyes" | "gems">(
    "items",
  );
  const itemsList = Object.values(ITEMS).filter((i) => i.type !== ItemType.DYE);
  const dyesList = Object.values(ITEMS).filter((i) => i.type === ItemType.DYE);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`absolute inset-0 z-40 bg-black/40 transition-opacity duration-300 ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />

      {/* Slide Panel */}
      <div
        className={`absolute top-0 right-0 h-full z-50 w-[85%] max-w-[420px] transition-transform duration-300 ease-out ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="h-full bg-gray-800/95 backdrop-blur-md border-l-2 border-gray-600 flex flex-col shadow-2xl">
          {/* Header */}
          <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-gray-900/80 shrink-0">
            <div className="flex items-center gap-2 text-white">
              <ShoppingBag className="text-green-400" size={22} />
              <h2 className="text-lg font-bold">Shop</h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-yellow-400 font-mono text-sm font-bold">
                {userCoins} G
              </span>
              <span className="text-purple-400 font-mono text-sm font-bold">
                {userGems} 💎
              </span>
              <button
                id="btn-shop-close"
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-700 shrink-0">
            <button
              onClick={() => setActiveTab("items")}
              className={`flex-1 py-2.5 font-bold text-sm flex items-center justify-center gap-1.5 transition-colors ${activeTab === "items" ? "bg-gray-700 text-white border-b-2 border-green-500" : "text-gray-400 hover:text-gray-200"}`}
            >
              <Package size={14} /> Items
            </button>
            <button
              onClick={() => setActiveTab("dyes")}
              className={`flex-1 py-2.5 font-bold text-sm flex items-center justify-center gap-1.5 transition-colors ${activeTab === "dyes" ? "bg-gray-700 text-pink-300 border-b-2 border-pink-500" : "text-gray-400 hover:text-gray-200"}`}
            >
              <Palette size={14} /> Dyes
            </button>
            <button
              onClick={() => setActiveTab("gems")}
              className={`flex-1 py-2.5 font-bold text-sm flex items-center justify-center gap-1.5 transition-colors ${activeTab === "gems" ? "bg-gray-700 text-purple-300 border-b-2 border-purple-500" : "text-gray-400 hover:text-gray-200"}`}
            >
              <Gem size={14} /> Gems
            </button>
          </div>

          {/* Content — scrollable */}
          <div className="flex-1 overflow-y-auto p-3 min-h-0">
            {activeTab === "items" && (
              <div className="grid grid-cols-2 gap-3">
                {itemsList.map((item) => {
                  const isGemItem = item.currency === "gems";
                  const canAfford = isGemItem
                    ? userGems >= item.price
                    : userCoins >= item.price;
                  const isTutorialTarget =
                    tutorialStep === 1 && item.id === "planter_basic";

                  return (
                    <div
                      key={item.id}
                      id={`shop-item-${item.id}`}
                      className={`bg-gray-700/80 p-2.5 rounded-lg border transition-all flex flex-col gap-1.5 group relative ${isTutorialTarget ? "border-yellow-400 ring-2 ring-yellow-400/50 scale-[1.02] shadow-xl bg-gray-600" : "border-gray-600 hover:border-gray-500"}`}
                    >
                      {isTutorialTarget && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow-400 text-black text-[10px] font-bold px-2 py-0.5 rounded shadow-lg animate-bounce z-20">
                          Buy Me! ↓
                        </div>
                      )}

                      <div className="h-16 bg-gray-900/40 rounded flex items-center justify-center relative overflow-hidden">
                        {item.sprite ? (
                          <img
                            src={item.sprite}
                            alt={item.name}
                            className="w-10 h-10 object-contain drop-shadow-md transition-transform group-hover:scale-110"
                            style={{ imageRendering: "pixelated" }}
                          />
                        ) : (
                          <div
                            className="w-10 h-10 rounded shadow-lg transition-transform group-hover:scale-110"
                            style={{
                              backgroundColor: `#${item.color.toString(16).padStart(6, "0")}`,
                            }}
                          />
                        )}
                        <div className="absolute bottom-1 right-1 text-[9px] text-gray-500 uppercase font-bold tracking-wider">
                          {item.type}
                        </div>
                      </div>

                      <div>
                        <h3 className="font-bold text-white text-sm leading-tight">
                          {item.name}
                        </h3>
                        <p className="text-[10px] text-gray-400 leading-snug line-clamp-2">
                          {item.description}
                        </p>
                      </div>

                      <div className="mt-auto flex justify-between items-center pt-1">
                        <span
                          className={`font-mono font-bold text-sm ${isGemItem ? "text-purple-400" : "text-yellow-400"}`}
                        >
                          {item.price} {isGemItem ? "💎" : "G"}
                        </span>
                        <button
                          onClick={() => onBuy(item.id)}
                          disabled={!canAfford}
                          className={`px-2.5 py-1 rounded text-xs font-bold transition-all active:scale-95 ${
                            canAfford
                              ? "bg-green-600 hover:bg-green-500 text-white"
                              : "bg-gray-600 text-gray-400 cursor-not-allowed"
                          }`}
                        >
                          Buy
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === "dyes" && (
              <div className="grid grid-cols-3 gap-3">
                {dyesList.map((dye) => {
                  const canAfford = userCoins >= dye.price;
                  const dyeHex = `#${dye.color.toString(16).padStart(6, "0")}`;
                  return (
                    <div
                      key={dye.id}
                      className="bg-gray-700/80 p-2.5 rounded-lg border border-gray-600 hover:border-gray-500 flex flex-col items-center gap-2 transition-all"
                    >
                      <div
                        className="w-12 h-12 rounded-full shadow-lg border-2 border-white/20 transition-transform hover:scale-110"
                        style={{ backgroundColor: dyeHex }}
                      />
                      <span className="text-xs text-white font-bold text-center leading-tight">
                        {dye.name}
                      </span>
                      <span className="text-[10px] text-gray-400 text-center leading-tight">
                        {dye.description}
                      </span>
                      <button
                        onClick={() => onBuy(dye.id)}
                        disabled={!canAfford}
                        className={`w-full px-2 py-1 rounded text-xs font-bold transition-all active:scale-95 ${
                          canAfford
                            ? "bg-pink-600 hover:bg-pink-500 text-white"
                            : "bg-gray-600 text-gray-400 cursor-not-allowed"
                        }`}
                      >
                        {dye.price} G
                      </button>
                    </div>
                  );
                })}
                <div className="col-span-3 mt-1 p-2.5 bg-pink-900/20 rounded-lg border border-pink-800 text-center">
                  <p className="text-pink-200 text-xs">
                    Buy dyes, then use Edit Mode to paint furniture! 🎨
                  </p>
                </div>
              </div>
            )}

            {activeTab === "gems" && (
              <div className="flex flex-col gap-3">
                {SKUS.map((sku) => (
                  <div
                    key={sku.id}
                    className="bg-gray-900/80 border border-purple-500/30 p-3.5 rounded-xl flex items-center justify-between shadow-lg relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-20 h-20 bg-purple-600/10 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none" />
                    <div className="flex items-center gap-3 z-10">
                      <div className="w-10 h-10 bg-purple-900/50 rounded-full flex items-center justify-center border border-purple-500/50">
                        <Gem size={20} className="text-purple-300" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white">
                          {sku.amount} Gems
                        </h3>
                        <p className="text-gray-400 text-xs">{sku.name}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => onBuyGem(sku.id)}
                      className="bg-white text-purple-900 px-3 py-1.5 rounded-lg font-bold text-sm hover:bg-purple-100 active:scale-95 transition-all z-10"
                    >
                      {sku.price}
                    </button>
                  </div>
                ))}
                <div className="mt-2 p-3 bg-blue-900/20 rounded-lg border border-blue-800 text-center">
                  <p className="text-blue-200 text-xs">
                    Use Gems to speed up crops and buy rare items!
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
