"use client";
import {useEffect,useSyncExternalStore} from "react";
import {useRouter} from "next/navigation";
const subscribe=(listener:()=>void)=>{window.addEventListener("storage",listener);return ()=>window.removeEventListener("storage",listener);};
const snapshot=()=>localStorage.getItem("finora_token")||"";
const serverSnapshot=()=>null;
export function AuthGuard({children}:{children:React.ReactNode}){
 const router=useRouter(),token=useSyncExternalStore(subscribe,snapshot,serverSnapshot);
 useEffect(()=>{if(token==="")router.replace("/login");},[token,router]);
 return token?children:<div className="grid min-h-screen place-items-center text-muted">Opening your finances…</div>;
}
