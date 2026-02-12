import React, { useState } from "react";
import { ItemConfig, ItemType } from "../../types";
import { ITEMS, SKUS } from "../../constants";
import { X, ShoppingBag, Gem, Package, ArrowDown } from "lucide-react";

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
  const [activeTab, setActiveTab] = useState<"items" | "gems">("items");

  if (!isOpen) return null;

  const itemsList = Object.values(ITEMS);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-800 border-2 border-gray-600 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-fade-in">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-gray-900 rounded-t-xl shrink-0">
          <div className="flex items-center gap-2 text-white">
            <ShoppingBag className="text-green-400" />
            <h2 className="text-xl font-bold">Shop</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700 shrink-0">
          <button
            onClick={() => setActiveTab("items")}
            className={`flex-1 py-3 font-bold text-sm flex items-center justify-center gap-2 ${activeTab === "items" ? "bg-gray-700 text-white border-b-2 border-green-500" : "text-gray-400 hover:bg-gray-750"}`}
          >
            <Package size={16} /> Garden Items
          </button>
          <button
            onClick={() => setActiveTab("gems")}
            className={`flex-1 py-3 font-bold text-sm flex items-center justify-center gap-2 ${activeTab === "gems" ? "bg-gray-700 text-purple-300 border-b-2 border-purple-500" : "text-gray-400 hover:bg-gray-750"}`}
          >
            <Gem size={16} /> Premium Gems
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto min-h-0 flex-1">
          {activeTab === "items" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {itemsList.map((item) => {
                const isGemItem = item.currency === "gems";
                const canAfford = isGemItem
                  ? userGems >= item.price
                  : userCoins >= item.price;
                // Tutorial Step 1: Buy Planter.
                const isTutorialTarget =
                  tutorialStep === 1 && item.id === "planter_basic";

                return (
                  <div
                    key={item.id}
                    className={`bg-gray-700 p-3 rounded-lg border hover:border-gray-400 transition-all flex flex-col gap-2 group relative ${isTutorialTarget ? "border-yellow-400 ring-4 ring-yellow-400/50 z-10 scale-105 shadow-2xl bg-gray-600" : "border-gray-600"}`}
                  >
                    {isTutorialTarget && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-yellow-400 text-black text-[10px] font-bold px-2 py-0.5 rounded shadow-lg animate-bounce z-20 flex items-center gap-1">
                        Buy Me! <ArrowDown size={12} />
                      </div>
                    )}

                    <div className="h-24 bg-gray-900/50 rounded-md flex items-center justify-center relative overflow-hidden">
                      <div
                        className="w-12 h-12 shadow-lg transition-transform group-hover:scale-110"
                        style={{
                          backgroundColor: `#${item.color.toString(16).padStart(6, "0")}`,
                        }}
                      />
                      <div className="absolute bottom-2 right-2 text-xs text-gray-400 uppercase font-bold tracking-wider opacity-50">
                        {item.type}
                      </div>
                    </div>

                    <div>
                      <h3 className="font-bold text-white">{item.name}</h3>
                      <p className="text-xs text-gray-400">
                        {item.description}
                      </p>
                    </div>

                    <div className="mt-auto flex justify-between items-center">
                      <span
                        className={`font-mono font-bold ${isGemItem ? "text-purple-400" : "text-yellow-400"}`}
                      >
                        {item.price} {isGemItem ? "💎" : "G"}
                      </span>
                      <button
                        onClick={() => onBuy(item.id)}
                        disabled={!canAfford}
                        className={`px-3 py-1 rounded text-sm font-bold transition-transform active:scale-95 ${
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

          {activeTab === "gems" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {SKUS.map((sku) => (
                <div
                  key={sku.id}
                  className="bg-gray-900 border border-purple-500/30 p-4 rounded-xl flex items-center justify-between shadow-lg relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-purple-600/10 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />

                  <div className="flex items-center gap-4 z-10">
                    <div className="w-12 h-12 bg-purple-900/50 rounded-full flex items-center justify-center border border-purple-500/50">
                      <Gem size={24} className="text-purple-300" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-lg">
                        {sku.amount} Gems
                      </h3>
                      <p className="text-gray-400 text-sm">{sku.name}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => onBuyGem(sku.id)}
                    className="bg-white text-purple-900 px-4 py-2 rounded-lg font-bold hover:bg-purple-100 active:scale-95 transition-all z-10"
                  >
                    {sku.price}
                  </button>
                </div>
              ))}
              <div className="col-span-full mt-4 p-4 bg-blue-900/20 rounded-lg border border-blue-800 text-center">
                <p className="text-blue-200 text-sm">
                  Use Gems to speed up crops and buy rare items!
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
