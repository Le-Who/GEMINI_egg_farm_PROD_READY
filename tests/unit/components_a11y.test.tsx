import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { LanguageProvider } from "../../components/LanguageContext";
import { SidebarButton } from "../../components/ui/SidebarButton";
import { StickerPicker } from "../../components/ui/StickerPicker";
import { ShopModal } from "../../components/ui/ShopModal";
import { X } from "lucide-react";

describe("Accessibility Checks", () => {
  it("SidebarButton has accessible name matching label via aria-label", () => {
    render(
      <LanguageProvider>
        <SidebarButton
          onClick={() => {}}
          icon={X}
          label="Test Label"
          id="test-btn"
        />
      </LanguageProvider>
    );

    const button = screen.getByRole("button", { name: "Test Label" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-label", "Test Label");
  });

  it("StickerPicker close button has accessible name", () => {
    render(
      <LanguageProvider>
        <StickerPicker
          isOpen={true}
          onClose={() => {}}
          onSend={() => {}}
          ownerName="TestUser"
          billboard={[]}
        />
      </LanguageProvider>
    );

    // Should find a button with name "Close" (from t("common.close"))
    const closeButton = screen.getByRole("button", { name: /Close/i });
    expect(closeButton).toBeInTheDocument();
  });

  it("ShopModal close button has accessible name", () => {
    render(
      <LanguageProvider>
        <ShopModal
          isOpen={true}
          onClose={() => {}}
          onBuy={() => {}}
          onBuyGem={() => {}}
          userCoins={100}
          userGems={50}
          tutorialStep={0}
        />
      </LanguageProvider>
    );

    // Should find a button with name "Close" (from t("common.close"))
    const closeButton = screen.getByRole("button", { name: /Close/i });
    expect(closeButton).toBeInTheDocument();
  });
});
