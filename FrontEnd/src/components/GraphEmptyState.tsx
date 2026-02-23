'use client';

import { useMemo } from "react";
import {
  Monitor,
  LineSquiggle,
  RouteOff,
  FolderSearch,
  SlidersHorizontal,
  GitFork,
  Calendar,
  ArrowUp,
} from "lucide-react";
import type { SidebarTab } from "@/types/types";

// ============================================================================
// TYPE & CONFIG
// ============================================================================

interface TabEmptyConfig {
  icon: React.ElementType;
  title: string;
  description: string;
  hint: string;
  colorKey: "blue" | "emerald" | "rose" | "violet" | "slate" | "amber";
}

const TAB_CONFIGS: Partial<Record<SidebarTab, TabEmptyConfig>> = {
  Filter: {
    icon: Monitor,
    title: "برای شروع، بازه زمانی را انتخاب کنید",
    description:
      "با تعیین فیلتر تاریخ از نوار بالا، فرآیندها تحلیل شده و گراف فرآیندی ترسیم می‌شود.",
    hint: "فیلتر تاریخ را از نوار بالای صفحه اعمال کنید",
    colorKey: "blue",
  },
  Routing: {
    icon: LineSquiggle,
    title: "آماده مسیریابی",
    description:
      "پس از بارگذاری داده‌ها با اعمال فیلتر زمانی، می‌توانید مسیرهای بین گره‌ها را جستجو و تحلیل کنید.",
    hint: "ابتدا فیلتر تاریخ را از نوار بالا اعمال کنید",
    colorKey: "emerald",
  },
  Outliers: {
    icon: RouteOff,
    title: "آماده تحلیل مسیرهای کم‌تکرار",
    description:
      "ابتدا فیلتر زمانی را اعمال کنید. سپس مسیرهای نادر و کم‌تکرار فرآیند برای شما شناسایی و نمایش داده می‌شوند.",
    hint: "فیلتر تاریخ را از نوار بالای صفحه اعمال کنید",
    colorKey: "rose",
  },
  SearchCaseIds: {
    icon: FolderSearch,
    title: "جستجوی پرونده",
    description:
      "با اعمال فیلتر زمانی از نوار بالا، می‌توانید مسیر دقیق هر پرونده را بر روی گراف مشاهده و تحلیل کنید.",
    hint: "ابتدا فیلتر تاریخ را از نوار بالا اعمال کنید",
    colorKey: "violet",
  },
  Settings: {
    icon: SlidersHorizontal,
    title: "تنظیمات نمودار",
    description:
      "از پنل سمت راست می‌توانید رنگ‌بندی و ظاهر گراف را شخصی‌سازی کنید. پس از بارگذاری داده‌ها، پیش‌نمایش تغییرات را اینجا خواهید دید.",
    hint: "ابتدا فیلتر تاریخ را از نوار بالا اعمال کنید",
    colorKey: "slate",
  },
  RouteBuilder: {
    icon: GitFork,
    title: "جریان‌ساز هوشمند",
    description:
      "پس از اعمال فیلتر زمانی، می‌توانید گام‌به‌گام مسیرهای فرآیند را بسازید و الگوریتم مسیرهای بعدی را پیشنهاد می‌دهد.",
    hint: "ابتدا فیلتر تاریخ را از نوار بالا اعمال کنید",
    colorKey: "amber",
  },
};

// Full Tailwind class strings — must not be dynamically interpolated
const COLOR_MAP = {
  blue: {
    blob1: "bg-blue-200/40",
    blob2: "bg-indigo-200/30",
    blob3: "bg-sky-200/30",
    iconBg: "bg-blue-100",
    iconRing: "ring-blue-200/60",
    iconColor: "text-blue-500",
    title: "text-blue-700",
    hintBg: "bg-blue-50/80",
    hintBorder: "border-blue-200/60",
    hintText: "text-blue-600",
    hintIcon: "text-blue-400",
    particle1: "bg-blue-400",
    particle2: "bg-indigo-400",
    particle3: "bg-sky-400",
    particle4: "bg-blue-300",
    calIcon: "text-blue-400",
    dot1: "bg-blue-300",
    dot2: "bg-indigo-300",
    dot3: "bg-sky-300",
  },
  emerald: {
    blob1: "bg-emerald-200/40",
    blob2: "bg-teal-200/30",
    blob3: "bg-green-200/30",
    iconBg: "bg-emerald-100",
    iconRing: "ring-emerald-200/60",
    iconColor: "text-emerald-500",
    title: "text-emerald-700",
    hintBg: "bg-emerald-50/80",
    hintBorder: "border-emerald-200/60",
    hintText: "text-emerald-600",
    hintIcon: "text-emerald-400",
    particle1: "bg-emerald-400",
    particle2: "bg-teal-400",
    particle3: "bg-green-400",
    particle4: "bg-emerald-300",
    calIcon: "text-emerald-400",
    dot1: "bg-emerald-300",
    dot2: "bg-teal-300",
    dot3: "bg-green-300",
  },
  rose: {
    blob1: "bg-rose-200/40",
    blob2: "bg-pink-200/30",
    blob3: "bg-red-200/30",
    iconBg: "bg-rose-100",
    iconRing: "ring-rose-200/60",
    iconColor: "text-rose-500",
    title: "text-rose-700",
    hintBg: "bg-rose-50/80",
    hintBorder: "border-rose-200/60",
    hintText: "text-rose-600",
    hintIcon: "text-rose-400",
    particle1: "bg-rose-400",
    particle2: "bg-pink-400",
    particle3: "bg-red-400",
    particle4: "bg-rose-300",
    calIcon: "text-rose-400",
    dot1: "bg-rose-300",
    dot2: "bg-pink-300",
    dot3: "bg-red-300",
  },
  violet: {
    blob1: "bg-violet-200/40",
    blob2: "bg-purple-200/30",
    blob3: "bg-fuchsia-200/30",
    iconBg: "bg-violet-100",
    iconRing: "ring-violet-200/60",
    iconColor: "text-violet-500",
    title: "text-violet-700",
    hintBg: "bg-violet-50/80",
    hintBorder: "border-violet-200/60",
    hintText: "text-violet-600",
    hintIcon: "text-violet-400",
    particle1: "bg-violet-400",
    particle2: "bg-purple-400",
    particle3: "bg-fuchsia-400",
    particle4: "bg-violet-300",
    calIcon: "text-violet-400",
    dot1: "bg-violet-300",
    dot2: "bg-purple-300",
    dot3: "bg-fuchsia-300",
  },
  slate: {
    blob1: "bg-slate-200/40",
    blob2: "bg-zinc-200/30",
    blob3: "bg-gray-200/30",
    iconBg: "bg-slate-100",
    iconRing: "ring-slate-200/60",
    iconColor: "text-slate-500",
    title: "text-slate-700",
    hintBg: "bg-slate-50/80",
    hintBorder: "border-slate-200/60",
    hintText: "text-slate-600",
    hintIcon: "text-slate-400",
    particle1: "bg-slate-400",
    particle2: "bg-zinc-400",
    particle3: "bg-gray-400",
    particle4: "bg-slate-300",
    calIcon: "text-slate-400",
    dot1: "bg-slate-300",
    dot2: "bg-zinc-300",
    dot3: "bg-gray-300",
  },
  amber: {
    blob1: "bg-amber-200/40",
    blob2: "bg-orange-200/30",
    blob3: "bg-yellow-200/30",
    iconBg: "bg-amber-100",
    iconRing: "ring-amber-200/60",
    iconColor: "text-amber-500",
    title: "text-amber-700",
    hintBg: "bg-amber-50/80",
    hintBorder: "border-amber-200/60",
    hintText: "text-amber-600",
    hintIcon: "text-amber-400",
    particle1: "bg-amber-400",
    particle2: "bg-orange-400",
    particle3: "bg-yellow-400",
    particle4: "bg-amber-300",
    calIcon: "text-amber-400",
    dot1: "bg-amber-300",
    dot2: "bg-orange-300",
    dot3: "bg-yellow-300",
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

interface GraphEmptyStateProps {
  activeTab: SidebarTab;
}

export default function GraphEmptyState({ activeTab }: GraphEmptyStateProps) {
  const config = useMemo(() => TAB_CONFIGS[activeTab], [activeTab]);

  if (!config) return null;

  const { icon: Icon, title, description, hint, colorKey } = config;
  const c = COLOR_MAP[colorKey];

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden select-none">

      {/* ── Animated background blobs ── */}
      <div
        className={`absolute w-[500px] h-[500px] rounded-full ${c.blob1} blur-3xl -top-32 -right-32 animate-pulse`}
      />
      <div
        className={`absolute w-[400px] h-[400px] rounded-full ${c.blob2} blur-3xl -bottom-24 -left-24 animate-pulse`}
        style={{ animationDelay: "1s", animationDuration: "8s" }}
      />
      <div
        className={`absolute w-[300px] h-[300px] rounded-full ${c.blob3} blur-3xl top-1/3 left-1/2 -translate-x-1/2 animate-pulse`}
        style={{ animationDelay: "2s", animationDuration: "10s" }}
      />

      {/* ── Floating particles ── */}
      <div className={`absolute w-2.5 h-2.5 ${c.particle1} rounded-full opacity-40 top-[15%] left-[18%] animate-bounce`} />
      <div className={`absolute w-2 h-2 ${c.particle2} rounded-full opacity-40 top-[25%] right-[22%] animate-bounce`}
        style={{ animationDelay: "0.5s", animationDuration: "4s" }} />
      <div className={`absolute w-3 h-3 ${c.particle3} rounded-full opacity-30 bottom-[20%] left-[30%] animate-bounce`}
        style={{ animationDelay: "1s", animationDuration: "5s" }} />
      <div className={`absolute w-1.5 h-1.5 ${c.particle4} rounded-full opacity-50 bottom-[35%] right-[15%] animate-bounce`}
        style={{ animationDelay: "1.5s", animationDuration: "3.5s" }} />
      <div className={`absolute w-2 h-2 ${c.particle1} rounded-full opacity-30 top-[60%] left-[12%] animate-bounce`}
        style={{ animationDelay: "0.8s", animationDuration: "4.5s" }} />
      <div className={`absolute w-3 h-3 ${c.particle2} rounded-full opacity-25 top-[10%] right-[40%] animate-bounce`}
        style={{ animationDelay: "2s", animationDuration: "6s" }} />

      {/* ── Decorative dot grid ── */}
      <div
        className="absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: `radial-gradient(circle, currentColor 1px, transparent 1px)`,
          backgroundSize: "32px 32px",
        }}
      />

      {/* ── Main content card ── */}
      <div className="relative z-10 flex flex-col items-center gap-6 text-center px-10 max-w-md graph-empty-state-card">

        {/* Icon section */}
        <div className="relative">
          {/* Outer ring pulse */}
          <div className={`absolute inset-0 ${c.iconBg} rounded-full opacity-40 scale-150 animate-ping`}
            style={{ animationDuration: "3s" }} />

          {/* Icon container */}
          <div
            className={`relative w-24 h-24 ${c.iconBg} rounded-full flex items-center justify-center ring-4 ${c.iconRing} shadow-lg graph-empty-state-icon`}
          >
            <Icon size={44} className={`${c.iconColor} drop-shadow-sm`} />
          </div>

          {/* Calendar icon orbiting */}
          <div className="graph-empty-state-orbit absolute -top-1 -right-1 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-md border border-slate-100">
            <Calendar size={16} className={c.calIcon} />
          </div>
        </div>

        {/* Text content */}
        <div className="flex flex-col gap-3">
          <h2 className={`text-2xl font-extrabold ${c.title} leading-snug`}>
            {title}
          </h2>
          <p className="text-slate-500 text-sm leading-7 font-medium">
            {description}
          </p>
        </div>

        {/* Action hint pill */}
        <div
          className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl border ${c.hintBg} ${c.hintBorder} backdrop-blur-sm shadow-sm graph-empty-state-hint`}
        >
          <ArrowUp size={15} className={`${c.hintIcon} animate-bounce`} />
          <span className={`text-sm font-bold ${c.hintText}`}>{hint}</span>
        </div>

        {/* Decorative dots */}
        <div className="flex items-center gap-2 opacity-50">
          <div className={`w-2 h-2 rounded-full ${c.dot1} animate-pulse`} />
          <div className={`w-3 h-3 rounded-full ${c.dot2} animate-pulse`}
            style={{ animationDelay: "0.3s" }} />
          <div className={`w-2 h-2 rounded-full ${c.dot3} animate-pulse`}
            style={{ animationDelay: "0.6s" }} />
        </div>
      </div>
    </div>
  );
}
