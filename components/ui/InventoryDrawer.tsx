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
import { useLanguage } from "../../components/LanguageContext";

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

export const InventoryDrawer: React.FC<InventoryDrawerProps> = React.memo(({
  user,
  selectedItemId,
  rotation,
  onSelect,
  onRotate,
  onClose,
  isEditMode,
  onToggleEditMode,
}) => {
  const { t, tContent } = useLanguage();
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

  // Updated Theme: Emerald/Fuchsia
  return (
    <>
      {/* Handle - Floating Center Button at Bottom */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 transition-all duration-300 ease-out z-30 ${
          isExpanded
            ? "bottom-[240px] opacity-0 pointer-events-none"
            : "bottom-6"
        }`}
      >
        <button
          id="btn-inventory-toggle"
          onClick={() => setIsExpanded(!isExpanded)}
          className={`
            relative px-8 py-3 rounded-2xl font-bold shadow-[0_0_20px_rgba(16,185,129,0.3)]
            backdrop-blur-xl border border-white/20 transition-all hover:scale-105 active:scale-95
            flex items-center gap-3 group overflow-hidden bg-emerald-950/80 text-white ring-1 ring-emerald-500/30
          `}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
          <ChevronUp size={20} className="text-emerald-400" />
          <span className="uppercase tracking-widest text-xs font-black text-emerald-100">
            {t("inventory.title")}
          </span>
          <span className="bg-emerald-800 text-white text-[10px] px-2 py-0.5 rounded-full font-mono border border-emerald-600">
            {Object.keys(user.inventory).length}
          </span>
        </button>
      </div>

      {/* Main Drawer Panel - Compact Floating Dock */}
      <div
        className={`fixed left-1/2 -translate-x-1/2 z-20 transition-all duration-300 ease-out shadow-2xl backdrop-blur-2xl rounded-3xl overflow-hidden border border-emerald-500/30
          ${
            isExpanded
              ? "bottom-6 w-[95%] max-w-2xl h-[280px] opacity-100 translate-y-0"
              : "bottom-0 w-[90%] max-w-xl h-[0px] opacity-0 translate-y-10 pointer-events-none"
          }
        `}
      >
        {/* Glass Background Layer */}
        <div className="absolute inset-0 bg-emerald-950/90" />

        {/* Decorative Glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-32 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none" />

        <div className="relative h-full flex flex-col p-4">
          {/* Header Controls */}
          <div className="flex justify-between items-center mb-4 shrink-0">
            {/* Close Button (Left) */}
            <button
              onClick={() => setIsExpanded(false)}
              aria-label="Close inventory"
              className="p-2 bg-emerald-900/50 hover:bg-emerald-800 rounded-xl text-emerald-200 transition-colors border border-emerald-700/30"
            >
              <ChevronDown size={18} />
            </button>

            {/* Tabs (Center - Scrollable) */}
            <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 overflow-x-auto scrollbar-hide flex-1 mx-3 justify-center">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-bold transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/50"
                      : "text-emerald-400/70 hover:text-emerald-200 hover:bg-white/5"
                  }`}
                >
                  {t(`inventory.${tab.id}` as any)}
                </button>
              ))}
            </div>

            {/* Selected Item Actions (Right) */}
            <div className="flex gap-2">
              {/* Build Mode Toggle */}
              <button
                onClick={onToggleEditMode}
                className={`p-2 rounded-xl transition-all border ${
                  isEditMode
                    ? "bg-fuchsia-500/20 border-fuchsia-500/50 text-fuchsia-300 shadow-[0_0_10px_rgba(217,70,239,0.3)] animate-pulse-slow"
                    : "bg-emerald-900/50 border-white/5 text-emerald-400 hover:bg-emerald-800 hover:text-white"
                }`}
                title="Build Mode"
                aria-label="Toggle build mode"
              >
                <Hammer size={18} />
              </button>

              {selectedItemId && (
                <div className="flex items-center gap-2 animate-slide-in">
                  <button
                    onClick={onRotate}
                    className="p-2 bg-blue-600/80 hover:bg-blue-500 text-white rounded-xl shadow-lg active:scale-95 transition-transform"
                    title="Rotate"
                    aria-label="Rotate item"
                  >
                    <RotateCw size={18} />
                  </button>
                  <button
                    onClick={() => onSelect(null)}
                    className="p-2 bg-red-500/80 hover:bg-red-500 text-white rounded-xl shadow-lg active:scale-95 transition-transform"
                    title="Deselect"
                    aria-label="Deselect item"
                  >
                    <X size={18} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Grid Container */}
          <div className="flex-1 min-h-0 bg-black/20 rounded-2xl border border-white/5 p-3 overflow-hidden relative">
            {/* Search Input Floating */}
            <div className="absolute top-3 right-3 z-10 w-32 sm:w-40 transition-all focus-within:w-48">
              <div className="relative group">
                <Search
                  size={12}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-500/70"
                />
                <input
                  type="text"
                  placeholder={t("inventory.search")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-emerald-950/80 border border-emerald-500/20 rounded-full pl-8 pr-3 py-1 text-[10px] text-emerald-100 placeholder-emerald-700/50 focus:outline-none focus:border-emerald-400/50 focus:bg-black/40 transition-all shadow-lg backdrop-blur-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-5 sm:grid-cols-7 md:grid-cols-8 lg:grid-cols-10 gap-2 overflow-y-auto h-full pr-1 pb-1 scrollbar-thin scrollbar-thumb-emerald-700/50 scrollbar-track-transparent">
              {filteredItems.length === 0 ? (
                <div className="col-span-full h-full flex flex-col items-center justify-center text-emerald-500/50 gap-2">
                  <Search size={24} className="opacity-30" />
                  <p className="text-xs">{t("inventory.nothingHere")}</p>
                </div>
              ) : (
                filteredItems.map((item) => (
                  <button
                    key={item.id}
                    data-testid={`inventory-item-${item.id}`}
                    onClick={() => {
                      if (!isEditMode) onToggleEditMode();
                      onSelect(item.id);
                    }}
                    className={`
                      relative aspect-square rounded-xl flex flex-col items-center justify-center gap-1 group transition-all duration-200
                      ${
                        selectedItemId === item.id
                          ? "bg-fuchsia-500/20 border-2 border-fuchsia-400 shadow-[0_0_15px_rgba(232,121,249,0.3)] scale-105 z-10"
                          : "bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 hover:scale-105"
                      }
                    `}
                  >
                    {/* Item Preview */}
                    <div className="relative z-10 p-1.5 transition-transform group-hover:-translate-y-1">
                      {item.sprite ? (
                        <img
                          src={item.sprite}
                          alt={item.name}
                          className="w-8 h-8 object-contain drop-shadow-lg"
                          style={{ imageRendering: "pixelated" }}
                        />
                      ) : (
                        <div
                          className="w-6 h-6 rounded-md shadow-lg shadow-black/30"
                          style={{
                            backgroundColor: `#${item.color.toString(16).padStart(6, "0")}`,
                          }}
                        />
                      )}
                    </div>

                    {/* Badge */}
                    <div className="absolute top-1 right-1 bg-black/60 text-white text-[8px] font-mono px-1 rounded shadow backdrop-blur-sm border border-white/10">
                      x{item.count}
                    </div>

                    {/* Name Label */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-emerald-950 to-transparent p-1 pt-3 rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <p className="text-[8px] text-center text-emerald-100 font-medium truncate leading-none pb-0.5">
                        {tContent(item, "name")}
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
});
