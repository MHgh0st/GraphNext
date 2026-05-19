/**
 * @component Navbar
 * @description
 * نوار ابزار سراسری که فیلترهای اصلی را در یک منوی کشویی (Dropdown) مدیریت می‌کند.
 */

import { useState, useEffect, useCallback } from "react";
import { Button } from "@heroui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@heroui/popover";
import { Chip } from "@heroui/chip";
import { Select, SelectItem } from "@heroui/select";
import {
  SlidersHorizontal,
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
  const [lev2Options, setLev2Options] = useState<string[]>([]);
  const [lev3Options, setLev3Options] = useState<string[]>([]);
  const [selectedLev2Names, setSelectedLev2Names] = useState<string[]>([]);
  const [selectedLev3Names, setSelectedLev3Names] = useState<string[]>([]);
  const [isLoadingDimensions, setIsLoadingDimensions] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // همگام‌سازی استیت با فیلترهای فعلی هنگام تغییر آن‌ها
  useEffect(() => {
    if (!currentFilters) return;

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

    setSelectedLev2Names(currentFilters.lev2Names ?? []);
    setSelectedLev3Names(currentFilters.lev3Names ?? []);
  }, [currentFilters]);

  useEffect(() => {
    let active = true;
    setIsLoadingDimensions(true);

    api.graph
      .getDimensions()
      .then((data) => {
        if (!active) return;
        setLev2Options(data.lev2_names ?? []);
        setLev3Options(data.lev3_names ?? []);
      })
      .catch((error) => {
        console.error("Error loading dimension filters:", error);
      })
      .finally(() => {
        if (active) setIsLoadingDimensions(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const remainingLev2Options = lev2Options.filter(
    (option) => !selectedLev2Names.includes(option)
  );
  const remainingLev3Options = lev3Options.filter(
    (option) => !selectedLev3Names.includes(option)
  );

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
      lev2Names: selectedLev2Names,
      lev3Names: selectedLev3Names,
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
    <div className="w-full h-16 bg-white/80 backdrop-blur-xl rounded-2xl border border-slate-200/60 shadow-sm px-4 flex gap-x-4 items-center z-30 relative transition-all duration-300">
      {/* --- Left Side: Title --- */}
      <div className="flex items-center gap-3 border-l pl-3 border-slate-300">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
          <SlidersHorizontal size={20} />
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
          shouldCloseOnInteractOutside={(el) => {
            // اگر المنت کلیک‌شده داخل یک popover یا overlay دیگر باشد، بسته نشود
            const isInsideNestedPopover = el.closest(
              "[data-slot='content'][data-open]," +
              "[role='dialog']," +
              "[role='listbox']," +
              ".heroui-popover-content," +
              "[data-dismissable-layer]"
            );
            return !isInsideNestedPopover;
          }}
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

          <PopoverContent className="text-right w-[320px] p-0 border border-slate-100 shadow-2xl rounded-2xl max-h-[80vh] overflow-y-auto">
            <div dir="ltr" className="flex flex-col min-h-0">
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
              <div className="p-4 flex flex-col gap-5 bg-white overflow-y-auto min-h-0 max-h-[calc(80vh-120px)]">
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

                <div className="flex flex-col gap-4 pt-2 border-t border-slate-100">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-slate-500 mb-1">
                      <span className="text-[11px] font-bold">فیلتر سطح 2</span>
                    </div>

                    {selectedLev2Names.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {selectedLev2Names.map((item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() =>
                              setSelectedLev2Names((prev) => prev.filter((value) => value !== item))
                            }
                            className="inline-flex items-center gap-2 rounded-full bg-blue-100 text-blue-800 text-[11px] px-2 py-1 transition hover:bg-blue-200"
                          >
                            <span>{item}</span>
                            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-200 text-blue-700">
                              ×
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    <Select
                      label="فیلتر سطح 2"
                      placeholder="انتخاب کنید"
                      size="sm"
                      selectionMode="multiple"
                      selectedKeys={new Set(selectedLev2Names)}
                      renderValue={(items) =>
                        items.length ? <span>{items.length} انتخاب شده</span> : <span className="text-slate-400">انتخاب کنید</span>
                      }
                      classNames={{
                        trigger: "bg-white/80 border-slate-200 hover:border-blue-300 focus:border-blue-500 rounded-xl shadow-sm",
                        value: "text-slate-700 text-xs",
                      }}
                      onSelectionChange={(keys) =>
                        setSelectedLev2Names(Array.from(keys).map(String))
                      }
                      disabled={isLoadingDimensions || lev2Options.length === 0 || remainingLev2Options.length === 0}
                    >
                      {remainingLev2Options.map((option) => (
                        <SelectItem key={option} textValue={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </Select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-slate-500 mb-1">
                      <span className="text-[11px] font-bold">فیلتر سطح 3</span>
                    </div>

                    {selectedLev3Names.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {selectedLev3Names.map((item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() =>
                              setSelectedLev3Names((prev) => prev.filter((value) => value !== item))
                            }
                            className="inline-flex items-center gap-2 rounded-full bg-blue-100 text-blue-800 text-[11px] px-2 py-1 transition hover:bg-blue-200"
                          >
                            <span>{item}</span>
                            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-200 text-blue-700">
                              ×
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    <Select
                      label="فیلتر سطح 3"
                      placeholder="انتخاب کنید"
                      size="sm"
                      selectionMode="multiple"
                      selectedKeys={new Set(selectedLev3Names)}
                      renderValue={(items) =>
                        items.length ? <span>{items.length} انتخاب شده</span> : <span className="text-slate-400">انتخاب کنید</span>
                      }
                      classNames={{
                        trigger: "bg-white/80 border-slate-200 hover:border-blue-300 focus:border-blue-500 rounded-xl shadow-sm",
                        value: "text-slate-700 text-xs",
                      }}
                      onSelectionChange={(keys) =>
                        setSelectedLev3Names(Array.from(keys).map(String))
                      }
                      disabled={isLoadingDimensions || lev3Options.length === 0 || remainingLev3Options.length === 0}
                    >
                      {remainingLev3Options.map((option) => (
                        <SelectItem key={option} textValue={option}>
                          {option}
                        </SelectItem>
                      ))}
                    </Select>
                  </div>
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
