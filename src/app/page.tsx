"use client";

import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar, MobileSidebar, type NavKey } from "@/components/dashboard/sidebar";
import { OverviewTab } from "@/components/dashboard/overview-tab";
import { ClientsTab } from "@/components/dashboard/clients-tab";
import { PaymentsTab } from "@/components/dashboard/payments-tab";
import { ChargeTab } from "@/components/dashboard/charge-tab";
import { SubscriptionsTab } from "@/components/dashboard/subscriptions-tab";
import { InvoicesTab } from "@/components/dashboard/invoices-tab";
import { TransactionsTab } from "@/components/dashboard/transactions-tab";
import { SettingsTab } from "@/components/dashboard/settings-tab";
import { AuditLogTab } from "@/components/dashboard/audit-log-tab";

const NAV_LABEL: Record<NavKey, string> = {
  overview: "סקירה", clients: "לקוחות", payments: "קישור תשלום",
  charge: "חיוב טוקן", subscriptions: "הוראות קבע",
  invoices: "חשבוניות", transactions: "עסקאות", settings: "הגדרות",
  audit: "יומן אירועים",
};

export default function Dashboard() {
  const [tab, setTab] = useState<NavKey>("overview");
  const [providerOk, setProviderOk] = useState(false);
  const [email, setEmail] = useState<string | undefined>();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((s) => setProviderOk(!!s?.payments?.configured)).catch(() => {});
    fetch("/api/auth/me").then((r) => r.json()).then((j) => setEmail(j?.user?.email)).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen flex">
      <Sidebar active={tab} onChange={setTab} connected={providerOk} email={email} />
      <MobileSidebar
        open={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
        active={tab}
        onChange={setTab}
        connected={providerOk}
        email={email}
      />

      <main className="flex-1 min-w-0">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-sidebar sticky top-0 z-10">
          <button
            type="button"
            onClick={() => setMobileSidebarOpen(true)}
            className="p-1.5 rounded-md hover:bg-sidebar-accent transition-colors"
            aria-label="פתח תפריט"
          >
            <Menu className="size-5 text-sidebar-foreground" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <div className="size-7 rounded-lg bg-primary text-primary-foreground grid place-items-center font-bold text-sm">L</div>
            <span className="font-semibold text-sm text-sidebar-foreground">Lintos</span>
          </div>
          <span className="text-sm text-muted-foreground">{NAV_LABEL[tab]}</span>
        </div>

        <div className="mx-auto max-w-6xl px-4 md:px-6 lg:px-10 py-5 md:py-8">
          {tab === "overview" && <OverviewTab onNavigate={setTab} />}
          {tab === "clients" && <ClientsTab />}
          {tab === "payments" && <PaymentsTab />}
          {tab === "charge" && <ChargeTab />}
          {tab === "subscriptions" && <SubscriptionsTab />}
          {tab === "invoices" && <InvoicesTab />}
          {tab === "transactions" && <TransactionsTab />}
          {tab === "settings" && <SettingsTab />}
          {tab === "audit" && <AuditLogTab />}
        </div>
      </main>
    </div>
  );
}
