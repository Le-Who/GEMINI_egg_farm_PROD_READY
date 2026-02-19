/**
 * Unit tests for I18n
 */

import { describe, it, expect } from "vitest";
import { I18n } from "../../core/src/i18n";

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

  it("should support explicit locale argument in tField", () => {
    const i18n = new I18n("en");
    const item = {
      name: "Tomato",
      localizedNames: { ru: "Помидор" },
    };
    // Should ignore current locale "en" and use "ru"
    expect(i18n.tField(item, "name", "ru")).toBe("Помидор");
  });

  it("should support field_locale convention", () => {
    const i18n = new I18n("en");
    const item = {
      name: "Apple",
      name_fr: "Pomme",
    };
    i18n.setLocale("fr");
    expect(i18n.tField(item, "name")).toBe("Pomme");
  });

  it("should support localizedDescriptions map", () => {
    const i18n = new I18n("en");
    const item = {
      description: "A red fruit",
      localizedDescriptions: { es: "Una fruta roja" },
    };
    i18n.setLocale("es");
    expect(i18n.tField(item, "description")).toBe("Una fruta roja");
  });

  it("should prioritize field_locale over localizedNames map", () => {
    const i18n = new I18n("en");
    const item = {
      name: "Tomato",
      name_ru: "Томат",
      localizedNames: { ru: "Помидор" },
    };
    i18n.setLocale("ru");
    // Code checks `field_loc` first
    expect(i18n.tField(item, "name")).toBe("Томат");
  });

  it("should fall back to default field if translation missing", () => {
    const i18n = new I18n("en");
    const item = {
      name: "Carrot",
      localizedNames: {},
    };
    i18n.setLocale("de");
    expect(i18n.tField(item, "name")).toBe("Carrot");
  });

  it("should return empty string if field missing entirely", () => {
    const i18n = new I18n("en");
    const item = {};
    expect(i18n.tField(item, "name")).toBe("");
  });

  it("should handle custom fields with field_locale convention", () => {
    const i18n = new I18n("en");
    const item = {
      title: "Boss",
      title_jp: "Shacho",
    };
    i18n.setLocale("jp");
    expect(i18n.tField(item, "title")).toBe("Shacho");
  });
});
