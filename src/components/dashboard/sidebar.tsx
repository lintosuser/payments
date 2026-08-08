"use client";

import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Link2,
  CreditCard,
  FileText,
  Receipt,
  Settings,
  LogOut,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export type NavKey =
  | "overview"
  | "clients"
  | "payments"
  | "charge"
  | "subscriptions"
  | "invoices"
  | "transactions"
  | "settings"
  | "audit";

const NAV: { key: NavKey; label: string; sub: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "overview", label: "סקירה", sub: "מבט-על וקיצורי דרך", Icon: LayoutDashboard },
  { key: "clients", label: "לקוחות", sub: "ניהול לקוחות וטוקנים", Icon: Users },
  { key: "payments", label: "קישור תשלום", sub: "יצירת דף תשלום", Icon: Link2 },
  { key: "charge", label: "חיוב טוקן", sub: "Soft charge קיים", Icon: CreditCard },
  { key: "subscriptions", label: "הוראות קבע", sub: "חיוב חוזר אוטומטי", Icon: Receipt },
  { key: "invoices", label: "חשבוניות", sub: "הפקה ושליפה", Icon: FileText },
  { key: "transactions", label: "עסקאות", sub: "היסטוריה ופעולות", Icon: Receipt },
  { key: "settings", label: "הגדרות", sub: "DB · ספק תשלום · CSV", Icon: Settings },
  { key: "audit", label: "יומן אירועים", sub: "ISO 27001 A.12.4", Icon: ShieldCheck },
];

function SidebarContent({
  active,
  onChange,
  connected,
  email,
  onNavigate,
}: {
  active: NavKey;
  onChange: (k: NavKey) => void;
  connected: boolean;
  email?: string;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const signOut = async () => {
    await fetch("/api/auth/signout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  };
  return (
    <>
      <div className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-primary text-primary-foreground grid place-items-center font-bold">
            L
          </div>
          <div className="leading-tight">
            <div className="text-base font-semibold tracking-tight">Lintos</div>
            <div className="text-xs text-muted-foreground">ניהול תשלומים</div>
          </div>
        </div>
      </div>

      <nav className="px-3 py-2 flex-1 overflow-y-auto">
        <ul className="space-y-1">
          {NAV.map(({ key, label, sub, Icon }) => {
            const isActive = key === active;
            return (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => { onChange(key); onNavigate?.(); }}
                  className={cn(
                    "w-full text-right rounded-lg px-3 py-2.5 flex items-start gap-3 transition-colors",
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80"
                  )}
                >
                  <Icon className={cn("size-5 mt-0.5", isActive ? "text-primary" : "text-muted-foreground")} />
                  <span className="flex-1">
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="block text-[11px] text-muted-foreground">{sub}</span>
                  </span>
                  {isActive && <span className="mt-1.5 size-1.5 rounded-full bg-primary" />}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="px-4 py-3 border-t border-sidebar-border space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <span className={cn("size-2 rounded-full", connected ? "bg-emerald-500" : "bg-amber-500")} />
          <span className="text-muted-foreground">
            {connected ? "ספק תשלום מחובר" : "ספק תשלום לא מוגדר"}
          </span>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
        >
          <LogOut className="size-3.5" />
          <span className="flex-1 text-right truncate" dir="ltr">{email || "התנתק"}</span>
        </button>
      </div>
    </>
  );
}

export function Sidebar({
  active,
  onChange,
  connected,
  email,
}: {
  active: NavKey;
  onChange: (k: NavKey) => void;
  connected: boolean;
  email?: string;
}) {
  return (
    <aside className="hidden md:flex w-72 shrink-0 border-l border-border bg-sidebar text-sidebar-foreground flex-col">
      <SidebarContent active={active} onChange={onChange} connected={connected} email={email} />
    </aside>
  );
}

export function MobileSidebar({
  open,
  onClose,
  active,
  onChange,
  connected,
  email,
}: {
  open: boolean;
  onClose: () => void;
  active: NavKey;
  onChange: (k: NavKey) => void;
  connected: boolean;
  email?: string;
}) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-72 p-0 bg-sidebar text-sidebar-foreground flex flex-col">
        <SidebarContent
          active={active}
          onChange={onChange}
          connected={connected}
          email={email}
          onNavigate={onClose}
        />
      </SheetContent>
    </Sheet>
  );
}
