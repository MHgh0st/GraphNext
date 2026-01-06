/**
 * @component Navbar
 * @description
 * نوار ابزار سراسری که فیلترهای اصلی را در یک منوی کشویی (Dropdown) مدیریت می‌کند.
 */

import { useState, useEffect, useCallback } from "react";
import { Button } from "@heroui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@heroui/popover";
import { Chip } from "@heroui/chip";
import {
  Activity,
  Filter,
  CalendarRange,
  ListFilter,
  Check,
} from "lucide-react";
import moment from "moment-jalaali";
import { DateValue, parseDate } from "@internationalized/date";
import PersianRangeDatePicker from "./sideBarCards/RangeDatePicker"; // ایمپورت کامپوننت تاریخ
import { FilterTypes } from "../types/types";
import {useAppStore} from "@/hooks/useAppStore";
import {useGraphStore} from "@/store/useGraphStore";
import api from "@/utils/fetcher";


// تنظیمات مومنت
moment.loadPersian({ dialect: "persian-modern", usePersianDigits: false });

interface NavbarProps {
  onFilterUpdate: (filters: FilterTypes) => void;
  isLoading?: boolean;
  currentFilters: FilterTypes | null;
}

export default function Navbar({
  onFilterUpdate,
  isLoading = false,
  currentFilters,
}: NavbarProps) {
  // Get state from stores
  const { filters, setIsLoading, setProcessedData } = useAppStore();
  const { processInitialData } = useGraphStore();

  // State برای فیلترها
  const [dateRange, setDateRange] = useState<{
    start: DateValue | null;
    end: DateValue | null;
  }>({
    start: null,
    end: null,
  });
  const [isOpen, setIsOpen] = useState(false);

  // همگام‌سازی استیت با فیلترهای فعلی هنگام تغییر آن‌ها
  useEffect(() => {
    if (currentFilters) {
      try {
        if (currentFilters.dateRange.start && currentFilters.dateRange.end) {
          setDateRange({
            start: parseDate(currentFilters.dateRange.start),
            end: parseDate(currentFilters.dateRange.end),
          });
        }

      } catch (e) {
        console.error("Error parsing dates from filters", e);
      }
    }
  }, [currentFilters]);

  // Load graph data from API
  // Accepts filters as parameter to avoid stale closure issues
  const loadGraph = useCallback(async (filtersToUse: FilterTypes) => {
    if (!filtersToUse) return;
    
    setIsLoading(true);
    
    try {
      // Fetch data from backend
      const data = await api.graph.getData(filtersToUse);
      
      // Store in app state
      setProcessedData({
        graphData: data.graphData,
        variants: data.variants,
        outliers: data.outliers,
        startActivities: data.startActivities,
        endActivities: data.endActivities,
      });
      
      // Process for graph visualization
      processInitialData(
        data.graphData, 
        data.startActivities, 
        data.endActivities
      );
      
    } catch (error) {
      console.error("Error loading graph:", error);
    } finally {
      setIsLoading(false);
    }
  }, [setIsLoading, setProcessedData, processInitialData]);

  // اعمال تغییرات
  const handleApply = () => {
    if (!dateRange.start || !dateRange.end) {
        return;
    }

    // تبدیل تاریخ‌ها به رشته استاندارد
    const startIso = dateRange.start.toString();
    const endIso = dateRange.end.toString();

    // ساخت آبجکت فیلتر جدید
    const defaultOtherFilters = {
        minCaseCount: null as number | null,
        maxCaseCount: null as number | null,
        meanTimeRange: { min: null, max: null } as { min: number | null, max: number | null },
        weightFilter: "mean_time" as const,
        timeUnitFilter: "d" as const,
    };

    const baseFilters = currentFilters || { 
        ...defaultOtherFilters, 
        dateRange: { start: startIso, end: endIso },
        outlierPrecentage: 5 
    };

    const newFilters: FilterTypes = {
      ...baseFilters,
      dateRange: {
        start: startIso,
        end: endIso,
      },
    };

    onFilterUpdate(newFilters);
    setIsOpen(false);
    
    // Load graph with the NEW filters directly (avoid stale closure)
    loadGraph(newFilters);
  };

  // فرمت تاریخ برای نمایش خلاصه در دکمه
  const getDateLabel = () => {
    if (dateRange.start && dateRange.end) {
      const start = moment(
        new Date(
          dateRange.start.year,
          dateRange.start.month - 1,
          dateRange.start.day
        )
      ).format("jYYYY/jMM/jDD");
      const end = moment(
        new Date(dateRange.end.year, dateRange.end.month - 1, dateRange.end.day)
      ).format("jYYYY/jMM/jDD");
      return `${start} - ${end}`;
    }
    return "انتخاب بازه";
  };

  return (
    <div className="w-full h-16 bg-white/80 backdrop-blur-xl rounded-2xl border border-slate-200/60 shadow-sm px-4 flex gap-x-8 items-center z-30 relative transition-all duration-300">
      {/* --- Left Side: Title --- */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
          <Activity size={20} />
        </div>
        <div className="hidden md:block">
          <h1 className="text-sm font-bold text-slate-800">
            داشبورد تحلیل فرآیند
          </h1>
          <p className="text-[10px] text-slate-400">سامانه هوشمند مانیتورینگ</p>
        </div>
      </div>

      {/* --- Middle: Dropdown Filter Trigger --- */}
      <div className="flex">
        <Popover
          isOpen={isOpen}
          onOpenChange={setIsOpen}
          placement="bottom"
          offset={10}
          showArrow
          backdrop="transparent"
        >
          <PopoverTrigger>
            <Button
              variant="flat"
              className="h-10 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl px-4 min-w-[280px] justify-between group hover:bg-white hover:border-blue-300 hover:shadow-md transition-all duration-300"
            >
              <div className="flex items-center gap-2">
                <Filter
                  size={16}
                  className="text-slate-400 group-hover:text-blue-500 transition-colors"
                />
                <span className="text-xs font-bold text-slate-700">
                  فیلترهای سراسری
                </span>
              </div>

              {/* نمایش خلاصه وضعیت فیلترها روی دکمه */}
              <div dir="ltr" className="flex items-center gap-1.5">
                {/* چیپ تاریخ */}
                {dateRange.start && (
                  <Chip
                    size="sm"
                    variant="flat"
                    className="h-5 bg-blue-100 text-blue-700 border border-blue-200 text-[10px] px-1"
                  >
                    {getDateLabel()}
                  </Chip>
                )}
              </div>
            </Button>
          </PopoverTrigger>

          <PopoverContent className="text-right w-[320px] p-0 border border-slate-100 shadow-2xl rounded-2xl overflow-hidden">
            <div dir="ltr" className="flex flex-col">
              {/* Header */}
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <div className="p-1.5 bg-white border border-slate-200 rounded-lg shadow-sm">
                  <ListFilter size={14} className="text-slate-400" />
                </div>
                <span className="text-xs font-bold text-slate-700">
                  تنظیمات سراسری
                </span>
              </div>

              {/* Body */}
              <div className="p-4 flex flex-col gap-5 bg-white">
                {/* 1. Date Range Section */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <CalendarRange size={14} className="text-blue-500" />
                    <span className="text-[11px] font-bold">بازه زمانی</span>
                  </div>
                  <PersianRangeDatePicker
                    value={dateRange}
                    onChange={setDateRange}
                    placeholder={{ start: "شروع...", end: "پایان..." }}
                  />
                </div>


              </div>

              {/* Footer Actions */}
              <div className="p-3 border-t border-slate-100 bg-slate-50 flex gap-2 justify-end">
                <Button
                  size="sm"
                  variant="light"
                  color="danger"
                  onPress={() => setIsOpen(false)}
                  className="text-xs font-medium h-8"
                >
                  انصراف
                </Button>
                <Button
                  size="sm"
                  color="primary"
                  onPress={handleApply}
                  isLoading={isLoading}
                  isDisabled={!dateRange.start || !dateRange.end}
                  className="text-xs font-bold bg-blue-600 text-white shadow-md shadow-blue-500/20 h-8 px-4 rounded-lg"
                  startContent={!isLoading ? <Check size={14} /> : undefined}
                >
                  اعمال فیلترها
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
