export type ThemeMode = "light" | "dark" | "oled" | "high-contrast";
export type ThemeName = ThemeMode | "system";
export type ThemeTokens = Record<string, string>;
export type SavedTheme = { id: string; name: string; tokens: ThemeTokens };

export class ThemeManager {
  private root: HTMLElement;
  private mediaQuery: MediaQueryList | null = null;
  private listeners: Array<() => void> = [];

  constructor(root?: HTMLElement) {
    this.root =
      root ||
      (typeof document !== "undefined"
        ? document.documentElement
        : (null as unknown as HTMLElement));
  }

  public initialize(): void {
    if (typeof window === "undefined") return;

    this.mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    this.mediaQuery.addEventListener("change", this.handleSystemThemeChange);

    this.applyCurrent();
  }

  private handleSystemThemeChange = (): void => {
    if (this.isSystemTheme) {
      this.applyCurrent();
      this.notifyListeners();
    }
  };

  public get isSystemTheme(): boolean {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("theme");
    return (
      stored !== "light" &&
      stored !== "dark" &&
      stored !== "oled" &&
      stored !== "high-contrast"
    );
  }

  public get currentTheme(): ThemeMode {
    if (typeof window === "undefined") return "light";
    const stored = localStorage.getItem("theme");
    if (
      stored === "light" ||
      stored === "dark" ||
      stored === "oled" ||
      stored === "high-contrast"
    ) {
      return stored as ThemeMode;
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  public get isDarkMode(): boolean {
    return this.currentTheme === "dark" || this.currentTheme === "oled";
  }

  public get isOled(): boolean {
    return this.currentTheme === "oled";
  }

  public get isHighContrast(): boolean {
    return this.currentTheme === "high-contrast";
  }

  public setTheme(theme: ThemeMode): void {
    if (typeof window === "undefined") return;
    localStorage.setItem("theme", theme);
    this.applyCurrent();
    this.notifyListeners();
  }

  public toggleTheme(): void {
    // Cycles between light -> dark -> oled -> light
    let nextTheme: ThemeMode = "light";
    if (this.currentTheme === "light") nextTheme = "dark";
    else if (this.currentTheme === "dark") nextTheme = "oled";
    else if (this.currentTheme === "oled") nextTheme = "high-contrast";
    else nextTheme = "light";

    this.setTheme(nextTheme);
  }

  public followSystem(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem("theme");
    this.applyCurrent();
    this.notifyListeners();
  }

  public applyCurrent(): void {
    if (typeof document === "undefined" || !this.root) return;
    const theme = this.currentTheme;
    const effectiveThemeAttr = theme === "oled" ? "oled-black" : theme;
    this.root.dataset.theme = effectiveThemeAttr;
    this.root.classList.toggle("dark", theme === "dark" || theme === "oled");
    this.root.classList.toggle("oled-black", theme === "oled");
    this.root.classList.toggle("high-contrast", theme === "high-contrast");

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      const color =
        theme === "oled"
          ? "#000000"
          : theme === "high-contrast"
            ? "#0047ab"
            : theme === "dark"
              ? "#212724"
              : "#F1F2ED";
      metaTheme.setAttribute("content", color);
    }
  }

  public getToken(variableName: string): string {
    if (typeof window === "undefined" || !this.root) return "";
    return getComputedStyle(this.root).getPropertyValue(variableName).trim();
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener());
  }

  public destroy(): void {
    if (this.mediaQuery) {
      this.mediaQuery.removeEventListener(
        "change",
        this.handleSystemThemeChange,
      );
      this.mediaQuery = null;
    }
    this.listeners = [];
  }
}

export const themeManager = new ThemeManager();
