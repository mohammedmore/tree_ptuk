import { useEffect, useRef, useState } from "react";
import { Palette, Trash2, X } from "lucide-react";
import {
  THEME_PRESETS,
  type SavedTheme,
  type ThemeManager,
  type ThemeTokens,
} from "../themeManager";

type ThemeStudioProps = {
  manager: ThemeManager;
  onThemeStateChange: (isDark: boolean) => void;
};

type TokenKey = keyof ThemeTokens;

const COLOR_FIELDS: ReadonlyArray<{
  key: TokenKey;
  label: string;
  description: string;
}> = [
  {
    key: "bgCanvas",
    label: "خلفية الصفحة",
    description: "Canvas background",
  },
  {
    key: "surfaceCard",
    label: "البطاقات والحاويات",
    description: "Cards and surfaces",
  },
  {
    key: "textMain",
    label: "النصوص الأساسية",
    description: "Main typography",
  },
  {
    key: "accentPrimary",
    label: "لون التمييز",
    description: "Accent and links",
  },
];

const HEX_PATTERN = /^#[\da-f]{6}$/i;

function tokensMatch(left: ThemeTokens, right: ThemeTokens): boolean {
  return COLOR_FIELDS.every(({ key }) => left[key] === right[key]);
}

export function ThemeStudio({
  manager,
  onThemeStateChange,
}: ThemeStudioProps): React.JSX.Element {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [tokens, setTokens] = useState<ThemeTokens>(() =>
    manager.getActiveTokens(),
  );
  const [hexValues, setHexValues] = useState<ThemeTokens>(() =>
    manager.getActiveTokens(),
  );
  const [savedThemes, setSavedThemes] = useState<SavedTheme[]>(() =>
    manager.getSavedThemes(),
  );
  const [themeName, setThemeName] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  const openStudio = (): void => {
    const activeTokens = manager.getActiveTokens();
    setTokens(activeTokens);
    setHexValues(activeTokens);
    setSavedThemes(manager.getSavedThemes());
    setStatus("");
    setError("");
    setIsOpen(true);
  };

  const updateColor = (key: TokenKey, value: string): void => {
    if (!HEX_PATTERN.test(value)) return;
    const nextTokens = { ...tokens, [key]: value.toUpperCase() };
    setTokens(nextTokens);
    setHexValues((current) => ({ ...current, [key]: value.toUpperCase() }));
    manager.previewCustom(nextTokens);
    onThemeStateChange(manager.isDarkMode);
    setError("");
    setStatus("تم تحديث المعاينة مباشرة.");
  };

  const applyPreset = (theme: (typeof THEME_PRESETS)[number]): void => {
    manager.setTheme(theme.id);
    setTokens({ ...theme.tokens });
    setHexValues({ ...theme.tokens });
    onThemeStateChange(manager.isDarkMode);
    setError("");
    setStatus(`تم تطبيق ثيم ${theme.label}.`);
  };

  const applySavedTheme = (theme: SavedTheme): void => {
    manager.previewCustom(theme.tokens);
    setTokens({ ...theme.tokens });
    setHexValues({ ...theme.tokens });
    onThemeStateChange(manager.isDarkMode);
    setError("");
    setStatus(`تم تطبيق الثيم المحفوظ: ${theme.name}.`);
  };

  const saveTheme = (): void => {
    try {
      const savedTheme = manager.saveCustomTheme(themeName, tokens);
      setSavedThemes((current) => [...current, savedTheme]);
      setThemeName("");
      setError("");
      setStatus(`تم حفظ الثيم باسم ${savedTheme.name}.`);
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "تعذر حفظ الثيم.";
      setError(message);
      setStatus("");
    }
  };

  const deleteTheme = (theme: SavedTheme): void => {
    if (!manager.deleteSavedTheme(theme.id)) {
      setError("تعذر حذف الثيم المحفوظ.");
      setStatus("");
      return;
    }
    setSavedThemes((current) =>
      current.filter((savedTheme) => savedTheme.id !== theme.id),
    );
    setError("");
    setStatus(`تم حذف الثيم ${theme.name}.`);
  };

  return (
    <>
      <button
        aria-label="فتح استوديو الألوان"
        className="theme-studio-trigger"
        onClick={openStudio}
        type="button"
      >
        <Palette aria-hidden="true" size={17} />
        <span>الألوان</span>
      </button>

      <dialog
        aria-labelledby="theme-studio-title"
        className="theme-studio-dialog"
        onClick={(event) => {
          if (event.target === event.currentTarget) setIsOpen(false);
        }}
        onClose={() => setIsOpen(false)}
        ref={dialogRef}
      >
        <header className="theme-studio-header">
          <div>
            <p className="theme-studio-eyebrow">PERSONALIZE YOUR PLANNER</p>
            <h2 id="theme-studio-title">استوديو الألوان</h2>
            <p>اختر لوحة جاهزة أو صمّم ألوانك واحفظها على هذا الجهاز.</p>
          </div>
          <button
            aria-label="إغلاق استوديو الألوان"
            className="theme-studio-icon-button"
            onClick={() => setIsOpen(false)}
            type="button"
          >
            <X aria-hidden="true" size={19} />
          </button>
        </header>

        <div className="theme-studio-content">
          <section aria-labelledby="theme-presets-title">
            <div className="theme-studio-section-heading">
              <div>
                <h3 id="theme-presets-title">الثيمات الجاهزة</h3>
                <p>خمسة أجواء مصممة للتركيز والراحة.</p>
              </div>
              <span className="theme-studio-count">05 PRESETS</span>
            </div>
            <div className="theme-preset-grid">
              {THEME_PRESETS.map((preset) => {
                const selected = tokensMatch(tokens, preset.tokens);
                return (
                  <button
                    aria-pressed={selected}
                    className={`theme-preset${selected ? " is-selected" : ""}`}
                    key={preset.id}
                    onClick={() => applyPreset(preset)}
                    type="button"
                  >
                    <span aria-hidden="true" className="theme-preset-swatches">
                      {COLOR_FIELDS.map(({ key, label }) => (
                        <input
                          className="theme-swatch"
                          disabled
                          key={key}
                          tabIndex={-1}
                          type="color"
                          value={preset.tokens[key]}
                        />
                      ))}
                    </span>
                    <span className="theme-preset-name">{preset.label}</span>
                    <span className="theme-preset-id">{preset.id}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="theme-custom-title">
            <div className="theme-studio-section-heading">
              <div>
                <h3 id="theme-custom-title">لوحة ألوانك</h3>
                <p>تتغير ألوان المخطط مباشرة أثناء التعديل.</p>
              </div>
              <span aria-live="polite" className="theme-live-badge">
                <span aria-hidden="true" />
                معاينة مباشرة
              </span>
            </div>
            <div className="theme-color-grid">
              {COLOR_FIELDS.map(({ key, label, description }) => (
                <label
                  className="theme-color-field"
                  htmlFor={`theme-${key}`}
                  key={key}
                >
                  <span className="theme-color-field-copy">
                    <span>{label}</span>
                    <small>{description}</small>
                  </span>
                  <span className="theme-color-controls">
                    <input
                      aria-label={`اختيار لون ${label}`}
                      className="theme-color-picker"
                      id={`theme-${key}`}
                      onChange={(event) =>
                        updateColor(key, event.currentTarget.value)
                      }
                      type="color"
                      value={tokens[key]}
                    />
                    <input
                      aria-label={`كود HEX للون ${label}`}
                      aria-invalid={!HEX_PATTERN.test(hexValues[key])}
                      className="theme-hex-input"
                      maxLength={7}
                      onBlur={() => {
                        if (!HEX_PATTERN.test(hexValues[key])) {
                          setHexValues((current) => ({
                            ...current,
                            [key]: tokens[key],
                          }));
                        }
                      }}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        setHexValues((current) => ({
                          ...current,
                          [key]: value,
                        }));
                        if (HEX_PATTERN.test(value)) updateColor(key, value);
                      }}
                      spellCheck={false}
                      value={hexValues[key]}
                    />
                  </span>
                </label>
              ))}
            </div>
          </section>

          <section aria-labelledby="theme-save-title">
            <div className="theme-studio-section-heading">
              <div>
                <h3 id="theme-save-title">ثيماتي المحفوظة</h3>
                <p>تظل لوحاتك محفوظة محلياً في هذا المتصفح.</p>
              </div>
            </div>
            <form
              className="theme-save-form"
              onSubmit={(event) => {
                event.preventDefault();
                saveTheme();
              }}
            >
              <label className="theme-name-field" htmlFor="theme-name">
                <span className="sr-only">اسم الثيم الجديد</span>
                <input
                  id="theme-name"
                  maxLength={40}
                  onChange={(event) => setThemeName(event.currentTarget.value)}
                  placeholder="سمّ لوحة الألوان..."
                  type="text"
                  value={themeName}
                />
              </label>
              <button className="theme-save-button" type="submit">
                حفظ الثيم
              </button>
            </form>

            {error && (
              <p
                aria-live="assertive"
                className="theme-studio-error"
                role="alert"
              >
                {error}
              </p>
            )}
            {status && (
              <p
                aria-live="polite"
                className="theme-studio-status"
                role="status"
              >
                {status}
              </p>
            )}

            {savedThemes.length === 0 ? (
              <p className="theme-empty-state">
                لا توجد ثيمات محفوظة بعد. احفظ لوحة ألوانك لتظهر هنا.
              </p>
            ) : (
              <ul
                aria-label="الثيمات المخصصة المحفوظة"
                className="theme-saved-list"
              >
                {savedThemes.map((savedTheme) => (
                  <li className="theme-saved-card" key={savedTheme.id}>
                    <span aria-hidden="true" className="theme-saved-swatches">
                      {COLOR_FIELDS.map(({ key, label }) => (
                        <input
                          className="theme-swatch"
                          disabled
                          key={key}
                          tabIndex={-1}
                          type="color"
                          value={savedTheme.tokens[key]}
                        />
                      ))}
                    </span>
                    <span className="theme-saved-name">{savedTheme.name}</span>
                    <button
                      className="theme-saved-apply"
                      onClick={() => applySavedTheme(savedTheme)}
                      type="button"
                    >
                      تطبيق
                    </button>
                    <button
                      aria-label={`حذف الثيم ${savedTheme.name}`}
                      className="theme-studio-icon-button theme-delete-button"
                      onClick={() => deleteTheme(savedTheme)}
                      type="button"
                    >
                      <Trash2 aria-hidden="true" size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </dialog>
    </>
  );
}
