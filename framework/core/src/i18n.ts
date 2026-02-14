/**
 * i18n — Simple internationalization helper.
 *
 * Supports namespaced keys (e.g., "ui.shop.title") and locale fallback.
 * Translations are loaded from JSON/objects.
 */

export type TranslationData = Record<string, string | Record<string, any>>;

export class I18n {
  private translations: Map<string, TranslationData> = new Map();
  private currentLocale: string;
  private fallbackLocale: string;

  constructor(defaultLocale: string = "en", fallbackLocale?: string) {
    this.currentLocale = defaultLocale;
    this.fallbackLocale = fallbackLocale ?? defaultLocale;
  }

  /** Load translations for a locale */
  load(locale: string, data: TranslationData): void {
    const existing = this.translations.get(locale) ?? {};
    this.translations.set(locale, { ...existing, ...data });
  }

  /** Set the active locale */
  setLocale(locale: string): void {
    this.currentLocale = locale;
  }

  /** Get the active locale */
  getLocale(): string {
    return this.currentLocale;
  }

  /** Get available locales */
  getLocales(): string[] {
    return Array.from(this.translations.keys());
  }

  /**
   * Translate a key.
   * Supports dot-notation for nested keys: t("ui.shop.title")
   * Supports interpolation: t("greeting", { name: "Alice" }) → "Hello, Alice!"
   */
  t(key: string, params?: Record<string, string | number>): string {
    let value = this.resolve(key, this.currentLocale);

    // Fallback to default locale
    if (value === undefined && this.currentLocale !== this.fallbackLocale) {
      value = this.resolve(key, this.fallbackLocale);
    }

    // Return key if not found
    if (value === undefined) return key;

    // Interpolate params
    if (params) {
      return value.replace(/\{\{(\w+)\}\}/g, (_, name) =>
        params[name] !== undefined ? String(params[name]) : `{{${name}}}`,
      );
    }

    return value;
  }

  /**
   * Helper for content items with localized fields.
   * Example: tField(item, "name", "ru") → item.name_ru ?? item.name
   */
  tField(obj: Record<string, any>, field: string, locale?: string): string {
    const loc = locale ?? this.currentLocale;
    if (loc !== this.fallbackLocale) {
      const localizedKey = `${field}_${loc}`;
      if (obj[localizedKey]) return obj[localizedKey];

      // Check localizedNames/localizedDescriptions map
      const mapKey =
        field === "name"
          ? "localizedNames"
          : field === "description"
            ? "localizedDescriptions"
            : null;
      if (mapKey && obj[mapKey]?.[loc]) return obj[mapKey][loc];
    }
    return obj[field] ?? "";
  }

  private resolve(key: string, locale: string): string | undefined {
    const data = this.translations.get(locale);
    if (!data) return undefined;

    // Direct lookup
    if (typeof data[key] === "string") return data[key] as string;

    // Dot-notation lookup
    const parts = key.split(".");
    let current: any = data;
    for (const part of parts) {
      if (current == null || typeof current !== "object") return undefined;
      current = current[part];
    }

    return typeof current === "string" ? current : undefined;
  }
}

/** Shared i18n instance */
export const i18n = new I18n("en");
