"use client";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { LogOut, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function Topbar({ userEmail, orgName }: { userEmail: string; orgName: string }) {
  const { theme, setTheme } = useTheme();
  return (
    <header className="sticky top-0 z-30 h-14 border-b bg-background/80 backdrop-blur flex items-center gap-4 px-6">
      <div className="flex-1">
        <div className="text-xs text-muted-foreground">Workspace</div>
        <div className="text-sm font-medium">{orgName}</div>
      </div>
      <div className="text-sm text-muted-foreground">{userEmail}</div>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        aria-label="Toggle theme"
      >
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
      <Button variant="ghost" size="icon" onClick={() => signOut({ callbackUrl: "/login" })}>
        <LogOut className="h-4 w-4" />
      </Button>
    </header>
  );
}
