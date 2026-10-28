"use client";
import { useId } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, BarChart, Bar, Legend } from "recharts";
import { money } from "@/lib/api";

const palette = ["#176B4D", "#D99B43", "#5B7DB1", "#B85C5C", "#8C6BB1", "#4A9A89"];
const axis = { stroke: "#CBD3CE", strokeWidth: 1, fontSize: 11, tick: { fill: "#68726C" } };

function ChartTip({ active, payload, label }: { active?: boolean; payload?: { name?: string; value?: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-lg border border-edge bg-surface px-3 py-2 shadow-md">
    {label && <p className="mb-1 text-xs font-semibold text-muted">{label}</p>}
    <div className="space-y-0.5">{payload.map((p, i) => {
      const color = p.name === "income" ? "#176B4D" : p.name === "expense" ? "#D99B43" : palette[i % palette.length];
      return <p key={i} className="flex items-center gap-2 text-[13px]"><span className="inline-block size-2 rounded-full" style={{ background: color }} />{p.name}: <b className="tnum">{money(Number(p.value) || 0)}</b></p>;
    })}</div>
  </div>;
}

export function AllocationChart({ data }: { data: { name: string; value: number }[] }) {
  return <div role="img" aria-label="Portfolio allocation chart"><ResponsiveContainer width="100%" height={240}>
    <PieChart>
      <Pie data={data} dataKey="value" nameKey="name" innerRadius={62} outerRadius={90} paddingAngle={3}>
        {data.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
      </Pie>
      <Tooltip content={<ChartTip />} />
      <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
    </PieChart>
  </ResponsiveContainer></div>;
}

export function TrendChart({ data }: { data: { name: string; income?: number; expense?: number; value?: number }[] }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return <div role="img" aria-label="Financial trend chart"><ResponsiveContainer width="100%" height={280}>
    <AreaChart data={data}>
      <defs><linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#176B4D" stopOpacity={0.22} /><stop offset="1" stopColor="#176B4D" stopOpacity={0} /></linearGradient></defs>
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF2EF" />
      <XAxis dataKey="name" axisLine={false} tickLine={false} {...axis} />
      <YAxis axisLine={false} tickLine={false} {...axis} tickFormatter={v => `₹${Math.round(v / 1000)}k`} width={52} />
      <Tooltip content={<ChartTip />} />
      <Area type="monotone" dataKey="value" stroke="#176B4D" fill={`url(#g${id})`} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, fill: "#fff" }} />
      <Bar dataKey="income" fill="#176B4D" radius={[3, 3, 0, 0]} maxBarSize={30} />
      <Bar dataKey="expense" fill="#D99B43" radius={[3, 3, 0, 0]} maxBarSize={30} />
    </AreaChart>
  </ResponsiveContainer></div>;
}

export function Bars({ data }: { data: { name: string; income: number; expense: number }[] }) {
  return <div role="img" aria-label="Income and expense comparison chart"><ResponsiveContainer width="100%" height={300}>
    <BarChart data={data} barGap={4}>
      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF2EF" />
      <XAxis dataKey="name" axisLine={false} tickLine={false} {...axis} />
      <YAxis axisLine={false} tickLine={false} {...axis} tickFormatter={v => `₹${Math.round(v / 1000)}k`} width={52} />
      <Tooltip content={<ChartTip />} />
      <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
      <Bar dataKey="income" fill="#176B4D" radius={[4, 4, 0, 0]} maxBarSize={28} />
      <Bar dataKey="expense" fill="#D99B43" radius={[4, 4, 0, 0]} maxBarSize={28} />
    </BarChart>
  </ResponsiveContainer></div>;
}
