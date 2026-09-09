"use client";
import Link from "next/link";
import { usePathname,useRouter } from "next/navigation";
import { LayoutDashboard,ArrowLeftRight,WalletCards,Target,ChartNoAxesCombined,PiggyBank,LogOut,Menu,X,Settings,Repeat2,Landmark,LineChart,Bell } from "lucide-react";
import { useState } from "react";
import { AuthGuard } from "./auth-guard";

const nav=[["Dashboard","/dashboard",LayoutDashboard],["Transactions","/transactions",ArrowLeftRight],["Accounts","/accounts",WalletCards],["Budgets","/budgets",PiggyBank],["Goals","/goals",Target],["Investments","/investments",LineChart],["Liabilities","/liabilities",Landmark],["Bills & Recurring","/recurring",Repeat2],["Net Worth","/net-worth",ChartNoAxesCombined],["Reports","/reports",ChartNoAxesCombined],["Notifications","/notifications",Bell],["Settings","/settings",Settings]] as const;

export function Shell({children}:{children:React.ReactNode}){
  const pathname=usePathname(),router=useRouter(),[mobileOpen,setMobileOpen]=useState(false);
  const logout=()=>{localStorage.removeItem("finora_token");router.push("/login")};
  const navigation=<><div className="h-20 px-6 pt-7 text-2xl font-bold tracking-tight">Finora<span className="text-brand">.</span></div><nav className="space-y-1 px-3">{nav.map(([name,href,Icon])=><Link onClick={()=>setMobileOpen(false)} key={href} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${pathname===href?"bg-mint text-brand":"text-muted hover:bg-surface hover:text-ink"}`}><Icon size={18}/>{name}</Link>)}</nav><button onClick={logout} className="absolute bottom-6 left-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted hover:bg-red-50 hover:text-red-600"><LogOut size={18}/>Logout</button></>;
  return <AuthGuard><div className="min-h-screen bg-surface"><aside className="fixed inset-y-0 left-0 z-30 w-60 border-r border-line bg-white max-lg:hidden">{navigation}</aside><header className="hidden h-16 items-center border-b border-line bg-white px-5 max-lg:flex"><button aria-label="Open navigation" onClick={()=>setMobileOpen(true)}><Menu/></button><span className="ml-4 text-xl font-bold">Finora<span className="text-brand">.</span></span></header>{mobileOpen&&<div className="fixed inset-0 z-40 hidden bg-black/35 max-lg:block" onMouseDown={()=>setMobileOpen(false)}><aside onMouseDown={event=>event.stopPropagation()} className="relative h-full w-64 bg-white shadow-2xl">{navigation}<button aria-label="Close navigation" className="absolute right-4 top-7" onClick={()=>setMobileOpen(false)}><X size={20}/></button></aside></div>}<main className="min-h-screen min-w-0 pl-60 max-lg:pl-0">{children}</main></div></AuthGuard>;
}
