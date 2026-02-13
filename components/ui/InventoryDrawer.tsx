import React, { useState, useMemo } from "react";
import { ITEMS } from "../../constants";
import { UserState, ItemType } from "../../types";
import {
  RotateCw,
  X,
  ChevronUp,
  ChevronDown,
  Hammer,
  Search,
  Filter,
} from "lucide-react";

interface InventoryDrawerProps {
  user: UserState;
  selectedItemId: string | null;
  rotation: number;
  onSelect: (itemId: string | null) => void;
  onRotate: () => void;
  onClose: () => void;
  isEditMode: boolean;
  onToggleEditMode: () => void;
}

const TABS = [
  { id: "all", label: "All", icon: null },
  { id: "furniture", label: "Furniture", type: ItemType.FURNITURE },
  {
    id: "nature",
    label: "Nature",
    types: [ItemType.PLANTER, ItemType.PLANT, ItemType.EGG, ItemType.INCUBATOR],
  },
  { id: "decor", label: "Decor", types: [ItemType.DECORATION, ItemType.DYE] },
  { id: "consumable", label: "Consumables", type: ItemType.CONSUMABLE },
];

export const InventoryDrawer: React.FC<InventoryDrawerProps> = ({
  user,
  selectedItemId,
  rotation,
  onSelect,
  onRotate,
  onClose,
  isEditMode,
  onToggleEditMode,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredItems = useMemo(() => {
    return (Object.entries(user.inventory) as [string, number][])
      .filter(([id, count]) => {
        const item = ITEMS[id];
        if (!item || count <= 0) return false;

        // Search Filter
        if (
          searchQuery &&
          !item.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
          return false;

        // Tab Filter
        if (activeTab === "all") return true;
        const tab = TABS.find((t) => t.id === activeTab);
        if (!tab) return true;

        if (tab.type && item.type === tab.type) return true;
        if (tab.types && tab.types.includes(item.type)) return true;

        return false;
      })
      .map(([id, count]) => ({ ...ITEMS[id], count }));
  }, [user.inventory, activeTab, searchQuery]);

  return (
    <>
      {/* Handle */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 transition-all duration-500 ease-in-out z-30 ${
          isExpanded ? "bottom-[340px]" : "bottom-6"
        }`}
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`
            relative px-8 py-3 rounded-full font-bold shadow-[0_0_20px_rgba(0,0,0,0.3)]
            backdrop-blur-xl border border-white/10 transition-all hover:scale-105 active:scale-95
            flex items-center gap-3 group overflow-hidden
            ${
              isExpanded
                ? "bg-gray-900/80 text-white"
                : "bg-white/90 text-gray-900 data-[visited=true]:bg-green-500"
            }
          `}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
          {isExpanded ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
          <span className="uppercase tracking-widest text-xs font-black">
            Inventory
          </span>
          <span className="bg-gray-800 text-white text-[10px] px-2 py-0.5 rounded-full font-mono">
            {Object.keys(user.inventory).length}
          </span>
        </button>
      </div>

      {/* Main Drawer Panel */}
      <div
        className={`fixed bottom-0 left-0 w-full z-20 transition-all duration-500 ease-out shadow-2xl backdrop-blur-2xl
          ${isExpanded ? "h-[320px] translate-y-0" : "h-[320px] translate-y-full opacity-0"}
        `}
      >
        {/* Glass Background Layer */}
        <div className="absolute inset-0 bg-gray-900/85 border-t border-white/10" />

        {/* Decorative Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-1 bg-gradient-to-r from-transparent via-green-500/50 to-transparent blur-sm" />

        <div className="relative h-full flex flex-col p-6 max-w-5xl mx-auto">
          {/* Header Controls */}
          <div className="flex justify-between items-center mb-6 shrink-0">
            {/* Edit Mode Toggle */}
            <button
              onClick={onToggleEditMode}
              className={`flex items-center gap-3 px-5 py-2.5 rounded-xl font-bold transition-all border ${
                isEditMode
                  ? "bg-green-500/20 border-green-500/50 text-green-300 shadow-[0_0_15px_rgba(34,197,94,0.2)]"
                  : "bg-gray-800/50 border-white/5 text-gray-400 hover:bg-gray-700/50 hover:text-white"
              }`}
            >
              <Hammer size={18} className={isEditMode ? "animate-pulse" : ""} />
              {isEditMode ? "Build Mode Active" : "Build Mode"}
            </button>

            {/* Tabs */}
            <div className="flex bg-gray-800/50 p-1 rounded-xl border border-white/5">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === tab.id
                      ? "bg-gray-600 text-white shadow-sm"
                      : "text-gray-400 hover:text-white hover:bg-gray-700/50"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Selected Item Actions */}
            <div className="flex gap-3">
              {selectedItemId && (
                <div className="flex items-center gap-3 animate-slide-in">
                  <div className="h-8 w-[1px] bg-white/10" />
                  <button
                    onClick={onRotate}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600/80 hover:bg-blue-500 text-white rounded-xl font-bold text-xs backdrop-blur-sm transition-all active:scale-95"
                  >
                    <RotateCw size={16} /> Rotate
                  </button>
                  <button
                    onClick={() => onSelect(null)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-200 border border-red-500/30 rounded-xl font-bold text-xs backdrop-blur-sm transition-all"
                  >
                    <X size={16} /> Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Grid Container */}
          <div className="flex-1 min-h-0 bg-gray-900/30 rounded-2xl border border-white/5 p-4 overflow-hidden relative">
            {/* Search Input */}
            <div className="absolute top-4 right-4 z-10 w-48">
              <div className="relative group">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-white transition-colors"
                />
                <input
                  type="text"
                  placeholder="Filter items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 rounded-full pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-white/20 focus:bg-black/60 transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3 overflow-y-auto h-full pr-1 pb-1 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
              {filteredItems.length === 0 ? (
                <div className="col-span-full h-full flex flex-col items-center justify-center text-gray-500 gap-2">
                  <Search size={32} className="opacity-20" />
                  <p className="text-sm">No items found.</p>
                </div>
              ) : (
                filteredItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (!isEditMode) onToggleEditMode();
                      onSelect(item.id);
                    }}
                    className={`
                      relative aspect-square rounded-xl flex flex-col items-center justify-center gap-2 group transition-all duration-200
                      ${
                        selectedItemId === item.id
                          ? "bg-white/10 border-2 border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.2)] scale-105"
                          : "bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 hover:scale-105"
                      }
                    `}
                  >
                    {/* Item Preview */}
                    <div className="relative z-10 p-2 transition-transform group-hover:-translate-y-1">
                      {item.sprite ? (
                        <img
                          src={item.sprite}
                          alt={item.name}
                          className="w-10 h-10 object-contain drop-shadow-lg"
                          style={{ imageRendering: "pixelated" }}
                        />
                      ) : (
                        <div
                          className="w-8 h-8 rounded-lg shadow-lg shadow-black/30"
                          style={{
                            backgroundColor: `#${item.color.toString(16).padStart(6, "0")}`,
                          }}
                        />
                      )}
                    </div>

                    {/* Badge */}
                    <div className="absolute top-2 right-2 bg-black/60 text-white text-[9px] font-mono px-1.5 py-0.5 rounded shadow backdrop-blur-sm border border-white/10">
                      x{item.count}
                    </div>

                    {/* Name Label */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2 pt-4 rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-[10px] text-center text-gray-200 font-medium truncate leading-none">
                        {item.name}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
