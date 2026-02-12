import React from "react";
import { ITEMS } from "../../constants";
import { UserState } from "../../types";
import { RotateCw, Check, X, ArrowLeft } from "lucide-react";

interface EditorBarProps {
  user: UserState;
  selectedItemId: string | null;
  rotation: number;
  onSelect: (itemId: string | null) => void;
  onRotate: () => void;
  onClose: () => void;
}

export const EditorBar: React.FC<EditorBarProps> = ({
  user,
  selectedItemId,
  rotation,
  onSelect,
  onRotate,
  onClose,
}) => {
  const inventoryItems = (Object.entries(user.inventory) as [string, number][])
    .filter(([id, count]) => count > 0 && ITEMS[id])
    .map(([id, count]) => ({ ...ITEMS[id], count }));

  return (
    <div className="absolute bottom-0 left-0 w-full bg-gray-900/95 border-t border-gray-700 p-4 pb-8 z-20 flex flex-col gap-4 animate-slide-up">
      {/* Action Bar */}
      <div className="flex justify-between items-center px-4">
        <div className="text-white font-bold text-lg flex items-center gap-2">
          <span className="text-green-400">Editing Mode</span>
        </div>

        <div className="flex gap-4">
          {selectedItemId && (
            <button
              onClick={onRotate}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg text-white font-bold hover:bg-blue-500 active:scale-95"
            >
              <RotateCw size={18} /> Rotate
            </button>
          )}
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 rounded-lg text-white font-bold hover:bg-red-500 active:scale-95"
          >
            <Check size={18} /> Done
          </button>
        </div>
      </div>

      {/* Carousel */}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide px-4">
        {inventoryItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            className={`flex-shrink-0 w-20 h-24 rounded-lg border-2 flex flex-col items-center justify-center relative transition-all ${
              selectedItemId === item.id
                ? "bg-gray-700 border-yellow-400 scale-105 shadow-yellow-400/20 shadow-lg"
                : "bg-gray-800 border-gray-600 hover:bg-gray-750"
            }`}
          >
            <div
              className="w-8 h-8 rounded mb-2 shadow-sm"
              style={{
                backgroundColor: `#${item.color.toString(16).padStart(6, "0")}`,
              }}
            />
            <span className="text-xs text-center text-gray-300 w-full px-1 truncate">
              {item.name}
            </span>
            <span className="absolute top-1 right-1 bg-black/60 px-1.5 rounded text-[10px] text-white font-mono">
              x{item.count}
            </span>
          </button>
        ))}

        {inventoryItems.length === 0 && (
          <div className="text-gray-500 w-full text-center py-4 italic">
            Your inventory is empty. Visit the shop!
          </div>
        )}
      </div>
    </div>
  );
};
