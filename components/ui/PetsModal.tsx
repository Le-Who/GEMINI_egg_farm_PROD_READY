import React from "react";
import { UserState } from "../../types";
import { PETS } from "../../constants";
import { ChevronRight, PawPrint, Star } from "lucide-react";

interface PetsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onEquip: (petId: string) => void;
  user: UserState;
}

export const PetsModal: React.FC<PetsModalProps> = ({
  isOpen,
  onClose,
  onEquip,
  user,
}) => {
  return (
    <>
      {/* Backdrop */}
      <div
        className={`absolute inset-0 z-40 bg-black/40 transition-opacity duration-300 ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />

      {/* Slide Panel */}
      <div
        className={`absolute top-0 right-0 h-full z-50 w-[85%] max-w-[380px] transition-transform duration-300 ease-out ${isOpen ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="h-full bg-gray-800/95 backdrop-blur-md border-l-2 border-indigo-600/60 flex flex-col shadow-2xl">
          {/* Header */}
          <div className="flex justify-between items-center p-4 bg-indigo-900/40 border-b border-indigo-800/50 shrink-0">
            <div className="flex items-center gap-2 text-indigo-100">
              <PawPrint size={22} />
              <h2 className="text-lg font-bold">Pet Collection</h2>
              <span className="text-xs bg-indigo-600/50 px-2 py-0.5 rounded-full font-mono">
                {user.pets.length}
              </span>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-700/80 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-3 min-h-0">
            {user.pets.length === 0 && (
              <div className="text-gray-400 text-center py-12 flex flex-col items-center gap-3">
                <PawPrint size={40} className="text-gray-600" />
                <p className="font-bold">No Pets Yet</p>
                <p className="text-sm text-gray-500">
                  Buy an Incubator and an Egg from the shop!
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              {user.pets.map((pet) => {
                const config = PETS[pet.configId];
                const isEquipped = user.equippedPetId === pet.id;

                return (
                  <div
                    key={pet.id}
                    className={`flex items-center p-3 rounded-lg border-2 transition-all ${
                      isEquipped
                        ? "bg-indigo-900/30 border-indigo-500 shadow-lg shadow-indigo-500/10"
                        : "bg-gray-700/60 border-gray-600/50 hover:bg-gray-700"
                    }`}
                  >
                    {/* Pet Icon */}
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center mr-3 shrink-0 shadow-md"
                      style={{
                        backgroundColor: `#${config.color.toString(16).padStart(6, "0")}`,
                      }}
                    >
                      <PawPrint size={18} className="text-white opacity-80" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-white text-sm">
                          {pet.name}
                        </h3>
                        {isEquipped && (
                          <span className="text-[9px] bg-indigo-500 text-white px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-300 flex items-center gap-1">
                        <Star size={10} className="text-yellow-400" />
                        Lvl {pet.level} • {config.bonusDescription}
                      </p>
                    </div>

                    {/* Action */}
                    {!isEquipped && (
                      <button
                        onClick={() => onEquip(pet.id)}
                        className="px-3 py-1.5 bg-gray-600 hover:bg-indigo-600 text-white text-xs font-bold rounded-lg transition-colors shrink-0"
                      >
                        Equip
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
