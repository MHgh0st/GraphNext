/**
 * @component Filters
 * @module components/sideBarCards/Filters
 *
 * @description
 * Filter configuration card for the sidebar.
 * Allows users to set various filters before processing data:
 * - Date range (required)
 * - Case count range
 * - Mean time range
 * - Weight metric (cases vs mean time)
 * - Time unit display
 *
 * @example
 * ```tsx
 * <Filters
 *   submit={handleFilterSubmit}
 *   isLoading={isProcessing}
 * />
 * ```
 */

'use client'

import { useState, useCallback, memo, useEffect, useMemo } from "react";
import { Button } from "@heroui/button";
import { Slider } from "@heroui/slider";
import { Form } from "@heroui/form";
import { Accordion, AccordionItem } from "@heroui/accordion";
import { NumberInput } from "@heroui/number-input";
import { Select, SelectItem } from "@heroui/select";
import { Input } from "@heroui/input";
import { Checkbox } from "@heroui/checkbox";
import { Chip } from "@heroui/chip";
import { Divider } from "@heroui/divider";
import { DateValue } from "@internationalized/date";
import { Node } from "@xyflow/react";
import { 
  Search, 
  CheckSquare, 
  Square, 
  Layers, 
  ListFilter,
  Hash,
  Clock,
  Workflow,
  Activity,
} from "lucide-react";

import type { FilterTypes } from "@/types/types";
import TimeFilterSection from "@/components/sideBarCards/TimeFilterSection";
import { useGraphStore } from "@/store/useGraphStore";
import { useAppStore } from "@/hooks/useAppStore";
import api from "@/utils/fetcher";
// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// Note: This is a Next.js route page - all state comes from stores, no props

/**
 * Weight filter options
 */
type WeightFilter = "cases" | "mean_time";

/**
 * Time unit options
 */
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
  // Get state from stores - this is a Next.js route so no props
  const { allNodes, processInitialData } = useGraphStore();
  const { 
    selectedNodeIds, 
    setSelectedNodeIds: onSelectionChange, 
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
  
  // Node filtering state
  const [searchValue, setSearchValue] = useState<string>("");
  const [searchedNodes, setSearchedNodes] = useState<Node[]>(allNodes);

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

  // Search nodes effect - includes all nodes (including START_NODE and END_NODE)
  useEffect(() => {
    if (!searchValue.trim()) {
      setSearchedNodes(allNodes);
    } else {
      setSearchedNodes(
        allNodes.filter((node) =>
          String(node.data.label || "").toLowerCase().includes(searchValue.toLowerCase())
        )
      );
    }
  }, [allNodes, searchValue]);

  // Separate selected and unselected nodes
  const { selectedList, unselectedList } = useMemo(() => {
    const selected: Node[] = [];
    const unselected: Node[] = [];

    searchedNodes.forEach((node) => {
      if (selectedNodeIds.has(node.id)) {
        selected.push(node);
      } else {
        unselected.push(node);
      }
    });

    return { selectedList: selected, unselectedList: unselected };
  }, [searchedNodes, selectedNodeIds]);

  const handleCheckboxChange = useCallback((nodeId: string, isChecked: boolean) => {
    const newSelectedIds = new Set(selectedNodeIds);
    if (isChecked) newSelectedIds.add(nodeId);
    else newSelectedIds.delete(nodeId);
    onSelectionChange(newSelectedIds);
  }, [selectedNodeIds, onSelectionChange]);

  const handleSelectAll = useCallback(() => {
    const allIds = new Set(searchedNodes.map((node) => node.id));
    onSelectionChange(new Set([...selectedNodeIds, ...allIds]));
  }, [searchedNodes, selectedNodeIds, onSelectionChange]);

  const handleDeselectAll = useCallback(() => {
    onSelectionChange(new Set());
  }, [onSelectionChange]);

  /**
   * Form submission handler
   */
  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!currentFilters?.dateRange?.start || !currentFilters?.dateRange?.end) {
        // Normally this shouldn't happen if Navbar enforces it, but safe to check
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
      };

      // Update filters in store
      setFilters(filters);
      
      // Call API with new filters (same as Navbar)
      setIsLoading(true);
      try {
        const data = await api.graph.getData(filters);
        
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
    },
    [caseIdRange, meanTimeRange, weightFilter, timeUnitFilter, outlierPercentage, currentFilters, setFilters, setIsLoading, setProcessedData, processInitialData]
  );

  return (
    <Form className={`h-full flex flex-col justify-between`} onSubmit={onSubmit}>
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
            content: "pb-4 px-1 pt-2 bg-transparent", // محتوا بدون پس‌زمینه
            indicator: "text-slate-400 group-data-[open=true]:text-blue-500 group-data-[open=true]:rotate-180 transition-transform duration-300",
          }}
        >

          {/* Case Count Filter */}
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
                    onChange={(value) =>
                      setCaseIdRange((prev) => ({ ...prev, min: Number(value) }))
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
                    onChange={(value) =>
                      setCaseIdRange((prev) => ({ ...prev, max: Number(value) }))
                    }
                  />
                </div>
            </div>
          </AccordionItem>

          {/* Time Filter */}
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
                    setTime={(time) => setMeanTimeRange((prev) => ({ ...prev, min: time }))}
                  />
                  <TimeFilterSection
                    title="حداکثر زمان:"
                    setTime={(time) => setMeanTimeRange((prev) => ({ ...prev, max: time }))}
                  />

                  <Divider className="bg-slate-200/60" />

                  {/* Weight Settings */}
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

          {/* Outlier Percentage Filter */}
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
                    {Array.isArray(outlierPercentage)
                      ? outlierPercentage[0]
                      : outlierPercentage}
                    %
                  </span>
                  <div className="flex items-center gap-2">
                    <Activity size={14} className="text-rose-500" />
                    <span className="text-[11px] font-bold">
                      درصد داده‌های پرت
                    </span>
                  </div>
                </div>
                <Slider
                  size="sm"
                  step={1}
                  maxValue={10}
                  minValue={0}
                  defaultValue={5}
                  value={outlierPercentage}
                  onChange={setOutlierPercentage}
                  aria-label="Outlier Percentage"
                  className="max-w-md"
                  classNames={{
                    track: "bg-slate-100 border border-slate-200 h-1.5",
                    filler: "bg-rose-500",
                    thumb:
                      "w-3.5 h-3.5 bg-white border-2 border-rose-500 shadow-sm after:bg-rose-500",
                  }}
                />
                <p className="text-[9px] text-slate-400 leading-4">
                  با افزایش این مقدار، داده‌های بیشتری به عنوان ناهنجاری
                  (Outlier) در نظر گرفته می‌شوند.
                </p>
              </div>
            </div>
          </AccordionItem>

          {/* Nodes Filter */}
          <AccordionItem
            key="nodesFilter"
            aria-label="nodesFilter"
            title="انتخاب فعالیت‌ها"
            subtitle="انتخاب گره‌های نمایش"
            startContent={
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-600/20 flex items-center justify-center border border-emerald-100/50 shadow-inner">
                <Workflow size={20} className="text-emerald-600 drop-shadow-sm" />
              </div>
            }
          >
            <div className="pt-2 px-2">
                <div className="p-4 rounded-2xl bg-white/50 border border-white/60 backdrop-blur-sm shadow-sm space-y-3">
                  {/* Search Input */}
                  <Input
                    type="text"
                    variant="faded"
                    placeholder="جستجوی نام فعالیت..."
                    startContent={<Search size={16} className="text-slate-400" />}
                    value={searchValue}
                    classNames={{
                      inputWrapper:
                        "bg-white/80 border-slate-200 hover:border-emerald-400 focus-within:border-emerald-500 shadow-sm rounded-xl transition-all",
                      input: "text-xs"
                    }}
                    onChange={(e) => {
                      const value = e.target.value.replace("ی", "ي");
                      setSearchValue(value);
                    }}
                  />

                  {/* Select/Deselect Buttons */}
                  {allNodes.length > 0 && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="flat"
                        className="bg-blue-50/80 text-blue-600 font-medium flex-1 rounded-lg hover:bg-blue-100 border border-blue-100/50 text-xs h-8"
                        startContent={<CheckSquare size={14} />}
                        onPress={handleSelectAll}
                      >
                        انتخاب همه
                      </Button>
                      <Button
                        size="sm"
                        variant="flat"
                        className="bg-rose-50/80 text-rose-600 font-medium flex-1 rounded-lg hover:bg-rose-100 border border-rose-100/50 text-xs h-8"
                        startContent={<Square size={14} />}
                        onPress={handleDeselectAll}
                      >
                        لغو همه
                      </Button>
                    </div>
                  )}

                  {/* Node List */}
                  {allNodes.length > 0 ? (
                    <div className="flex flex-col gap-y-2 max-h-60 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                      {/* Selected Nodes Section */}
                      {selectedList.length > 0 && (
                        <div className="flex flex-col gap-2 mb-2">
                          <div className="flex items-center justify-between px-1 mt-1">
                            <div className="flex items-center gap-1.5 text-blue-600">
                              <Layers size={14} />
                              <span className="text-[11px] font-bold">انتخاب شده‌ها</span>
                            </div>
                            <Chip size="sm" variant="flat" className="bg-blue-100/80 text-blue-700 h-5 text-[10px] border border-blue-200/50">
                              {selectedList.length}
                            </Chip>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            {selectedList.map((node) => (
                              <div
                                key={node.id}
                                className="group flex items-center gap-3 p-2.5 rounded-xl border transition-all duration-300 cursor-pointer relative overflow-hidden bg-gradient-to-r from-blue-50/90 to-blue-50/40 border-blue-200 hover:shadow-md hover:shadow-blue-500/5"
                                onClick={() => handleCheckboxChange(node.id, false)}
                              >
                                <div className="absolute right-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r-full" />
                                <Checkbox
                                  isSelected={true}
                                  radius="md"
                                  size="sm"
                                  color="primary"
                                  classNames={{ wrapper: "before:border-slate-300 mr-1" }}
                                  onValueChange={() => handleCheckboxChange(node.id, false)}
                                />
                                <span className="text-xs font-medium truncate text-blue-800">
                                  {String(node.data.label || node.id)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Divider */}
                      {selectedList.length > 0 && unselectedList.length > 0 && (
                        <Divider className="my-1 bg-slate-200/60" />
                      )}

                      {/* Unselected Nodes Section */}
                      {unselectedList.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                          {selectedList.length > 0 && (
                            <div className="flex items-center justify-between px-1 opacity-70 mb-1">
                              <div className="flex items-center gap-1.5 text-slate-500">
                                <ListFilter size={14} />
                                <span className="text-[11px] font-bold">سایر موارد</span>
                              </div>
                              <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 rounded-md">{unselectedList.length}</span>
                            </div>
                          )}
                          {unselectedList.map((node) => (
                            <div
                              key={node.id}
                              className="group flex items-center gap-3 p-2.5 rounded-xl border transition-all duration-300 cursor-pointer relative overflow-hidden bg-white/60 border-slate-100 hover:border-slate-300 hover:shadow-sm hover:bg-white/90"
                              onClick={() => handleCheckboxChange(node.id, true)}
                            >
                              <Checkbox
                                isSelected={false}
                                radius="md"
                                size="sm"
                                color="primary"
                                classNames={{ wrapper: "before:border-slate-300 mr-1" }}
                                onValueChange={() => handleCheckboxChange(node.id, true)}
                              />
                              <span className="text-xs font-medium truncate text-slate-600 group-hover:text-slate-900 transition-colors">
                                {String(node.data.label || node.id)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* No search results */}
                      {searchedNodes.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-24 text-slate-400 gap-2 opacity-70 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                          <Search size={20} />
                          <span className="text-[11px]">فعالیتی یافت نشد</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-24 text-slate-400 gap-2 opacity-70 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                      <Search size={20} />
                      <span className="text-[11px]">لیست فعالیت‌ها خالی است</span>
                    </div>
                  )}
                </div>
            </div>
          </AccordionItem>
        </Accordion>
      </div>

      {/* Submit Button */}
      <div className="w-full pt-4 mt-auto ">
        <Button
          fullWidth
          color="primary"
          size="lg"
          className="shadow-lg shadow-blue-500/30 font-bold rounded-xl"
          type="submit"
          isLoading={isLoading}
        >
          پردازش و نمایش گراف
        </Button>
      </div>
    </Form>
  );
}

export default memo(Filters);