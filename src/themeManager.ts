export const THEME_STORAGE_KEY = "planner_theme";
export const ACTIVE_THEME_TYPE_KEY = "active_theme_type";
export const ACTIVE_PRESET_NAME_KEY = "active_preset_name";
export const ACTIVE_CUSTOM_TOKENS_KEY = "active_custom_tokens";
export const USER_SAVED_THEMES_KEY = "user_saved_themes";

export const THEMES = [
  { id: "warm-alabaster", label: "ألبستر دافئ", isDark: false },
  { id: "toasted-mocha", label: "موكا كلاسيكي", isDark: true },
  { id: "pure-onyx", label: "أونيكس مطلق", isDark: true },
  { id: "cyber-pulse", label: "نبض سيبراني", isDark: true },
  { id: "academic-sapphire", label: "ياقوت أكاديمي", isDark: true },
  { id: "warm-ivory", label: "عاجي دافئ", isDark: false },
  { id: "deep-navy", label: "كحلي عميق", isDark: true },
  { id: "slate-indigo", label: "نيلي رمادي", isDark: false },
  { id: "deep-forest", label: "غابة عميقة", isDark: true },
  { id: "cyber-violet", label: "بنفسجي سيبراني", isDark: true },
  { id: "tokyo-cyberpunk", label: "طوكيو سايبربانك", isDark: true },
  { id: "liquid-amber", label: "كهرمان سائل", isDark: true },
  { id: "swiss-luxury", label: "فخامة سويسرية", isDark: false },
  { id: "bioluminescent-abyss", label: "الهاوية المتلألئة", isDark: true },
] as const;

export type ThemeName = (typeof THEMES)[number]["id"];
export type ThemeTokens = {
  bgCanvas: string;
  surfaceCard: string;
  textMain: string;
  accentPrimary: string;
};
export type SavedTheme = {
  id: string;
  name: string;
  tokens: ThemeTokens;
};

export const DEFAULT_THEME: ThemeName = "academic-sapphire";
export const THEME_PRESETS: ReadonlyArray<{
  id: ThemeName;
  label: string;
  tokens: ThemeTokens;
}> = [
  {
    id: "warm-alabaster",
    label: "Warm Alabaster",
    tokens: {
      bgCanvas: "#FAF8F5",
      surfaceCard: "#FFFFFF",
      textMain: "#1E293B",
      accentPrimary: "#0284C7",
    },
  },
  {
    id: "toasted-mocha",
    label: "Toasted Mocha",
    tokens: {
      bgCanvas: "#241E1C",
      surfaceCard: "#332B28",
      textMain: "#F5EBE6",
      accentPrimary: "#D97706",
    },
  },
  {
    id: "pure-onyx",
    label: "Pure Onyx",
    tokens: {
      bgCanvas: "#000000",
      surfaceCard: "#0D0D0D",
      textMain: "#EDEDED",
      accentPrimary: "#3B82F6",
    },
  },
  {
    id: "cyber-pulse",
    label: "Cyber Pulse",
    tokens: {
      bgCanvas: "#080711",
      surfaceCard: "#120F24",
      textMain: "#FDFEFE",
      accentPrimary: "#00F0FF",
    },
  },
  {
    id: "academic-sapphire",
    label: "Academic Sapphire",
    tokens: {
      bgCanvas: "#0A1128",
      surfaceCard: "#121D3D",
      textMain: "#F0F4FF",
      accentPrimary: "#4F46E5",
    },
  },
];

const LEGACY_DARK_THEME = "deep-navy";
const LEGACY_LIGHT_THEME = "warm-ivory";
const HEX_COLOR_PATTERN = /^#[\da-f]{6}$/i;

export function isThemeName(value: string): value is ThemeName {
  return THEMES.some((theme) => theme.id === value);
}

export function isThemeTokens(value: unknown): value is ThemeTokens {
  if (typeof value !== "object" || value === null) return false;
  const tokens = value as Record<string, unknown>;
  return (
    typeof tokens.bgCanvas === "string" &&
    HEX_COLOR_PATTERN.test(tokens.bgCanvas) &&
    typeof tokens.surfaceCard === "string" &&
    HEX_COLOR_PATTERN.test(tokens.surfaceCard) &&
    typeof tokens.textMain === "string" &&
    HEX_COLOR_PATTERN.test(tokens.textMain) &&
    typeof tokens.accentPrimary === "string" &&
    HEX_COLOR_PATTERN.test(tokens.accentPrimary)
  );
}

function isSavedTheme(value: unknown): value is SavedTheme {
  if (typeof value !== "object" || value === null) return false;
  const theme = value as Record<string, unknown>;
  return (
    typeof theme.id === "string" &&
    theme.id.length > 0 &&
    typeof theme.name === "string" &&
    theme.name.trim().length > 0 &&
    theme.name.length <= 40 &&
    isThemeTokens(theme.tokens)
  );
}

export function isDarkTheme(themeName: ThemeName): boolean {
  return THEMES.find((theme) => theme.id === themeName)?.isDark ?? false;
}

function getBrowserStorage(): Storage | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage;
  } catch (error) {
    console.error("Unable to access localStorage for theme preferences", error);
    return null;
  }
}

function getSystemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

export class ThemeManager {
  private readonly root: HTMLElement;
  private readonly storage: Storage | null;
  private activePreset: ThemeName = DEFAULT_THEME;
  private customTokens: ThemeTokens | null = null;
  private customIsDark = true;

  constructor(root?: HTMLElement, storage?: Storage | null) {
    if (root) {
      this.root = root;
    } else if (typeof document !== "undefined") {
      this.root = document.documentElement;
    } else {
      throw new Error("ThemeManager requires a document root element.");
    }

    this.storage = storage === undefined ? getBrowserStorage() : storage;
  }

  initialize(): ThemeName {
    const savedPreset = this.readStorage(ACTIVE_PRESET_NAME_KEY);
    const preset = savedPreset && isThemeName(savedPreset) ? savedPreset : null;
    const activeType = this.readStorage(ACTIVE_THEME_TYPE_KEY);
    const savedTokens = this.readJsonStorage(ACTIVE_CUSTOM_TOKENS_KEY);

    if (activeType === "custom" && isThemeTokens(savedTokens)) {
      this.activePreset = preset ?? DEFAULT_THEME;
      this.customTokens = { ...savedTokens };
      this.customIsDark = isColorDark(savedTokens.bgCanvas);
      this.applyCustom(savedTokens);
      return this.activePreset;
    }

    this.activePreset =
      preset ??
      this.readSavedTheme() ??
      (getSystemPrefersDark() ? DEFAULT_THEME : "warm-alabaster");
    this.applyPreset(this.activePreset);
    return this.activePreset;
  }

  setTheme(theme: ThemeName): void {
    if (!isThemeName(theme)) {
      throw new Error(`Unsupported theme: ${theme}`);
    }

    this.activePreset = theme;
    this.customTokens = null;
    this.applyPreset(theme);
    this.persist(ACTIVE_THEME_TYPE_KEY, "preset");
    this.persist(ACTIVE_PRESET_NAME_KEY, theme);
    this.persist(THEME_STORAGE_KEY, theme);
  }

  private readSavedTheme(): ThemeName | null {
    const savedTheme = this.readStorage(THEME_STORAGE_KEY);
    if (savedTheme && isThemeName(savedTheme)) return savedTheme;

    const legacyDarkMode = this.readStorage("dark_mode");
    if (legacyDarkMode === "true") return LEGACY_DARK_THEME;
    if (legacyDarkMode === "false") return LEGACY_LIGHT_THEME;

    return null;
  }

  previewCustom(tokens: ThemeTokens): boolean {
    if (!isThemeTokens(tokens)) {
      throw new Error("Custom theme contains an invalid HEX color.");
    }

    this.customTokens = { ...tokens };
    this.customIsDark = isColorDark(tokens.bgCanvas);
    this.applyCustom(tokens);
    this.persist(ACTIVE_THEME_TYPE_KEY, "custom");
    this.persist(ACTIVE_PRESET_NAME_KEY, this.activePreset);
    return this.persist(ACTIVE_CUSTOM_TOKENS_KEY, JSON.stringify(tokens));
  }

  getActiveTokens(): ThemeTokens {
    if (this.customTokens) return { ...this.customTokens };
    const preset = THEME_PRESETS.find(({ id }) => id === this.activePreset);
    return { ...(preset?.tokens ?? THEME_PRESETS[4].tokens) };
  }

  get activePresetName(): ThemeName {
    return this.activePreset;
  }

  getSavedThemes(): SavedTheme[] {
    const storedThemes = this.readJsonStorage(USER_SAVED_THEMES_KEY);
    if (!Array.isArray(storedThemes)) return [];
    return storedThemes.filter(isSavedTheme).map((theme) => ({
      ...theme,
      tokens: { ...theme.tokens },
    }));
  }

  saveCustomTheme(name: string, tokens: ThemeTokens): SavedTheme {
    const cleanName = name.trim().replace(/\s+/g, " ");
    if (
      !cleanName ||
      cleanName.length > 40 ||
      /[\u0000-\u001f\u007f]/.test(cleanName)
    ) {
      throw new Error("اكتب اسماً من 1 إلى 40 حرفاً للثيم.");
    }
    if (!isThemeTokens(tokens)) {
      throw new Error("تحقق من رموز الألوان قبل حفظ الثيم.");
    }

    const themes = this.getSavedThemes();
    if (
      themes.some(
        ({ name: existingName }) =>
          existingName.toLocaleLowerCase() === cleanName.toLocaleLowerCase(),
      )
    ) {
      throw new Error("يوجد ثيم محفوظ بهذا الاسم بالفعل.");
    }

    const savedTheme: SavedTheme = {
      id: this.createId(),
      name: cleanName,
      tokens: { ...tokens },
    };
    if (
      !this.persist(
        USER_SAVED_THEMES_KEY,
        JSON.stringify([...themes, savedTheme]),
      )
    ) {
      throw new Error("تعذر حفظ الثيم في مساحة التخزين.");
    }
    return savedTheme;
  }

  deleteSavedTheme(id: string): boolean {
    const themes = this.getSavedThemes();
    const remainingThemes = themes.filter((theme) => theme.id !== id);
    if (remainingThemes.length === themes.length) return false;
    return this.persist(USER_SAVED_THEMES_KEY, JSON.stringify(remainingThemes));
  }

  get isDarkMode(): boolean {
    return this.customTokens
      ? this.customIsDark
      : isDarkTheme(this.activePreset);
  }

  private applyPreset(theme: ThemeName): void {
    this.root.removeAttribute("data-color-scheme");
    this.root.dataset.theme = theme;
    this.root.classList.toggle("dark", isDarkTheme(theme));
    this.clearCustomProperties();
  }

  private applyCustom(tokens: ThemeTokens): void {
    this.root.dataset.theme = "custom";
    this.root.dataset.colorScheme = this.customIsDark ? "dark" : "light";
    this.root.classList.toggle("dark", this.customIsDark);
    this.root.style.setProperty("--bg-canvas", tokens.bgCanvas);
    this.root.style.setProperty("--surface-card", tokens.surfaceCard);
    this.root.style.setProperty("--text-main", tokens.textMain);
    this.root.style.setProperty("--accent-primary", tokens.accentPrimary);
  }

  private clearCustomProperties(): void {
    this.root.style.removeProperty("--bg-canvas");
    this.root.style.removeProperty("--surface-card");
    this.root.style.removeProperty("--text-main");
    this.root.style.removeProperty("--accent-primary");
  }

  private readStorage(key: string): string | null {
    if (!this.storage) return null;
    try {
      return this.storage.getItem(key);
    } catch (error) {
      console.error("Unable to read saved theme preference", error);
      this.reportStorageFailure();
      return null;
    }
  }

  private readJsonStorage(key: string): unknown {
    const value = this.readStorage(key);
    if (!value) return null;
    try {
      return JSON.parse(value) as unknown;
    } catch (error) {
      console.error(`Unable to parse saved theme data for ${key}`, error);
      return null;
    }
  }

  private persist(key: string, value: string): boolean {
    if (!this.storage) {
      this.reportStorageFailure();
      return false;
    }
    try {
      this.storage.setItem(key, value);
      return true;
    } catch (error) {
      console.error(`Unable to save theme preference ${key}`, error);
      this.reportStorageFailure();
      return false;
    }
  }

  private createId(): string {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  private reportStorageFailure(): void {
    if (typeof window === "undefined") return;

    window.dispatchEvent(
      new CustomEvent("planner:storage-issue", {
        detail:
          "تعذر حفظ السمة على هذا الجهاز. تحقّق من إعدادات التخزين في المتصفح.",
      }),
    );
  }
}

function isColorDark(hex: string): boolean {
  const channels = hex.slice(1).match(/.{2}/g);
  if (!channels) return true;
  const [red, green, blue] = channels.map(
    (channel) => Number.parseInt(channel, 16) / 255,
  );
  const linear = [red, green, blue].map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2] < 0.35;
}
