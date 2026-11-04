import React from "react";
import type { ThemeManager } from "../../themeManager";

type ThemeStudioProps = {
  manager?: ThemeManager;
  onThemeStateChange?: (isDark: boolean) => void;
};

export function ThemeStudio(
  _props: ThemeStudioProps,
): React.JSX.Element | null {
  return null;
}

export default ThemeStudio;
