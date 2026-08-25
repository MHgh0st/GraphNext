import dynamic from "next/dynamic";
import { X, Network, Clock, Hash, Activity, ArrowLeft } from "lucide-react";
import { CardHeader, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";

// Dynamic import to avoid SSR issues with apexcharts (uses window)
const EdgeDurationChart = dynamic(() => import("./EdgeDurationChart"), {
  ssr: false,
  loading: () => <div className="h-32 bg-slate-50 animate-pulse rounded-2xl border border-slate-100 m-4" />,
});

interface EdgeTooltipProps {
  edgeTooltipTitle: string | null;
  edgeTooltipData: Array<{ label: string; value: string | number }>;
  onClose: () => void;
  chartProps?: {
    source: string;
    target: string;
    duration: number;
  } | null;
}

export default function EdgeTooltip({
  edgeTooltipTitle,
  edgeTooltipData,
  onClose,
  chartProps
}: EdgeTooltipProps) {
  
  // 1. استخراج نام مبدا و مقصد از تایتل
  let sourceName = chartProps?.source || "مبدا";
  let targetName = chartProps?.target || "مقصد";
  let isParsed = false;

  if (edgeTooltipTitle) {
    const match = edgeTooltipTitle.match(/از یال\s+(.+?)\s+به\s+(.+)/);
    if (match) {
      sourceName = match[1];
      targetName = match[2];
      isParsed = true;
    }
  }

  // 2. تابع کمکی برای استایل‌دهی
  const getStatTheme = (label: string) => {
    if (label.includes("کل") || label.includes("Total")) {
      return {
        icon: <Activity size={16} />,
        textColor: "text-violet-600",
        bgColor: "bg-violet-50",
        borderColor: "border-violet-100",
        hoverBg: "hover:bg-violet-100/50"
      };
    }
    if (label.includes("زمان") || label.includes("Time")) {
      return {
        icon: <Clock size={16} />,
        textColor: "text-blue-600",
        bgColor: "bg-blue-50",
        borderColor: "border-blue-100",
        hoverBg: "hover:bg-blue-100/50"
      };
    }
    if (label.includes("تعداد") || label.includes("Count")) {
      return {
        icon: <Hash size={16} />,
        textColor: "text-amber-600",
        bgColor: "bg-amber-50",
        borderColor: "border-amber-100",
        hoverBg: "hover:bg-amber-100/50"
      };
    }
    if (label.includes("حداقل") || label.includes("حداکثر") || label.includes("میانه")) {
      return {
        icon: <Clock size={16} />,
        textColor: "text-emerald-600",
        bgColor: "bg-emerald-50/60",
        borderColor: "border-emerald-100/60",
        hoverBg: "hover:bg-emerald-100/40"
      };
    }
    if (label.includes("انحراف") || label.includes("انشعاب")) {
      return {
        icon: <Network size={16} />,
        textColor: "text-indigo-600",
        bgColor: "bg-indigo-50/60",
        borderColor: "border-indigo-100/40",
        hoverBg: "hover:bg-indigo-100/40"
      };
    }


    return {
      icon: <Network size={16} />,
      textColor: "text-slate-500",
      bgColor: "bg-slate-50",
      borderColor: "border-slate-200",
      hoverBg: "hover:bg-slate-100/50"
    };
  };

  return (
    <div dir="rtl">
      {/* ── Header Section ── */}
      <CardHeader className="flex flex-col py-4 px-5 bg-gradient-to-b from-slate-50/80 to-white border-b border-slate-100/80 rounded-t-2xl gap-3">
        
        {/* ردیف بالا: عنوان و دکمه بستن */}
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 text-slate-500">
            <Network size={16} className="text-blue-500" />
            <span className="text-xs font-bold text-slate-600">جزئیات ارتباط (یال)</span>
          </div>
          <Button
            isIconOnly
            size="sm"
            variant="light"
            onPress={onClose}
            className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors min-w-8 w-8 h-8 shrink-0 -m-1"
          >
            <X size={18} />
          </Button>
        </div>

        {/* ردیف پایین: نمایش گرافیکی مبدا و مقصد */}
        {isParsed || chartProps ? (
          <div className="flex items-stretch justify-between w-full mt-1 gap-2">
            
            {/* مبدا (سبز) */}
            <div className="flex flex-1 items-start gap-2 bg-emerald-50/80 border border-emerald-100/60 py-2.5 px-3 rounded-xl shadow-[0_1px_2px_rgba(16,185,129,0.05)] min-w-0">
              <div className="mt-1 w-2 h-2 rounded-full bg-emerald-500 shrink-0 ring-4 ring-emerald-500/20" />
              <span className="text-xs font-bold text-emerald-900 break-words leading-relaxed whitespace-nowrap">
                {sourceName}
              </span>
            </div>

            {/* آیکون فلش در مرکز (بدون همپوشانی) */}
            <div className="flex items-center justify-center shrink-0 self-center">
              <div className="flex items-center justify-center bg-white border border-slate-200 rounded-full w-7 h-7 shadow-sm">
                <ArrowLeft size={14} className="text-slate-400" />
              </div>
            </div>

            {/* مقصد (قرمز/رز) */}
            <div className="flex flex-1 items-start justify-end gap-2 bg-rose-50/80 border border-rose-100/60 py-2.5 px-3 rounded-xl shadow-[0_1px_2px_rgba(244,63,94,0.05)] min-w-0">
              <span className="text-xs font-bold text-rose-900 break-words leading-relaxed whitespace-nowrap text-right">
                {targetName}
              </span>
              <div className="mt-1 w-2 h-2 rounded-full bg-rose-500 shrink-0 ring-4 ring-rose-500/20" />
            </div>

          </div>
        ) : (
          /* حالت Fallback */
          <div className="w-full text-center bg-slate-100/50 py-2 rounded-xl border border-slate-200/50 break-words px-2 whitespace-nowrap">
             <span className="text-xs font-bold text-slate-600">{edgeTooltipTitle}</span>
          </div>
        )}
      </CardHeader>

      {/* ── Body Section ── */}
      <CardBody className="p-0 overflow-hidden bg-white">
        
        {/* Stats Grid */}
        <div className="p-4">
          {edgeTooltipData.length > 0 ? (
            <div className={`grid grid-cols-2 gap-2`}>
              {edgeTooltipData.map((item, index) => {
                const theme = getStatTheme(item.label);
                
                return (
                  <div 
                    key={index} 
                    className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-200 cursor-default ${theme.bgColor} ${theme.borderColor} ${theme.hoverBg}`}
                  >
                    <div className={`flex items-center gap-1.5 text-[11px] font-bold mb-1.5 ${theme.textColor}`}>
                      {theme.icon}
                      <span>{item.label}</span>
                    </div>
                    <span className="text-[13px] font-black text-slate-800 text-center leading-tight">
                      {item.value}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex items-center justify-center py-6 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
              <span className="text-slate-400 text-xs font-medium">اطلاعاتی برای نمایش وجود ندارد</span>
            </div>
          )}
        </div>

        {/* Chart Section */}
        {chartProps && (
          <div className="px-4 pb-4">
            <div className="p-3 bg-slate-50/60 border border-slate-100 rounded-2xl shadow-sm">
              <div className="text-[10px] font-bold text-slate-400 mb-2 flex items-center gap-1.5 px-1">
                <Activity size={12} />
                توزیع زمانی این یال
              </div>
              <EdgeDurationChart 
                source={chartProps.source}
                target={chartProps.target}
                duration={chartProps.duration}            
              />
            </div>
          </div>
        )}

      </CardBody>
    </div>
  );
}