/**
 * Unit tests for I18n
 */

import { describe, it, expect } from "vitest";
import { I18n } from "../src/i18n";

describe("I18n", () => {
  it("should return key if no translation found", () => {
    const i18n = new I18n("en");
    expect(i18n.t("unknown.key")).toBe("unknown.key");
  });

  it("should translate direct keys", () => {
    const i18n = new I18n("en");
    i18n.load("en", { hello: "Hello!" });
    expect(i18n.t("hello")).toBe("Hello!");
  });

  it("should translate dot-notation nested keys", () => {
    const i18n = new I18n("en");
    i18n.load("en", { ui: { shop: { title: "Shop" } } });
    expect(i18n.t("ui.shop.title")).toBe("Shop");
  });

  it("should interpolate params", () => {
    const i18n = new I18n("en");
    i18n.load("en", { greeting: "Hello, {{name}}! You have {{count}} coins." });
    expect(i18n.t("greeting", { name: "Alice", count: 42 })).toBe(
      "Hello, Alice! You have 42 coins.",
    );
  });

  it("should fall back to default locale", () => {
    const i18n = new I18n("en");
    i18n.load("en", { title: "Farm Game" });
    i18n.load("ru", {}); // Russian has no translation
    i18n.setLocale("ru");
    expect(i18n.t("title")).toBe("Farm Game"); // Falls back to en
  });

  it("should switch locales", () => {
    const i18n = new I18n("en");
    i18n.load("en", { greeting: "Hello" });
    i18n.load("ru", { greeting: "Привет" });
    expect(i18n.t("greeting")).toBe("Hello");
    i18n.setLocale("ru");
    expect(i18n.t("greeting")).toBe("Привет");
  });

  it("should list available locales", () => {
    const i18n = new I18n("en");
    i18n.load("en", {});
    i18n.load("ru", {});
    i18n.load("de", {});
    expect(i18n.getLocales()).toEqual(["en", "ru", "de"]);
  });

  it("should translate content item fields with tField", () => {
    const i18n = new I18n("en");
    const item = {
      name: "Tomato",
      localizedNames: { ru: "Помидор" },
      description: "A red fruit",
    };
    expect(i18n.tField(item, "name")).toBe("Tomato");
    i18n.setLocale("ru");
    expect(i18n.tField(item, "name")).toBe("Помидор");
  });
});
