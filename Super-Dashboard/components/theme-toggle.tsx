"use client"

import { MoonStar, SunMedium } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === "dark"

  return (
    <Button
      aria-label="Toggle theme"
      className="border border-border bg-background/70 backdrop-blur"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      size="icon-sm"
      variant="outline"
    >
      {isDark ? <SunMedium className="size-4" /> : <MoonStar className="size-4" />}
    </Button>
  )
}
