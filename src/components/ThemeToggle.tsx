import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

function apply(theme: "light" | "dark") {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  window.localStorage.setItem("dt.theme", theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const stored = window.localStorage.getItem("dt.theme");
    const initial: "light" | "dark" = stored === "light" || stored === "dark" ? stored : "dark";
    setTheme(initial);
    apply(initial);
  }, []);

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle color theme"
      onClick={() => {
        const next = theme === "dark" ? "light" : "dark";
        setTheme(next);
        apply(next);
      }}
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
