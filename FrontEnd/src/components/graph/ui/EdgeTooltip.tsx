import { X, Network, Clock, Hash, Activity, ArrowLeftRight } from "lucide-react";
import { CardHeader, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import EdgeDurationChart from "./EdgeDurationChart";
import type { FilterTypes } from "src/types/types";

interface EdgeTooltipProps {
  edgeTooltipTitle: string | null;
  edgeTooltipData: Array<{ label: string; value: string | number }>;
  onClose: () => void;
  chartProps?: {
    source: string;
    target: string;
    duration: number;
    filePath: string;
    filters: FilterTypes;
  } | null;
}

export default function EdgeTooltip({
  edgeTooltipTitle,
  edgeTooltipData,
  onClose,
  chartProps
}: EdgeTooltipProps) {
  
  // تابع کمکی برای انتخاب آیکون بر اساس لیبل
  const getIcon = (label: string) => {
    if (label.includes("زمان") || label.includes("Time")) return <Clock size={14} className="text-blue-500" />;
    if (label.includes("تعداد") || label.includes("Count")) return <Hash size={14} className="text-amber-500" />;
    return <Activity size={14} className="text-slate-400" />;
  };

  return (
    <>
      <CardHeader className="flex items-center justify-between py-3 px-4 bg-slate-50/50 border-b border-slate-100">
        <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-100 text-blue-600 rounded-lg shadow-sm">
                <Network size={18} />
            </div>
            <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-800">جزئیات ارتباط (یال)</span>
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    {edgeTooltipTitle || "مسیر بین دو فعالیت"}
                </span>
            </div>
        </div>
        
        <Button
          isIconOnly
          size="sm"
          variant="light"
          onPress={onClose}
          className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
        >
          <X size={20} />
        </Button>
      </CardHeader>

      <CardBody className="p-0 overflow-hidden">
        <div className="flex items-center justify-around w-full py-4 px-2 bg-white">
          {edgeTooltipData.map((item, index) => (
            <div key={index} className="flex items-center flex-1 justify-center relative group">
              {/* جداکننده بین آیتم‌ها (به جز اولی) */}
              {index > 0 && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-px bg-slate-100 group-first:hidden" />
              )}

              <div className="flex flex-col items-center gap-1.5 px-4 transition-transform duration-200 hover:scale-105 cursor-default">
                <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                  {getIcon(item.label)}
                  {item.label}
                </span>
                <span className="text-sm font-bold text-slate-700 font-mono tracking-tight text-center">
                  {item.value}
                </span>
              </div>
            </div>
          ))}
          
          {edgeTooltipData.length === 0 && (
              <div className="text-center w-full text-slate-400 text-xs py-2">
                  اطلاعاتی برای نمایش وجود ندارد
              </div>
          )}


          
        </div>
        <div className="m-2 mt-0">
          {chartProps && (
        <EdgeDurationChart 
            source={chartProps.source}
            target={chartProps.target}
            duration={chartProps.duration}
            filePath={chartProps.filePath}
            filters={chartProps.filters}
            
        />
      )}
        </div>
      </CardBody>
    </>
  );
}