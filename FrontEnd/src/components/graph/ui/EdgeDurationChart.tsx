import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import Chart from "react-apexcharts";
import { ApexOptions } from "apexcharts";
import { Activity, Maximize2, Minimize2, X } from "lucide-react";
import { Button } from "@heroui/button";
import { Tooltip } from "@heroui/tooltip";
import { motion, AnimatePresence } from "framer-motion";
import type { FilterTypes, HistogramData } from "src/types/types";
import GetEdgeStatisticsData from "../../../utils/GetEdgeStatisticsData";

interface EdgeDurationChartProps {
  source: string;
  target: string;
  duration: number;
  filePath: string;
  filters: FilterTypes;
}

export default function EdgeDurationChart({
  source,
  target,
  duration,
  filePath,
  filters,
}: EdgeDurationChartProps) {
  const [histogramData, setHistogramData] = useState<HistogramData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // 1. استیت جدید برای وضعیت بزرگنمایی
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchStats = async () => {
      if (!filePath || !filters?.dateRange || !source || !target) return;
      
      setIsLoading(true);
      try {
        const stats = await GetEdgeStatisticsData(
            filePath, 
            filters.dateRange.start, 
            filters.dateRange.end, 
            'specific',
            source,
            target
        ) as HistogramData;
        
        if (isMounted) {
            setHistogramData(stats);
        }
      } catch (error) {
        console.error("Failed to fetch edge stats", error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchStats();

    return () => { isMounted = false; };
  }, [filePath, filters, source, target]);

  // بستن با دکمه Esc
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
        if (e.key === "Escape") setIsExpanded(false);
    };
    if (isExpanded) {
        window.addEventListener("keydown", handleEsc);
    }
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isExpanded]);

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds.toFixed(0)} ثانیه`;
    if (seconds < 3600) return `${(seconds / 60).toFixed(0)} دقیقه`;
    if (seconds < 86400) return `${(seconds / 3600).toFixed(1)} ساعت`;
    return `${(seconds / 86400).toFixed(1)} روز`;
  };

  const chartConfig = useMemo(() => {
    if (!histogramData || !histogramData.bins.length) return null;

    const bins = histogramData.bins;
    const counts = histogramData.counts;
    
    const categories = counts.map((_, i) => formatDuration(bins[i]));
    
    let index = bins.findIndex((bin, i) => {
        if (i === bins.length - 1) return duration >= bin;
        return duration >= bin && duration < bins[i+1];
    });
    
    if (index === -1 && duration >= bins[bins.length-1]) index = counts.length - 1;
    if (index >= counts.length) index = counts.length - 1;
    if (index < 0) index = 0;

    return {
        series: [{ name: 'تعداد پرونده‌ها', data: counts }],
        categories,
        bins, 
        selectedIndex: index,
        annotationX: categories[index],
        myValueFormatted: formatDuration(duration)
    };
  }, [histogramData, duration]);

  const options: ApexOptions = {
    chart: {
        type: 'area',
        toolbar: { show: false },
        fontFamily: 'inherit',
        sparkline: { enabled: false },
        animations: { enabled: true },
        parentHeightOffset: 0,
        zoom: { enabled: false }
    },
    stroke: {
        curve: 'smooth',
        width: 2,
    },
    fill: {
        type: 'gradient',
        gradient: {
            shadeIntensity: 1,
            opacityFrom: 0.5,
            opacityTo: 0.1,
            stops: [0, 100]
        }
    },
    colors: ['#64748b'],
    dataLabels: { enabled: false },
    xaxis: {
        type: 'category',
        categories: chartConfig?.categories || [],
        labels: { 
            show: true,
            rotate: -45,
            style: { fontSize: '9px', colors: '#94a3b8', fontFamily: 'inherit' },
            trim: true,
            maxHeight: 40,
            formatter: (val, timestamp, opts) => {
                const index = opts?.i;
                if (typeof index === 'undefined') return val;

                const total = chartConfig?.categories.length || 0;
                
                // تنظیمات داینامیک بر اساس وضعیت بزرگنمایی
                const threshold = isExpanded ? 25 : 8; 
                const stepDivider = isExpanded ? 15 : 6;

                if (total < threshold) return val;

                const step = Math.ceil(total / stepDivider);

                if (index % step === 0) return val;
                
                return '';
            }
        },
        tickAmount: isExpanded ? 15 : 6,
        axisBorder: { show: isExpanded, color: '#e2e8f0' }, // در حالت بزرگ بردر داشته باشد
        axisTicks: { show: isExpanded, color: '#e2e8f0' },
        tooltip: { enabled: false },
        crosshairs: { show: false }
    },
    yaxis: {
        show: true,
        labels: { 
            show: true,
            style: { fontSize: '9px', colors: '#94a3b8', fontFamily: 'inherit' },
            formatter: (val) => val.toFixed(0),
            offsetX: -5
        },
    },
    grid: {
        show: true,
        borderColor: '#f1f5f9',
        padding: { top: 0, right: 10, bottom: 5, left: 10 }
    },
    tooltip: {
        theme: 'light',
        fixed: { enabled: false },
        custom: ({ series, seriesIndex, dataPointIndex, w }) => {
            const value = series[seriesIndex][dataPointIndex];
            let label = w.globals.labels[dataPointIndex];
            if (chartConfig?.bins) {
                const start = formatDuration(chartConfig.bins[dataPointIndex]);
                const end = formatDuration(chartConfig.bins[dataPointIndex + 1]);
                label = `بازه: ${start} تا ${end}`;
            }

            return `
                <div class="px-3 py-2 bg-white border border-slate-200 shadow-lg rounded-lg text-right font-vazir" style="direction: rtl;">
                    <div class="text-[10px] text-slate-500 mb-1 border-b border-slate-100 pb-1">
                        ${label}
                    </div>
                    <div class="flex items-center justify-between gap-3 text-xs">
                        <span class="text-slate-600 font-medium">تعداد پرونده:</span>
                        <span class="font-bold text-slate-700" style="font-family: monospace; direction: ltr;">${value}</span>
                    </div>
                </div>
            `;
        },
        marker: { show: true }
    },
    annotations: {
        xaxis: [{
            x: chartConfig?.annotationX,
            borderColor: '#3b82f6',
            strokeDashArray: 0,
            borderWidth: 2,
            opacity: 1,
            label: {
                borderColor: '#3b82f6',
                style: { 
                    color: '#fff', 
                    background: '#3b82f6', 
                    fontSize: '9px', 
                    padding: { left: 4, right: 4, top: 2, bottom: 2 },
                    fontWeight: 'bold',
                    borderRadius: 2,
                    fontFamily: 'inherit'
                },
                text: 'پرونده انتخابی',
                orientation: 'horizontal',
                position: 'top',
                offsetY: -5
            }
        }]
    }
  };

  // --- Skeleton Loading ---
  if (isLoading) {
    return (
      <div className="mt-3 pt-3 border-t border-slate-100 animate-pulse h-40">
        <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 bg-slate-200 rounded-full"></div>
            <div className="w-28 h-2.5 bg-slate-200 rounded"></div>
        </div>
        <div className="h-28 w-full bg-slate-50 rounded-lg relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]"></div>
            <div className="flex items-end justify-between h-full gap-2 px-2 pb-2">
                 {[...Array(6)].map((_,i)=><div key={i} className="w-full bg-slate-200 rounded-t opacity-60" style={{height: `${Math.random()*60+20}%`}}></div>)}
            </div>
        </div>
      </div>
    );
  }

  if (!chartConfig) return null;

  // --- محتوای اصلی کارت (مشترک بین دو حالت) ---
  const ChartContent = (
    <motion.div
        // استفاده از ID منحصر به فرد ترکیبی برای جلوگیری از تداخل اگر چندین نمودار همزمان باشند
        layoutId={`edge-chart-${source}-${target}`}
        className={`
            bg-white flex flex-col overflow-hidden
            ${isExpanded 
                ? "w-[90vw] h-[85vh] rounded-2xl shadow-2xl p-6 border border-slate-200 z-[50]" 
                : "w-full h-full bg-transparent" // در حالت کوچک پس زمینه شفاف/سفید
            }
        `}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
        {/* Header */}
        <div className={`flex items-center justify-between shrink-0 ${isExpanded ? 'mb-4 border-b border-slate-100 pb-2' : 'mb-2'}`}>
            <div className="flex items-center gap-1 text-slate-500 font-bold">
                <Activity size={isExpanded ? 20 : 12} className="text-blue-500" />
                <span className={isExpanded ? "text-lg text-slate-700" : "text-[10px]"}>توزیع زمان در این مرحله</span>
            </div>
            
            <Tooltip content={isExpanded ? "کوچک کردن" : "بزرگنمایی"} showArrow size="sm" className="text-xs">
                <Button 
                    isIconOnly 
                    size="sm" 
                    variant="light" 
                    onPress={() => setIsExpanded(!isExpanded)}
                    className="text-slate-400 hover:text-slate-600 min-w-6 w-6 h-6"
                >
                    {isExpanded ? <X size={20} /> : <Maximize2 size={14} />}
                </Button>
            </Tooltip>
        </div>

        {/* Chart Container */}
        <div className="flex-1 w-full min-h-0 relative">
            <Chart 
                options={options} 
                series={chartConfig.series} 
                type="area" 
                height="100%" 
                width="100%" 
            />
        </div>
    </motion.div>
  );

  return (
    <>
      {/* 1. کانتینر اصلی در محل اولیه */}
      <div className="mt-3 pt-3 border-t border-slate-100 relative h-40">
        {!isExpanded && ChartContent}
        
        {/* Placeholder وقتی کامپوننت پرواز می‌کند */}
        {isExpanded && (
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full h-full flex items-center justify-center bg-slate-50/50 border border-dashed border-slate-200 rounded-lg"
            >
                <span className="text-[10px] text-slate-400">نمودار تمام صفحه</span>
            </motion.div>
        )}
      </div>

      {/* 2. پورتال برای نمایش تمام صفحه */}
      {createPortal(
        <AnimatePresence>
            {isExpanded && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-10 pointer-events-none">
                    {/* Backdrop */}
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm pointer-events-auto"
                        onClick={() => setIsExpanded(false)}
                    />
                    
                    {/* Expanded Card */}
                    <div className="relative pointer-events-auto z-10 w-full flex items-center justify-center">
                        {ChartContent}
                    </div>
                </div>
            )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}