import React from "react";

interface SidebarButtonProps {
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  active?: boolean;
  colorClass?: string;
  pulse?: boolean;
  id?: string;
}

// Sidebar Button Component to ensure consistency
// Updated with Fantasy Garden Theme
export const SidebarButton: React.FC<SidebarButtonProps> = ({
  onClick,
  icon: Icon,
  label,
  active = false,
  colorClass = "text-white",
  pulse = false,
  id,
}) => (
  <button
    id={id}
    onClick={onClick}
    className={`group relative w-12 h-12 rounded-2xl border-2 flex items-center justify-center shadow-lg transition-all hover:scale-105 active:scale-95 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none backdrop-blur-md ${
      active
        ? "bg-fuchsia-600/90 border-fuchsia-300 text-white shadow-fuchsia-500/30"
        : "bg-emerald-950/60 border-emerald-700/50 hover:bg-emerald-900/80 " +
          colorClass
    } ${pulse ? "animate-bounce ring-4 ring-yellow-400/50 border-yellow-200" : ""}`}
    title={label}
    aria-label={label}
  >
    <Icon size={24} className="drop-shadow-md" />
    <span className="absolute right-14 bg-emerald-950/90 border border-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none shadow-xl backdrop-blur-sm font-bold tracking-wide">
      {label}
    </span>
  </button>
);
