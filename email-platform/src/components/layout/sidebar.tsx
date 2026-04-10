"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  List as ListIcon,
  Filter,
  FileText,
  Send,
  ShieldCheck,
  Ban,
  Settings,
  Mailbox,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/lists", label: "Lists", icon: ListIcon },
  { href: "/segments", label: "Segments", icon: Filter },
  { href: "/templates", label: "Templates", icon: FileText },
  { href: "/campaigns", label: "Campaigns", icon: Send },
  { href: "/senders", label: "Senders", icon: Mailbox },
  { href: "/suppression", label: "Suppression", icon: Ban },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex w-60 flex-col border-r bg-card h-screen sticky top-0">
      <div className="h-14 flex items-center gap-2 px-5 border-b">
        <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground grid place-items-center font-bold">
          B
        </div>
        <span className="font-semibold tracking-tight">BulkMail</span>
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {nav.map((item) => {
          const active = pathname?.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t text-xs text-muted-foreground flex items-center gap-2">
        <ShieldCheck className="h-3 w-3 text-success" />
        Compliance-ready
      </div>
    </aside>
  );
}
