import { useState, useEffect } from "react";

const THEME_KEY = "director_studio_theme";
const themes = [
  { id: "light", icon: "☀", label: "浅色" },
  { id: "dark",  icon: "☾", label: "深色" },
  { id: "auto",  icon: "◐", label: "自动" },
];

function getSystemTheme() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(stored) {
  if (stored === "auto" || !stored) return getSystemTheme();
  return stored;
}

export function getEffectiveTheme() {
  return resolveTheme(localStorage.getItem(THEME_KEY));
}

export default function ThemeSwitcher() {
  const [mode, setMode] = useState(() => localStorage.getItem(THEME_KEY) || "auto");

  useEffect(() => {
    localStorage.setItem(THEME_KEY, mode);
    const effective = resolveTheme(mode);
    document.documentElement.setAttribute("data-theme", effective);
  }, [mode]);

  // Listen for system theme changes when in auto mode
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      if (mode === "auto") {
        document.documentElement.setAttribute("data-theme", getSystemTheme());
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);

  return (
    <div className="flex items-center gap-0.5" role="radiogroup" aria-label="主题切换">
      {themes.map((t) => (
        <button
          key={t.id}
          onClick={() => setMode(t.id)}
          className={`theme-btn ${mode === t.id ? "active" : ""}`}
          title={t.label}
          aria-label={t.label}
          role="radio"
          aria-checked={mode === t.id}
        >
          {t.icon}
        </button>
      ))}
    </div>
  );
}
