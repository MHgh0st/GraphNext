import {
  SlidersHorizontal,
  LineSquiggle,
  Settings,
  RouteOff,
  FolderSearch,
  Monitor
} from "lucide-react";
import type { SidebarTab } from "../types/types";

// تعریف اینترفیس برای تم‌ها
interface TabThemeConfig {
  title: string;
  icon: any;
  path: string;
  // استایل‌های کامل دکمه در حالت فعال
  activeClass: string; 
  // رنگ نشانگر (خط یا دایره بغل)
  indicatorClass: string;
  // رنگ آیکون در حالت فعال
  iconActiveClass: string;
}

export const TAB_THEMES: Record<SidebarTab, TabThemeConfig> = {
  Filter: {
    title: "نمایش فرآیند ها",
    icon: Monitor,
    path:"/",
    // آبی (Blue)
    activeClass: "bg-blue-50/80 text-blue-700 shadow-[0_4px_12px_-4px_rgba(59,130,246,0.2)]",
    indicatorClass: "bg-blue-500",
    iconActiveClass: "text-blue-600",
  },
  Routing: {
    title: "مسیریابی",
    icon: LineSquiggle,
    path: "/routing",
    // سبز زمردی (Emerald)
    activeClass: "bg-emerald-50/80 text-emerald-700 shadow-[0_4px_12px_-4px_rgba(16,185,129,0.2)]",
    indicatorClass: "bg-emerald-500",
    iconActiveClass: "text-emerald-600",
  },
  SearchCaseIds: {
    title: "بررسی تک پرونده",
    icon: FolderSearch,
    path: "/search-case-ids",
    // بنفش (Violet)
    activeClass: "bg-violet-50/80 text-violet-700 shadow-[0_4px_12px_-4px_rgba(139,92,246,0.2)]",
    indicatorClass: "bg-violet-500",
    iconActiveClass: "text-violet-600",
  },
  Outliers: {
    title: "مسیر های کم تکرار",
    icon: RouteOff,
    path:"/outliers",
    // قرمز/رز (Rose)
    activeClass: "bg-rose-50/80 text-rose-700 shadow-[0_4px_12px_-4px_rgba(244,63,94,0.2)]",
    indicatorClass: "bg-rose-500",
    iconActiveClass: "text-rose-600",
  },
  Settings: {
    title: "تنظیمات",
    icon: Settings,
    path:"/settings",
    // خاکستری تیره (Slate)
    activeClass: "bg-slate-100 text-slate-800 shadow-sm",
    indicatorClass: "bg-slate-600",
    iconActiveClass: "text-slate-700",
  },
};