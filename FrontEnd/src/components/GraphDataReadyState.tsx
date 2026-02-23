'use client';

import {
  LineSquiggle,
  RouteOff,
  FolderSearch,
  MousePointerClick,
  Search,
  ListFilter,
  ArrowLeft,
  Workflow,
} from "lucide-react";
import type { SidebarTab } from "@/types/types";

// ============================================================================
// PER-TAB CONFIG
// ============================================================================

interface TabReadyConfig {
  icon: React.ElementType;
  actionIcon: React.ElementType;
  title: string;
  description: string;
  actionHint: string;
  // svg accent color (inline, can't be dynamic Tailwind)
  accentHex: string;
  colorKey: "blue" | "emerald" | "rose" | "violet";
}

const TAB_CONFIGS: Partial<Record<SidebarTab, TabReadyConfig>> = {
  Filter: {
    icon: Workflow,
    actionIcon: MousePointerClick,
    title: "داده‌ها آماده‌اند!",
    description:
      "از پنل سمت راست، گره‌های شروع و پایان را انتخاب کنید تا گراف فرآیندی ترسیم شود.",
    actionHint: "گره‌های مورد نظر را از فیلترها انتخاب کنید",
    accentHex: "#3b82f6",
    colorKey: "blue",
  },
  Routing: {
    icon: LineSquiggle,
    actionIcon: MousePointerClick,
    title: "داده‌ها آماده مسیریابی‌اند",
    description:
      "از پنل سمت راست، گره شروع و پایان را انتخاب کنید تا الگوریتم مسیرهای ممکن را محاسبه و روی گراف نمایش دهد.",
    actionHint: "گره شروع و پایان را از منوی سمت راست انتخاب کنید",
    accentHex: "#10b981",
    colorKey: "emerald",
  },
  Outliers: {
    icon: RouteOff,
    actionIcon: ListFilter,
    title: "داده‌ها آماده تحلیل‌اند",
    description:
      "از لیست مسیرهای کم‌تکرار در پنل سمت راست، یک مسیر را انتخاب کنید تا روی گراف نمایش داده شود.",
    actionHint: "یک مسیر را از لیست مسیرهای کم‌تکرار انتخاب کنید",
    accentHex: "#f43f5e",
    colorKey: "rose",
  },
  SearchCaseIds: {
    icon: FolderSearch,
    actionIcon: Search,
    title: "داده‌ها آماده جستجو هستند",
    description:
      "شماره پرونده مورد نظر خود را در پنل سمت راست جستجو کنید تا مسیر دقیق آن روی گراف ترسیم شود.",
    actionHint: "شماره پرونده را در پنل سمت راست وارد کنید",
    accentHex: "#8b5cf6",
    colorKey: "violet",
  },
};

const COLOR_MAP = {
  blue: {
    blob1: "bg-blue-100/60",
    blob2: "bg-indigo-100/40",
    iconBg: "bg-blue-100",
    iconRing: "ring-blue-200/60",
    iconColor: "text-blue-500",
    title: "text-blue-700",
    hintBg: "bg-blue-50/80",
    hintBorder: "border-blue-200/60",
    hintText: "text-blue-600",
    hintIcon: "text-blue-400",
    dot1: "bg-blue-300",
    dot2: "bg-indigo-300",
    dot3: "bg-sky-300",
    particle1: "bg-blue-300",
    particle2: "bg-indigo-300",
    particle3: "bg-sky-300",
    readyBadge: "bg-blue-500",
  },
  emerald: {
    blob1: "bg-emerald-100/60",
    blob2: "bg-teal-100/40",
    iconBg: "bg-emerald-100",
    iconRing: "ring-emerald-200/60",
    iconColor: "text-emerald-500",
    title: "text-emerald-700",
    hintBg: "bg-emerald-50/80",
    hintBorder: "border-emerald-200/60",
    hintText: "text-emerald-600",
    hintIcon: "text-emerald-400",
    dot1: "bg-emerald-300",
    dot2: "bg-teal-300",
    dot3: "bg-green-300",
    particle1: "bg-emerald-300",
    particle2: "bg-teal-300",
    particle3: "bg-green-300",
    readyBadge: "bg-emerald-500",
  },
  rose: {
    blob1: "bg-rose-100/60",
    blob2: "bg-pink-100/40",
    iconBg: "bg-rose-100",
    iconRing: "ring-rose-200/60",
    iconColor: "text-rose-500",
    title: "text-rose-700",
    hintBg: "bg-rose-50/80",
    hintBorder: "border-rose-200/60",
    hintText: "text-rose-600",
    hintIcon: "text-rose-400",
    dot1: "bg-rose-300",
    dot2: "bg-pink-300",
    dot3: "bg-red-300",
    particle1: "bg-rose-300",
    particle2: "bg-pink-300",
    particle3: "bg-red-300",
    readyBadge: "bg-rose-500",
  },
  violet: {
    blob1: "bg-violet-100/60",
    blob2: "bg-purple-100/40",
    iconBg: "bg-violet-100",
    iconRing: "ring-violet-200/60",
    iconColor: "text-violet-500",
    title: "text-violet-700",
    hintBg: "bg-violet-50/80",
    hintBorder: "border-violet-200/60",
    hintText: "text-violet-600",
    hintIcon: "text-violet-400",
    dot1: "bg-violet-300",
    dot2: "bg-purple-300",
    dot3: "bg-fuchsia-300",
    particle1: "bg-violet-300",
    particle2: "bg-purple-300",
    particle3: "bg-fuchsia-300",
    readyBadge: "bg-violet-500",
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

interface GraphDataReadyStateProps {
  activeTab: SidebarTab;
}

export default function GraphDataReadyState({ activeTab }: GraphDataReadyStateProps) {
  const config = TAB_CONFIGS[activeTab];
  if (!config) return null;

  const { icon: Icon, actionIcon: ActionIcon, title, description, actionHint, accentHex, colorKey } = config;
  const c = COLOR_MAP[colorKey];

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden select-none">

      {/* ── Background blobs ── */}
      <div className={`absolute w-[460px] h-[460px] rounded-full ${c.blob1} blur-3xl -top-36 -right-36 animate-pulse`}
        style={{ animationDuration: "7s" }} />
      <div className={`absolute w-[360px] h-[360px] rounded-full ${c.blob2} blur-3xl -bottom-24 -left-24 animate-pulse`}
        style={{ animationDuration: "9s", animationDelay: "1.5s" }} />

      {/* ── Floating particles ── */}
      <div className={`absolute w-2 h-2 ${c.particle1} rounded-full opacity-30 top-[16%] left-[22%] animate-bounce`}
        style={{ animationDuration: "3.5s" }} />
      <div className={`absolute w-2.5 h-2.5 ${c.particle2} rounded-full opacity-25 top-[30%] right-[18%] animate-bounce`}
        style={{ animationDelay: "0.6s", animationDuration: "4.2s" }} />
      <div className={`absolute w-1.5 h-1.5 ${c.particle3} rounded-full opacity-30 bottom-[24%] left-[26%] animate-bounce`}
        style={{ animationDelay: "1.2s", animationDuration: "5s" }} />
      <div className={`absolute w-2 h-2 ${c.particle1} rounded-full opacity-25 bottom-[38%] right-[22%] animate-bounce`}
        style={{ animationDelay: "0.4s", animationDuration: "3.8s" }} />

      {/* ── Dot grid ── */}
      <div className="absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)", backgroundSize: "32px 32px" }} />

      {/* ── Main card ── */}
      <div className="relative z-10 flex flex-col items-center gap-7 text-center px-10 max-w-md graph-empty-state-card" dir="rtl">

        {/* SVG illustration: mini graph with selection arrow */}
        <svg width="360" height="140" viewBox="0 0 360 140" fill="none" xmlns="http://www.w3.org/2000/svg" className="mx-auto">
          <defs>
            <linearGradient id={`drs-fill-${colorKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f8fafc" />
              <stop offset="100%" stopColor="#f1f5f9" />
            </linearGradient>
            <filter id={`drs-glow-${colorKey}`}>
              <feGaussianBlur stdDeviation="4" result="coloredBlur" />
              <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            <marker id={`drs-arrow-${colorKey}`} markerWidth="7" markerHeight="5" refX="5" refY="2.5" orient="auto">
              <polygon points="0 0, 7 2.5, 0 5" fill={accentHex} opacity="0.7" />
            </marker>
            <marker id="drs-arrow-gray" markerWidth="7" markerHeight="5" refX="5" refY="2.5" orient="auto">
              <polygon points="0 0, 7 2.5, 0 5" fill="#94a3b8" opacity="0.5" />
            </marker>
          </defs>

          {/* Edges */}
          <line x1="58" y1="70" x2="118" y2="40" stroke="#e2e8f0" strokeWidth="2" markerEnd="url(#drs-arrow-gray)" />
          <line x1="58" y1="70" x2="118" y2="100" stroke="#e2e8f0" strokeWidth="2" markerEnd="url(#drs-arrow-gray)" />
          <line x1="198" y1="40" x2="285" y2="70" stroke={accentHex} strokeWidth="2.5" markerEnd={`url(#drs-arrow-${colorKey})`} opacity="0.7" filter={`url(#drs-glow-${colorKey})`}>
            <animate attributeName="opacity" values="0.5;0.9;0.5" dur="2s" repeatCount="indefinite" />
          </line>
          <line x1="198" y1="100" x2="285" y2="70" stroke="#e2e8f0" strokeWidth="2" markerEnd="url(#drs-arrow-gray)" />

          {/* START node */}
          <circle cx="32" cy="70" r="26" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" />
          <text x="32" y="66" textAnchor="middle" fontSize="7" fontWeight="600" fill="#94a3b8" fontFamily="sans-serif">شروع</text>
          <text x="32" y="77" textAnchor="middle" fontSize="7" fontWeight="600" fill="#94a3b8" fontFamily="sans-serif">•••</text>

          {/* Node A — highlighted / selected */}
          <rect x="118" y="18" width="80" height="44" rx="10"
            fill={`${accentHex}18`} stroke={accentHex} strokeWidth="2"
            filter={`url(#drs-glow-${colorKey})`} />
          <text x="158" y="36" textAnchor="middle" fontSize="7.5" fontWeight="700" fill={accentHex} fontFamily="sans-serif">رویداد A</text>
          <rect x="130" y="42" width="44" height="5" rx="2" fill={accentHex} opacity="0.25" />
          {/* spinning ring */}
          <circle cx="158" cy="40" r="30" stroke={accentHex} strokeWidth="1.2" strokeDasharray="4 3" fill="none" opacity="0.3">
            <animateTransform attributeName="transform" type="rotate" from="0 158 40" to="360 158 40" dur="7s" repeatCount="indefinite" />
          </circle>

          {/* Node B — dimmed */}
          <rect x="118" y="78" width="80" height="44" rx="10" fill={`url(#drs-fill-${colorKey})`} stroke="#e2e8f0" strokeWidth="1.5" opacity="0.7" />
          <text x="158" y="96" textAnchor="middle" fontSize="7.5" fontWeight="600" fill="#94a3b8" fontFamily="sans-serif">رویداد B</text>
          <rect x="130" y="102" width="44" height="5" rx="2" fill="#e2e8f0" />

          {/* END node — dashed waiting */}
          <circle cx="316" cy="70" r="26" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" strokeDasharray="5 3">
            <animate attributeName="opacity" values="0.6;1;0.6" dur="2.5s" repeatCount="indefinite" />
          </circle>
          <text x="316" y="66" textAnchor="middle" fontSize="7" fontWeight="600" fill="#94a3b8" fontFamily="sans-serif">پایان</text>
          <text x="316" y="77" textAnchor="middle" fontSize="7" fontWeight="600" fill="#cbd5e1" fontFamily="sans-serif">?</text>

          {/* Arrow from sidebar side */}
          <line x1="340" y1="36" x2="328" y2="62" stroke={accentHex} strokeWidth="2" strokeDasharray="4 3" opacity="0.7">
            <animate attributeName="stroke-dashoffset" from="0" to="-14" dur="1.2s" repeatCount="indefinite" />
          </line>
          <text x="341" y="30" textAnchor="start" fontSize="9" fontWeight="700" fill={accentHex} fontFamily="sans-serif" opacity="0.8">انتخاب</text>
        </svg>

        {/* Text */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-center gap-2">
            <div className={`w-2 h-2 rounded-full ${c.readyBadge} animate-pulse`} />
            <h2 className={`text-2xl font-extrabold ${c.title} leading-snug`}>{title}</h2>
          </div>
          <p className="text-slate-500 text-sm leading-7 font-medium">{description}</p>
        </div>

        {/* Action hint pill */}
        <div className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl border ${c.hintBg} ${c.hintBorder} backdrop-blur-sm shadow-sm graph-empty-state-hint`}>
          <ActionIcon size={15} className={`${c.hintIcon} shrink-0`} />
          <span className={`text-sm font-bold ${c.hintText}`}>{actionHint}</span>
          <ArrowLeft size={13} className={`${c.hintIcon} shrink-0 animate-pulse mr-auto`} />
        </div>

        {/* Decorative dots */}
        <div className="flex items-center gap-2 opacity-50">
          <div className={`w-2 h-2 rounded-full ${c.dot1} animate-pulse`} />
          <div className={`w-3 h-3 rounded-full ${c.dot2} animate-pulse`} style={{ animationDelay: "0.3s" }} />
          <div className={`w-2 h-2 rounded-full ${c.dot3} animate-pulse`} style={{ animationDelay: "0.6s" }} />
        </div>
      </div>
    </div>
  );
}
