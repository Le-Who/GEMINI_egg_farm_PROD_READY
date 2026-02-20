import React, { useState, useEffect } from "react";
import { TUTORIAL_STEPS } from "../../constants";
import { UserState } from "../../types";
import {
  X,
  Check,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { GameEngine } from "../../services/gameEngine";
import { useLanguage } from "../../components/LanguageContext";

interface TutorialOverlayProps {
  user: UserState;
  onUpdateUser: (u: UserState) => void;
}

export const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  user,
  onUpdateUser,
}) => {
  const { t, tContent } = useLanguage();
  const [isHidden, setIsHidden] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const step = TUTORIAL_STEPS[user.tutorialStep];

  // Effect to track target element
  useEffect(() => {
    if (user.completedTutorial || !step || !step.targetId) {
      setTargetRect(null);
      return;
    }

    const updateRect = () => {
      let finalId = step.targetId;
      // Map generic IDs to specific DOM IDs
      if (step.targetId === "shop_button") finalId = "btn-shop";
      if (step.targetId === "edit_mode_button") finalId = "btn-edit-mode";

      // Try to find exact ID or shop/item variants
      let element = document.getElementById(finalId!);
      if (!element)
        element = document.getElementById(`shop-item-${step.targetId}`);
      if (!element) element = document.getElementById(`item-${step.targetId}`);

      if (element) {
        setTargetRect(element.getBoundingClientRect());
      } else {
        setTargetRect(null);
      }
    };

    updateRect();
    const interval = setInterval(updateRect, 500); // Check for element appearance
    window.addEventListener("resize", updateRect);

    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", updateRect);
    };
  }, [step, user.tutorialStep, user.completedTutorial]);

  if (user.completedTutorial || isHidden) return null;
  if (!step) return null;

  const isLastStep = step.trigger === "COMPLETE";

  const handleFinish = async () => {
    if (isLastStep) {
      const u = await GameEngine.triggerTutorial("COMPLETE");
      onUpdateUser(u);
    }
  };

  return (
    <>
      {/* 1. The Pointer (High Z-Index) */}
      {targetRect && (
        <div
          className="fixed z-[70] pointer-events-none transition-all duration-300 ease-out"
          style={{
            top: targetRect.top + targetRect.height / 2,
            left: targetRect.left + targetRect.width / 2,
          }}
        >
          {/* Pulsing Ring overlay on key element */}
          <div className="absolute -translate-x-1/2 -translate-y-1/2 w-16 h-16 border-4 border-yellow-400 rounded-full animate-ping opacity-50" />

          {/* Floating Finger/Arrow */}
          <div className="absolute -translate-x-1/2 -translate-y-1/2 -ml-12 -mt-12 animate-bounce">
            <div className="bg-white text-black font-bold px-3 py-1 rounded-full shadow-xl border-2 border-yellow-400 whitespace-nowrap flex items-center gap-1">
              {t("tutorial.tapHere")} <ArrowDown size={16} />
            </div>
          </div>
        </div>
      )}

      {/* 2. The Speech Bubble (Grandma) */}
      <div className="fixed bottom-32 left-1/2 -translate-x-1/2 w-full max-w-lg z-40 pointer-events-none">
        <div
          onClick={isLastStep ? handleFinish : undefined}
          className={`relative mx-4 bg-orange-100 border-4 border-orange-300 rounded-xl p-4 shadow-2xl flex gap-4 animate-bounce-slight pointer-events-auto group ${isLastStep ? "cursor-pointer hover:bg-orange-50" : ""}`}
        >
          {/* Close Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsHidden(true);
            }}
            className="absolute top-1 right-1 p-1 text-orange-400 hover:text-orange-600 hover:bg-orange-200 rounded-full transition-colors opacity-0 group-hover:opacity-100"
          >
            <X size={14} />
          </button>

          {/* Grandma Avatar */}
          <div className="shrink-0 w-16 h-16 bg-gray-300 rounded-full border-2 border-white shadow-md overflow-hidden relative">
            <div className="absolute inset-0 bg-gray-400 flex items-center justify-center">
              <span className="text-2xl">👵</span>
            </div>
          </div>

          <div className="flex-1 pr-4">
            <h3 className="font-bold text-orange-900 text-sm uppercase tracking-wider mb-1">
              {t("tutorial.grandmaRose")}
            </h3>
            <p className="text-orange-900 font-medium leading-tight">
              {tContent(step, "text")}
            </p>
            {isLastStep && (
              <div className="mt-2 flex items-center gap-1 text-xs font-bold text-orange-600 animate-pulse">
                <Check size={12} /> {t("tutorial.clickToFinish")}
              </div>
            )}
          </div>

          {/* Triangle tail */}
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-orange-100 border-r-4 border-b-4 border-orange-300 transform rotate-45"></div>
        </div>
      </div>
    </>
  );
};
