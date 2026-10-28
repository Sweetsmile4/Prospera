"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, ArrowLeftRight, WalletCards, Target, ChartNoAxesCombined, PiggyBank, LogOut, Menu, Settings, Repeat2, Landmark, LineChart, Bell, Calendar, Lightbulb, FlaskConical, CreditCard, Flame, PieChart, Search, Compass, ChevronsLeft, ChevronsRight, ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { User } from "@/lib/types";
import { AuthGuard } from "./auth-guard";
import { Drawer, cx } from "./ui";

type NavItem = readonly [string, string, LucideIcon];
const groups: readonly [string, readonly NavItem[]][] = [
  ["Overview", [["Dashboard", "/dashboard", LayoutDashboard]]],
  ["Money", [["Transactions", "/transactions", ArrowLeftRight], ["Accounts", "/accounts", WalletCards], ["Bills & Recurring", "/recurring", Repeat2], ["Calendar", "/calendar", Calendar]]],
  ["Planning", [["Planning", "/planning", Compass], ["Budgets", "/budgets", PiggyBank], ["Goals", "/goals", Target], ["Sinking Funds", "/sinking-funds", WalletCards], ["Liabilities", "/liabilities", Landmark], ["Debt Planner", "/planning/debt", CreditCard], ["Scenario Simulator", "/planning/scenarios", FlaskConical]]],
  ["Wealth", [["Investments", "/investments", LineChart], ["Net Worth", "/net-worth", ChartNoAxesCombined], ["FIRE Planner", "/planning/fire", Flame]]],
  ["Insights", [["Insights", "/insights", Lightbulb], ["Reports", "/reports", ChartNoAxesCombined], ["Monthly Review", "/monthly-review", PieChart]]],
  ["System", [["Search", "/search", Search], ["Notifications", "/notifications", Bell], ["Settings", "/settings", Settings]]],
];

function isActive(pathname: string, href: string) {
  if (href === "/settings") return pathname.startsWith("/settings");
  return pathname === href;
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(), router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [rail, setRail] = useState(() => typeof window !== "undefined" && localStorage.getItem("finora-rail") === "1");
  const logout = () => { localStorage.removeItem("finora_token"); router.push("/login"); };
  const toggleRail = () => setRail(r => { localStorage.setItem("finora-rail", r ? "0" : "1"); return !r });
  const { data: user } = useQuery({ queryKey: ["me"], queryFn: () => api<User>("/auth/me") });
  useEffect(() => {
    const openSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        router.push("/search");
      }
    };
    window.addEventListener("keydown", openSearch);
    return () => window.removeEventListener("keydown", openSearch);
  }, [router]);

  const navLink = (item: NavItem, collapsed: boolean) => {
    const [, href, Icon] = item;
    const active = isActive(pathname, href);
    return <Link key={href} href={href} onClick={() => setMobileOpen(false)} title={item[0]} aria-current={active ? "page" : undefined}
      className={cx("group relative flex items-center gap-3 text-[13.5px] font-medium transition-colors", collapsed ? "justify-center rounded-lg px-2 py-2.5" : "rounded-lg px-3 py-2", active ? "bg-brandSoft text-brandStrong" : "text-muted hover:bg-panel hover:text-text")}>
      <Icon size={18} strokeWidth={active ? 2.2 : 1.8} />
      {!collapsed && <span>{item[0]}</span>}
    </Link>;
  };

  const sidebar = (collapsed: boolean, extra?: React.ReactNode) => <div className="flex h-full flex-col">
    <div className={cx("flex h-14 items-center border-b border-edge px-4", collapsed && "justify-center px-0")}>
      {collapsed ? <span className="text-xl font-bold tracking-tight text-brand">P<span className="text-ink">.</span></span> : <span className="text-xl font-bold tracking-tight">Prospera<span className="text-brand">.</span></span>}
    </div>
    <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {groups.map(([group, items]) => <div key={group}>
        {!collapsed && <p className="mb-1 px-3 pt-2 text-[10.5px] font-bold uppercase tracking-[0.12em] text-muted">{group}</p>}
        <div className="space-y-0.5">{items.map(i => navLink(i, collapsed))}</div>
      </div>)}
    </nav>
    <div className="border-t border-edge p-3">{extra}</div>
    <button onClick={logout} className={cx("flex items-center gap-3 border-t border-edge px-4 py-3 text-[13.5px] font-medium text-muted transition-colors hover:bg-dangerSoft hover:text-danger", collapsed && "justify-center px-2")} title="Logout">
      <LogOut size={17} />{!collapsed && "Log out"}
    </button>
  </div>;

  return <AuthGuard><div className="min-h-screen bg-surface">
    <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white">Skip to content</a>
    <aside className={cx("fixed inset-y-0 left-0 z-30 hidden overflow-hidden border-r border-edge bg-surface transition-[width] duration-200 lg:block", rail ? "w-16" : "w-60")}>
      {sidebar(rail)}
    </aside>
    <header className={cx("sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-edge bg-white/95 px-4 backdrop-blur lg:px-6 transition-[margin] duration-200", rail ? "lg:ml-16" : "lg:ml-60")}>
      <button className="btn-icon lg:hidden" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu size={19} /></button>
      <button className="btn-icon hidden lg:inline-flex" aria-label="Toggle sidebar" onClick={toggleRail}>{rail ? <ChevronsRight size={17} /> : <ChevronsLeft size={17} />}</button>
      <span className="text-lg font-bold tracking-tight lg:hidden">Prospera<span className="text-brand">.</span></span>
      <Link href="/search" className="hidden h-10 w-full max-w-xl items-center gap-2 rounded-lg border border-transparent bg-panel px-3 text-sm text-muted transition-colors hover:border-edge-strong md:flex">
        <Search size={16} /><span className="truncate">Search transactions, accounts, goals...</span><kbd className="ml-auto rounded border border-edge-strong bg-white px-1.5 py-0.5 text-[11px]">Ctrl/⌘ K</kbd>
      </Link>
      <div className="ml-auto flex items-center gap-1.5">
        <Link href="/dashboard" className="hidden h-9 items-center gap-2 rounded-lg border border-edge bg-white px-3 text-[13px] font-medium text-text2 sm:flex">{new Date().toLocaleDateString("en-IN", { month: "long", year: "numeric" })}<ChevronDown size={14} /></Link>
        <Link href="/notifications" className="btn-icon" aria-label="Notifications"><Bell size={18} /></Link>
        <button className="ml-1 flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-panel" onClick={() => router.push("/settings")}>
          <span className="grid size-7 place-items-center rounded-full bg-brand text-[12px] font-bold text-white">{(user?.name?.[0] || "U").toUpperCase()}</span>
          <span className="hidden text-[13.5px] font-semibold max-lg:hidden lg:inline">{user?.name?.split(" ")[0]}</span>
        </button>
      </div>
    </header>
    <Drawer open={mobileOpen} onClose={() => setMobileOpen(false)} side="left" flush noHeader>
      {sidebar(false)}
    </Drawer>
    <main id="main" className={cx("min-h-screen min-w-0 pb-12 transition-[padding] duration-200 max-lg:pl-0", rail ? "lg:pl-16" : "lg:pl-60")}>{children}</main>
  </div></AuthGuard>;
}
