const BASE=process.env.NEXT_PUBLIC_API_URL||"http://localhost:5000/api";
export class ApiError extends Error{constructor(message:string,public status:number){super(message)}}
export async function api<T>(path:string,init:RequestInit={}){const token=typeof window!=="undefined"?localStorage.getItem("finora_token"):null;const res=await fetch(`${BASE}${path}`,{...init,headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{}) ,...init.headers}});const body=await res.json().catch(()=>({}));if(!res.ok)throw new ApiError(body.message||"Request failed",res.status);return body.data as T}
export const money=(n:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(n);
