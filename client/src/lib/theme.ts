import { useState, useEffect } from "react";

type Theme = "dark" | "light";

function getStoredTheme(): Theme {
  try {
    const saved = localStorage.getItem("sg-theme");
    if (saved === "light" || saved === "dark") return saved;
    if (window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
  } catch {}
  return "dark";
}

export function applyTheme(theme: Theme) {
  if (theme === "light") {
    document.documentElement.classList.add("light-mode");
  } else {
    document.documentElement.classList.remove("light-mode");
  }
  try { localStorage.setItem("sg-theme", theme); } catch {}
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function toggle() {
    setTheme(t => (t === "dark" ? "light" : "dark"));
  }

  return { theme, toggle, isLight: theme === "light" };
}
