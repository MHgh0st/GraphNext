'use client'

import { useState, useCallback, memo, useEffect } from "react";
import { Button } from "@heroui/button";
import { Slider } from "@heroui/slider";
import { Form } from "@heroui/form";
import { Accordion, AccordionItem } from "@heroui/accordion";
import { NumberInput } from "@heroui/number-input";
import { Select, SelectItem } from "@heroui/select";
import { Divider } from "@heroui/divider";
import { 
  Hash, 
  Clock, 
  Activity,
  Network
} from "lucide-react";

import type { FilterTypes } from "@/types/types";
import TimeFilterSection from "@/components/sideBarCards/TimeFilterSection";
import ActivityTreeFilter from "@/components/ActivityTreeFilter"; // 🟢 ایمپورت کامپوننت جدید درختی
import { useGraphStore } from "@/store/useGraphStore";
import { useAppStore } from "@/hooks/useAppStore";
import api from "@/utils/fetcher";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type WeightFilter = "cases" | "mean_time";
type TimeUnit = "s" | "m" | "h" | "d" | "w";

// ============================================================================
// CONSTANTS
// ============================================================================

const WEIGHT_FILTERS = [
  { key: "cases", label: "تعداد پرونده ها" },
  { key: "mean_time", label: "میانگین زمان طی شده" },
] as const;

const TIME_UNITS = [
  { key: "s", label: "ثانیه" },
  { key: "m", label: "دقیقه" },
  { key: "h", label: "ساعت" },
  { key: "d", label: "روز" },
  { key: "w", label: "هفته" },
] as const;

// ============================================================================
// COMPONENT
// ============================================================================

function Filters() {
  const { processInitialData } = useGraphStore();
  const { 
    filters: currentFilters,
    setFilters,
    setProcessedData,
    setIsLoading,
    isLoading
  } = useAppStore();
  
  // Form state
  const [caseIdRange, setCaseIdRange] = useState<{ min?: number; max?: number }>({});
  const [meanTimeRange, setMeanTimeRange] = useState<{
    min: number | null;
    max: number | null;
  }>({ min: null, max: null });
  const [weightFilter, setWeightFilter] = useState<WeightFilter>("mean_time");
  const [timeUnitFilter, setTimeUnitFilter] = useState<TimeUnit>("d");
  const [outlierPercentage, setOutlierPercentage] = useState<number | number[]>(5);

  // Stable callbacks so TimeFilterSection's useEffect doesn't loop on a new ref each render
  const setMinTime = useCallback(
    (time: number | null) => setMeanTimeRange((prev) => ({ ...prev, min: time })),
    []
  );
  const setMaxTime = useCallback(
    (time: number | null) => setMeanTimeRange((prev) => ({ ...prev, max: time })),
    []
  );

  // Sync state from currentFilters if available
  useEffect(() => {
    if (currentFilters) {
      setCaseIdRange({
        min: currentFilters.minCaseCount !== null ? currentFilters.minCaseCount : undefined,
        max: currentFilters.maxCaseCount !== null ? currentFilters.maxCaseCount : undefined,
      });
      setMeanTimeRange(currentFilters.meanTimeRange);
      setWeightFilter(currentFilters.weightFilter);
      setTimeUnitFilter(currentFilters.timeUnitFilter);
      if (currentFilters.outlierPrecentage !== null) {
        setOutlierPercentage(currentFilters.outlierPrecentage);
      }
    }
  }, [currentFilters]);

  /**
   * Form submission handler
   */
  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!currentFilters?.dateRange?.start || !currentFilters?.dateRange?.end) {
        alert("لطفاً بازه زمانی را از نوار بالا انتخاب کنید");
        return;
      }

      const filters: FilterTypes = {
        dateRange: currentFilters.dateRange,
        minCaseCount: caseIdRange.min ?? null,
        maxCaseCount: caseIdRange.max ?? null,
        meanTimeRange,
        weightFilter,
        timeUnitFilter,
        outlierPrecentage: Array.isArray(outlierPercentage)
          ? outlierPercentage[0]
          : outlierPercentage,
        dimensionFilters: currentFilters?.dimensionFilters ?? {},
        courtKinds: currentFilters?.courtKinds ?? [], // 🟢 پاس دادن داینامیک صلاحیت‌ها
        unitId: currentFilters?.unitId ?? null
      };

      setFilters(filters);
      setIsLoading(true);
      
      try {
        const data = await api.graph.getData(filters);
        
        setProcessedData({
          graphData: data.graphData,
          variants: data.variants,
          outliers: data.outliers,
          startActivities: data.startActivities,
          endActivities: data.endActivities,
        });
        
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
    },
    [caseIdRange, meanTimeRange, weightFilter, timeUnitFilter, outlierPercentage, currentFilters, setFilters, setIsLoading, setProcessedData, processInitialData]
  );

  return (
    <Form className="h-full flex flex-col justify-between" onSubmit={onSubmit}>
      <div className="w-full space-y-3" dir="rtl">
        <Accordion
          keepContentMounted
          defaultSelectedKeys={["caseCountFilter"]}
          variant="splitted"
          itemClasses={{
            base: "group px-0 mb-3 bg-transparent shadow-none",
            heading: "px-0",
            trigger: `
                px-4 py-4 rounded-2xl 
                bg-white/40 backdrop-blur-md 
                border border-white/60 
                hover:bg-white/60 hover:shadow-lg hover:shadow-blue-500/5 
                data-[open=true]:bg-white/80 data-[open=true]:shadow-xl data-[open=true]:shadow-blue-500/10 data-[open=true]:border-white/80
                transition-all duration-300 ease-in-out
            `,
            title: "text-slate-700 font-bold text-sm group-data-[open=true]:text-blue-600 transition-colors",
            subtitle: "text-xs text-slate-400 mt-1 group-data-[open=true]:text-slate-500",
            content: "pb-4 px-1 pt-2 bg-transparent",
            indicator: "text-slate-400 group-data-[open=true]:text-blue-500 group-data-[open=true]:rotate-180 transition-transform duration-300",
          }}
        >
          {/* ۱. فیلتر تعداد پرونده‌ها */}
          <AccordionItem
            key="caseCountFilter"
            aria-label="caseCountFilter"
            title="تعداد پرونده‌ها"
            subtitle="فیلتر بر اساس حجم"
            startContent={
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-600/20 flex items-center justify-center border border-amber-100/50 shadow-inner">
                <Hash size={20} className="text-amber-600 drop-shadow-sm" />
              </div>
            }
          >
            <div className="pt-2 px-2">
                <div className="p-4 rounded-2xl bg-white/50 border border-white/60 backdrop-blur-sm shadow-sm space-y-4">
                  <NumberInput
                    label="حداقل"
                    placeholder="0"
                    variant="faded"
                    labelPlacement="outside"
                    classNames={{
                      label: "text-xs font-medium text-slate-500 mb-1",
                      inputWrapper: "bg-white/80 border-slate-200 hover:border-amber-400 focus-within:border-amber-500 shadow-sm rounded-xl",
                    }}
                    value={caseIdRange.min}
                    minValue={0}
                    onValueChange={(value) =>
                      setCaseIdRange((prev) => ({ ...prev, min: value }))
                    }
                  />
                  <NumberInput
                    label="حداکثر"
                    placeholder="∞"
                    variant="faded"
                    labelPlacement="outside"
                    classNames={{
                      label: "text-xs font-medium text-slate-500 mb-1",
                      inputWrapper: "bg-white/80 border-slate-200 hover:border-amber-400 focus-within:border-amber-500 shadow-sm rounded-xl",
                    }}
                    value={caseIdRange.max}
                    minValue={0}
                    onValueChange={(value) =>
                      setCaseIdRange((prev) => ({ ...prev, max: value }))
                    }
                  />
                </div>
            </div>
          </AccordionItem>

          {/* ۲. فیلتر زمان رسیدگی و تنظیمات وزن گراف */}
          <AccordionItem
            key="timeFilter"
            aria-label="timeFilter"
            title="زمان رسیدگی"
            subtitle="مدت زمان فرآیندها"
            startContent={
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-600/20 flex items-center justify-center border border-violet-100/50 shadow-inner">
                <Clock size={20} className="text-violet-600 drop-shadow-sm" />
              </div>
            }
          >
            <div className="pt-2 px-2">
                <div className="p-4 rounded-2xl bg-white/50 border border-white/60 backdrop-blur-sm shadow-sm space-y-5">
                  <TimeFilterSection
                    title="حداقل زمان:"
                    setTime={setMinTime}
                  />
                  <TimeFilterSection
                    title="حداکثر زمان:"
                    setTime={setMaxTime}
                  />

                  <Divider className="bg-slate-200/60" />

                  <div className="space-y-3">
                    <p className="text-xs font-bold text-slate-500 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-400"></span>
                        تنظیمات وزن گراف
                    </p>
                    <Select
                      label="معیار وزن"
                      variant="faded"
                      size="sm"
                      selectedKeys={new Set([weightFilter])}
                      classNames={{
                          trigger: "bg-white/80 border-slate-200 hover:border-violet-400 focus:border-violet-500 rounded-xl shadow-sm",
                          value: "text-slate-700 text-xs",
                      }}
                      onSelectionChange={(keys) =>
                        setWeightFilter(Array.from(keys)[0] as WeightFilter)
                      }
                    >
                      {WEIGHT_FILTERS.map((item) => (
                        <SelectItem key={item.key} classNames={{title: "text-xs"}}>{item.label}</SelectItem>
                      ))}
                    </Select>

                    {weightFilter === "mean_time" && (
                      <Select
                        label="واحد نمایش"
                        variant="faded"
                        size="sm"
                        selectedKeys={new Set([timeUnitFilter])}
                        classNames={{
                            trigger: "bg-white/80 border-slate-200 hover:border-violet-400 focus:border-violet-500 rounded-xl shadow-sm",
                            value: "text-slate-700 text-xs",
                        }}
                        onSelectionChange={(keys) =>
                          setTimeUnitFilter(Array.from(keys)[0] as TimeUnit)
                        }
                      >
                        {TIME_UNITS.map((item) => (
                          <SelectItem key={item.key} classNames={{title: "text-xs"}}>{item.label}</SelectItem>
                        ))}
                      </Select>
                    )}
                  </div>
                </div>
            </div>
          </AccordionItem>

          {/* ۳. فیلتر آستانه ناهنجاری (داده‌های پرت) */}
          <AccordionItem
            key="outlierFilter"
            aria-label="outlierFilter"
            title="حساسیت داده‌های پرت"
            subtitle="تعیین آستانه ناهنجاری"
            startContent={
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500/10 to-pink-600/20 flex items-center justify-center border border-rose-100/50 shadow-inner">
                <Activity size={20} className="text-rose-600 drop-shadow-sm" />
              </div>
            }
          >
            <div className="pt-2 px-2">
              <div className="p-4 rounded-2xl bg-white/50 border border-white/60 backdrop-blur-sm shadow-sm space-y-4">
                <div className="flex justify-between items-center text-slate-500">
                  <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">
                    {Array.isArray(outlierPercentage) ? outlierPercentage[0] : outlierPercentage} %
                  </span>
                  <div className="flex items-center gap-2">
                    <Activity size={14} className="text-rose-500" />
                    <span className="text-[11px] font-bold">درصد داده‌های پرت</span>
                  </div>
                </div>
                <Slider
                  size="sm" step={1} maxValue={10} minValue={0} defaultValue={5}
                  value={outlierPercentage} onChange={setOutlierPercentage}
                  aria-label="Outlier Percentage" className="max-w-md"
                  classNames={{
                    track: "bg-slate-100 border border-slate-200 h-1.5",
                    filler: "bg-rose-500",
                    thumb: "w-3.5 h-3.5 bg-white border-2 border-rose-500 shadow-sm after:bg-rose-500",
                  }}
                />
                <p className="text-[9px] text-slate-400 leading-4">
                  با افزایش این مقدار، داده‌های بیشتری به عنوان ناهنجاری (Outlier) در نظر گرفته می‌شوند.
                </p>
              </div>
            </div>
          </AccordionItem>

          {/* 🟢 ۴. فیلتر درختی هوشمند فعالیت‌ها (جایگزین فیلتر خطی چک‌باکس قبلی شد) */}
          <AccordionItem
            key="nodesFilter"
            aria-label="nodesFilter"
            title="ساختار درختی فرآیندها"
            subtitle="فیلتر هوشمند کلاینت‌ساید"
            startContent={
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-600/20 flex items-center justify-center border border-emerald-100/50 shadow-inner">
                <Network size={20} className="text-emerald-600 drop-shadow-sm" />
              </div>
            }
          >
            <div className="pt-1 px-1">
               {/* رندر مستقیم کامپوننت درختی جدید با قابلیت اتصال آنی به ReactFlow */}
               <ActivityTreeFilter />
            </div>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Submit Button */}
      <div className="w-full pt-4 mt-auto">
        <Button
          fullWidth color="primary" size="lg" type="submit" isLoading={isLoading}
          className="shadow-lg shadow-blue-500/30 font-bold rounded-xl"
        >
          پردازش و نمایش گراف
        </Button>
      </div>
    </Form>
  );
}

export default memo(Filters);