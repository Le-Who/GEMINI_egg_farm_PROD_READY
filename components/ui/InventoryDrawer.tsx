import React, { useState } from "react";
import { ITEMS } from "../../constants";
import { UserState } from "../../types";
import { RotateCw, X, ChevronUp, ChevronDown, Hammer } from "lucide-react";

interface InventoryDrawerProps {
  user: UserState;
  selectedItemId: string | null;
  rotation: number;
  onSelect: (itemId: string | null) => void;
  onRotate: () => void;
  onClose: () => void; // Actually just "collapse" or "exit edit mode"
  isEditMode: boolean;
  onToggleEditMode: () => void;
}

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

  const inventoryItems = (Object.entries(user.inventory) as [string, number][])
    .filter(([id, count]) => count > 0 && ITEMS[id])
    .map(([id, count]) => ({ ...ITEMS[id], count }));

  // Filter tabs if we have many items, for now just show all

  return (
    <>
      {/* Handle / Tab */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 transition-all duration-300 z-30 ${
          isExpanded ? "bottom-[240px]" : "bottom-6"
        }`}
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          id="btn-inventory-drawer"
          className="bg-[#2f3136] text-white px-6 py-2 rounded-t-xl font-bold shadow-lg border-t border-x border-gray-600 flex items-center gap-2 hover:bg-[#3f4148] transition-colors"
        >
          {isExpanded ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
          <span className="uppercase tracking-wide text-sm">
            Inventory{" "}
            {inventoryItems.length > 0 && `(${inventoryItems.length})`}
          </span>
        </button>
      </div>

      {/* Drawer Panel */}
      <div
        className={`fixed bottom-0 left-0 w-full bg-[#2f3136]/95 border-t border-gray-600 z-20 transition-all duration-300 ease-in-out shadow-2xl ${
          isExpanded ? "h-[240px]" : "h-0"
        } overflow-hidden`}
      >
        <div className="p-4 h-full flex flex-col gap-4">
          {/* Controls Header */}
          <div className="flex justify-between items-center pb-2 border-b border-gray-700">
            <div className="flex items-center gap-4">
              <button
                id="btn-edit-mode"
                onClick={onToggleEditMode}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${
                  isEditMode
                    ? "bg-green-600 text-white shadow-green-500/20 shadow-md"
                    : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                }`}
              >
                <Hammer size={16} />
                {isEditMode ? "Editing ON" : "Editing OFF"}
              </button>
            </div>

            <div className="flex gap-2">
              {selectedItemId && (
                <button
                  onClick={onRotate}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 rounded-lg text-white text-sm font-bold hover:bg-blue-500 active:scale-95"
                >
                  <RotateCw size={16} /> Rotate
                </button>
              )}
              {isEditMode && selectedItemId && (
                <button
                  onClick={() => onSelect(null)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-600 rounded-lg text-white text-sm font-bold hover:bg-gray-500"
                >
                  <X size={16} /> Cancel
                </button>
              )}
            </div>
          </div>

          {/* Items Grid */}
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3 overflow-y-auto pr-2 pb-4 scrollbar-thin scrollbar-thumb-gray-600">
            {inventoryItems.map((item) => (
              <button
                key={item.id}
                id={`item-${item.id}`}
                onClick={() => {
                  if (!isEditMode) onToggleEditMode(); // Auto-enable edit mode
                  onSelect(item.id);
                }}
                className={`aspect-square rounded-xl border-2 flex flex-col items-center justify-center relative transition-all group ${
                  selectedItemId === item.id
                    ? "bg-[#40444b] border-yellow-400 scale-105 shadow-lg shadow-yellow-400/10"
                    : "bg-[#36393f] border-gray-600 hover:bg-[#40444b] hover:border-gray-500"
                }`}
              >
                <div
                  className="w-8 h-8 rounded mb-1 shadow-sm"
                  style={{
                    backgroundColor: `#${item.color.toString(16).padStart(6, "0")}`,
                  }}
                />
                <span className="text-[10px] text-center text-gray-300 w-full px-1 truncate leading-tight">
                  {item.name}
                </span>
                <span className="absolute top-1 right-1 bg-black/60 px-1.5 rounded-full text-[9px] text-white font-mono">
                  x{item.count}
                </span>
              </button>
            ))}

            {inventoryItems.length === 0 && (
              <div className="col-span-full py-8 text-center text-gray-500 italic">
                Your inventory is empty.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
