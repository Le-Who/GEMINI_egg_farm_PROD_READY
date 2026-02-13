import React from "react";
import type { EchoMark } from "../../types";

interface EchoSummaryBannerProps {
  echoMarks: EchoMark[];
  onDismiss: () => void;
}

const ACTION_ICONS: Record<string, string> = {
  watering: "💧",
  billboard_post: "✒️",
};

const ACTION_LABELS: Record<string, string> = {
  watering: "watered",
  billboard_post: "left a note on",
};

/**
 * Glassmorphism banner shown to the territory owner when new echo marks exist.
 * Aggregates visitor interactions into a readable summary.
 */
export const EchoSummaryBanner: React.FC<EchoSummaryBannerProps> = ({
  echoMarks,
  onDismiss,
}) => {
  const newMarks = echoMarks.filter((m) => m.status === "new");
  if (newMarks.length === 0) return null;

  // Group by actor
  const grouped: Record<string, { watering: number; billboard_post: number }> =
    {};
  for (const mark of newMarks) {
    if (!grouped[mark.actorNick]) {
      grouped[mark.actorNick] = { watering: 0, billboard_post: 0 };
    }
    grouped[mark.actorNick][mark.actionType]++;
  }

  // Build summary lines
  const summaryLines: string[] = [];
  for (const [nick, counts] of Object.entries(grouped)) {
    const parts: string[] = [];
    if (counts.watering > 0) {
      parts.push(
        `${ACTION_ICONS.watering} watered ${counts.watering} plant${counts.watering > 1 ? "s" : ""}`,
      );
    }
    if (counts.billboard_post > 0) {
      parts.push(
        `${ACTION_ICONS.billboard_post} left ${counts.billboard_post} note${counts.billboard_post > 1 ? "s" : ""}`,
      );
    }
    summaryLines.push(`**${nick}** ${parts.join(", ")}`);
  }

  return (
    <div
      className="echo-summary-banner"
      role="alert"
      aria-live="polite"
      style={{
        position: "fixed",
        top: "16px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        minWidth: "320px",
        maxWidth: "500px",
        padding: "16px 24px",
        borderRadius: "16px",
        background: "rgba(30, 40, 80, 0.85)",
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        border: "1px solid rgba(136, 204, 255, 0.3)",
        boxShadow:
          "0 8px 32px rgba(0, 0, 0, 0.4), 0 0 60px rgba(136, 204, 255, 0.1)",
        color: "#fff",
        fontFamily: "Inter, system-ui, sans-serif",
        animation: "echoSlideIn 0.4s ease-out",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "8px",
        }}
      >
        <span style={{ fontSize: "20px" }}>👻</span>
        <span
          style={{
            fontWeight: 700,
            fontSize: "14px",
            letterSpacing: "0.5px",
            textTransform: "uppercase",
            color: "#88ccff",
          }}
        >
          While you were away...
        </span>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          marginBottom: "12px",
        }}
      >
        {summaryLines.map((line, i) => (
          <div
            key={i}
            style={{ fontSize: "13px", lineHeight: "1.5", color: "#dde" }}
            dangerouslySetInnerHTML={{
              __html: line.replace(
                /\*\*(.*?)\*\*/g,
                '<strong style="color:#fff">$1</strong>',
              ),
            }}
          />
        ))}
      </div>

      <button
        onClick={onDismiss}
        aria-label="Dismiss echo summary"
        style={{
          width: "100%",
          padding: "8px 16px",
          borderRadius: "8px",
          border: "1px solid rgba(136, 204, 255, 0.3)",
          background: "rgba(136, 204, 255, 0.15)",
          color: "#88ccff",
          fontWeight: 600,
          fontSize: "13px",
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          (e.target as HTMLElement).style.background =
            "rgba(136, 204, 255, 0.3)";
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLElement).style.background =
            "rgba(136, 204, 255, 0.15)";
        }}
      >
        Got it ✨
      </button>

      <style>{`
        @keyframes echoSlideIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>
    </div>
  );
};
