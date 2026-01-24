/**
 * @component SearchCaseIdsCard
 * @module components/sideBarCards/SearchCaseIdsCard
 */

import { useState, useCallback, memo } from "react";
import { NumberInput } from "@heroui/number-input";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Divider } from "@heroui/divider";
import { Accordion, AccordionItem } from "@heroui/accordion";
import { Checkbox } from "@heroui/checkbox";
import { DateValue } from "@internationalized/date";
import {
  Search,
  XCircle,
  CheckCircle2,
  Clock,
  MapPin,
  FolderSearch,
  FileText,
  ArrowDown,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Info,
  Activity,
  ListStart,
  CalendarSearch,
  History,
} from "lucide-react";

import type { FilterTypes, SearchCaseIdsData, ExtendedPath } from "../../types/types";
import { formatDuration } from "../../utils/formatDuration";
import ProcessData from "../../utils/ProcessData";
import CaseDistributionCharts from "../graph/ui/CaseDistributionCharts";
import PersianRangeDatePicker from "./RangeDatePicker";

interface SearchCaseIdsCardProps {
  filters: FilterTypes;
  filePath: string;
  onCaseFound?: (pathData: ExtendedPath, index: number) => void;
  onSearchResult?: (data: SearchCaseIdsData | null) => void;
}

interface DateRange {
  start: DateValue | null;
  end: DateValue | null;
}

export default function SearchCaseIdsCard({
  filters,
  filePath,
  onCaseFound,
  onSearchResult,
}: SearchCaseIdsCardProps) {
  const [caseIdInput, setCaseIdInput] = useState<number>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchResult, setSearchResult] = useState<SearchCaseIdsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // --- Local States for Date Filtering ---
  const [localDateRange, setLocalDateRange] = useState<DateRange | null>(null);
  const [searchAllData, setSearchAllData] = useState<boolean>(false);

  // تبدیل DateValue به رشته ISO برای ارسال به بک‌اند
  const getISOString = (dateValue: DateValue | null): string => {
    if (!dateValue) return "";
    const date = new Date(dateValue.year, dateValue.month - 1, dateValue.day);
    // تنظیم منطقه زمانی برای جلوگیری از شیفت روز
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    return date.toISOString().split("T")[0];
  };

  const submit = async () => {
    if (!caseIdInput) {
      setError("لطفاً شناسه پرونده را وارد کنید.");
      return;
    }

    // اعتبارسنجی تاریخ (اگر تیک تمام داده‌ها نخورده باشد)
    if (!searchAllData && (!localDateRange?.start || !localDateRange?.end)) {
        setError("لطفاً بازه زمانی جستجو را مشخص کنید یا گزینه 'تمام داده‌ها' را فعال کنید.");
        return;
    }

    const caseIdNum = Number(caseIdInput);
    setIsLoading(true);
    setError(null);
    setSearchResult(null);

    try {
      // ساخت فیلتر اختصاصی برای این درخواست
      // ما کپی فیلترهای اصلی را می‌گیریم ولی بازه زمانی را تغییر می‌دهیم
      const requestFilters: FilterTypes = {
        ...filters,
        dateRange: searchAllData 
            ? { start: "", end: "" } // ارسال رشته خالی به معنی نادیده گرفتن بازه زمانی در پایتون
            : { 
                start: getISOString(localDateRange!.start), 
                end: getISOString(localDateRange!.end) 
              },
      };

      const response = (await ProcessData(filePath, requestFilters, caseIdNum)) as SearchCaseIdsData;
      setSearchResult(response);
      
      if (onSearchResult) onSearchResult(response);

      if (response.found && response.data && response.data.nodes.length > 0) {
        if (onCaseFound) {
          // --- Logic for preparing path visualization ---
          const edgeStats: Record<string, { sum: number; count: number }> = {};
          const nodes = response.data.nodes;
          const durations = response.data.edge_durations;
          for (let i = 0; i < nodes.length - 1; i++) {
             const source = nodes[i];
             const target = nodes[i+1];
             const edgeId = `${source}->${target}`; 
             const duration = durations[i];
             if (duration !== undefined) {
                 if (!edgeStats[edgeId]) edgeStats[edgeId] = { sum: 0, count: 0 };
                 edgeStats[edgeId].sum += duration;
                 edgeStats[edgeId].count += 1;
             }
          }
          const specificDurations: Record<string, number> = {};
          Object.keys(edgeStats).forEach((edgeId) => {
              const stat = edgeStats[edgeId];
              specificDurations[edgeId] = stat.sum / stat.count;
          });
          const pathForGraph: ExtendedPath = {
            nodes: response.data.nodes,
            edges: Object.keys(specificDurations), 
            averageDuration: response.data.total_duration,
            _frequency: 1,
            _startIndex: 0,
            _endIndex: response.data.nodes.length - 1,
            _pathType: "absolute",
            _fullPathNodes: response.data.nodes,
            _variantTimings: response.data.edge_durations,
            _specificEdgeDurations: specificDurations, 
          };
          onCaseFound(pathForGraph, 0);
        }
      } else {
        setError("پرونده‌ای با این شناسه در محدوده انتخابی یافت نشد.");
      }
    } catch (err: any) {
       console.error(err);
       setError("خطایی در دریافت اطلاعات رخ داد.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") submit();
  };

  const renderPerformanceStats = () => {
    if (!searchResult?.data?.position_stats) return null;
    
    const stats = searchResult.data.position_stats;
    const isCritical = stats.duration_percentile > 80;
    const isWarning = stats.duration_percentile > 50 && stats.duration_percentile <= 80;
    
    let styleClass = "bg-slate-50 text-slate-600 border-slate-200";
    let icon = <Info size={16} />;
    let title = "عملکرد نرمال";
    let desc = "زمان اجرای این پرونده در محدوده میانگین است.";

    if (isCritical) {
        styleClass = "bg-rose-50 text-rose-700 border-rose-200";
        icon = <AlertCircle size={16} />;
        title = "عملکرد بحرانی (کند)";
        desc = `این پرونده از ${stats.duration_percentile.toFixed(0)}٪ کل پرونده‌ها کندتر است.`;
    } else if (isWarning) {
        styleClass = "bg-amber-50 text-amber-700 border-amber-200";
        icon = <TrendingUp size={16} />;
        title = "کندتر از میانگین";
        desc = `این پرونده از ${stats.duration_percentile.toFixed(0)}٪ پرونده‌ها طولانی‌تر شده است.`;
    } else {
        styleClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
        icon = <TrendingDown size={16} />;
        title = "عملکرد سریع";
        desc = `این پرونده سریع‌تر از ${(100 - stats.duration_percentile).toFixed(0)}٪ موارد مشابه انجام شده است.`;
    }

    return (
        <div className={`mt-2 p-3 rounded-xl border ${styleClass} flex flex-col gap-1`}>
            <div className="flex items-center gap-2 font-bold text-xs">
                {icon}
                <span>{title}</span>
            </div>
            <p className="text-[11px] opacity-90 leading-5">
                {desc}
                {stats.is_slower_than_average && isCritical && (
                    <span className="block mt-1 font-semibold opacity-100">• زمان کل بیشتر از میانگین جامعه آماری است.</span>
                )}
            </p>
        </div>
    );
  };

  return (
    <div className="flex flex-col h-full gap-3">
        {/* هدر و عنوان */}
        {/* <div className="flex items-center gap-2 px-1 shrink-0">
            <div className="p-2 bg-gradient-to-br from-blue-100 to-blue-200 text-blue-600 rounded-xl shadow-sm">
                <FolderSearch size={20} />
            </div>
            <div>
                <h3 className="font-bold text-sm text-slate-800">جستجوی پرونده</h3>
                <span className="text-[10px] text-slate-400 block">رهگیری و تحلیل مورد خاص</span>
            </div>
        </div> */}

        {/* پنل تنظیمات جستجو */}
        <div className="flex flex-col gap-3 shrink-0 bg-white border border-slate-200 rounded-2xl p-3 shadow-sm relative overflow-hidden">
            {/* نوار رنگی بالای کارت */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 to-indigo-400 opacity-80" />

            {/* بخش انتخاب بازه زمانی */}
            <div className="flex flex-col gap-2 mt-1">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-slate-500">
                        <CalendarSearch size={14} />
                        <span className="text-xs font-bold">بازه زمانی جستجو</span>
                    </div>
                    <Checkbox 
                        size="sm" 
                        isSelected={searchAllData} 
                        onValueChange={setSearchAllData}
                        classNames={{
                            label: "text-[10px] text-slate-500 font-medium mr-1",
                            wrapper: "before:border-slate-300 group-data-[selected=true]:before:bg-blue-500",
                        }}
                    >
                        جستجو در تمام داده‌ها
                    </Checkbox>
                </div>

                <div className={`transition-all duration-300 ${searchAllData ? "opacity-40 pointer-events-none grayscale" : "opacity-100"}`}>
                    <PersianRangeDatePicker
                        onChange={setLocalDateRange}
                        value={localDateRange || undefined}
                        placeholder={{ start: "از تاریخ", end: "تا تاریخ" }}
                        isInvalid={!!error && !searchAllData && (!localDateRange?.start || !localDateRange?.end)}
                        isRequired={!searchAllData}
                    />
                </div>
            </div>

            <Divider className="bg-slate-100" />

            {/* ورودی شماره پرونده */}
            <div className="flex gap-2">
                <NumberInput
                    placeholder="شماره پرونده (Case ID)"
                    value={caseIdInput}
                    onValueChange={setCaseIdInput}
                    onKeyDown={handleKeyDown}
                    isDisabled={isLoading}
                    formatOptions={{ useGrouping: false }}
                    minValue={0}
                    hideStepper
                    isClearable
                    variant="faded"
                    size="sm"
                    labelPlacement="outside"
                    classNames={{ 
                        inputWrapper: "h-10 bg-slate-50 hover:bg-slate-100 focus-within:bg-white border-slate-200 shadow-none transition-colors", 
                        input: "text-right   font-medium text-slate-700 placeholder:font-vazir" 
                    }}
                    startContent={<span className="text-slate-400 text-xs   border-r border-slate-200 pr-2 mr-1">#</span>}
                />
                <Button 
                    isIconOnly 
                    color="primary" 
                    variant="shadow" 
                    onPress={submit} 
                    isLoading={isLoading} 
                    size="sm" 
                    className="h-10 w-12 min-w-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/20"
                >
                    {!isLoading && <Search size={18} />}
                </Button>
            </div>

            {error && (
                <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 text-[11px] flex items-center gap-2 border border-rose-100/50 animate-appearance-in">
                    <XCircle size={14} className="shrink-0" />
                    <span>{error}</span>
                </div>
            )}
        </div>

        {/* کانتینر اصلی نتایج با اسکرول */}
        <div className="flex-1 min-h-0 relative bg-slate-50/50 rounded-2xl border border-slate-200/60 overflow-hidden flex flex-col">
        {searchResult?.found && searchResult.data ? (
            <div className="flex flex-col h-full overflow-y-auto p-2 scrollbar-hide">
            
            {/* بخش هدر نتایج */}
            <div className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm shrink-0 mb-2">
                <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                        <CheckCircle2 size={14} />
                    </div>
                    <span className="text-xs font-bold text-slate-700">پرونده یافت شد</span>
                </div>
                <Chip size="sm" variant="flat" className="bg-slate-100 text-slate-600 border border-slate-200 h-6 text-[10px]   ltr">
                    ID: {searchResult.data.case_id}
                </Chip>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-center gap-2">
                    <div className="p-1 bg-white text-emerald-600 rounded border border-slate-100 shadow-sm"><Clock size={12} /></div>
                    <div className="flex flex-col">
                        <span className="text-[9px] text-slate-400">مدت زمان</span>
                        <span className="text-[11px] font-bold text-slate-700   dir-ltr text-right">{formatDuration(searchResult.data.total_duration)}</span>
                    </div>
                </div>
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-center gap-2">
                    <div className="p-1 bg-white text-blue-600 rounded border border-slate-100 shadow-sm"><MapPin size={12} /></div>
                    <div className="flex flex-col">
                        <span className="text-[9px] text-slate-400">طول مسیر</span>
                        <span className="text-[11px] font-bold text-slate-700">{searchResult.data.nodes.length} فعالیت</span>
                    </div>
                </div>
                </div>
            </div>

            {/* آکاردئون‌ها */}
            <Accordion 
                keepContentMounted
                defaultExpandedKeys={["1"]}
                variant="splitted"
                className="px-0 gap-2"
                itemClasses={{
                    base: "group bg-white border border-slate-100 shadow-sm rounded-xl px-0 data-[open=true]:border-blue-200",
                    title: "text-xs font-bold text-slate-700",
                    trigger: "py-2.5 px-3 data-[hover=true]:bg-slate-50",
                    indicator: "text-slate-400 text-xs",
                    content: "pb-3 px-1"
                }}
            >
                {/* بخش ۱: تحلیل و نمودار */}
                <AccordionItem 
                    key="1" 
                    aria-label="Charts" 
                    title={
                        <div className="flex items-center gap-2">
                            <Activity size={16} className="text-indigo-500" />
                            <span>تحلیل آماری و نمودارها</span>
                        </div>
                    }
                >
                    <div className="px-1 flex flex-col gap-3">
                        {renderPerformanceStats()}
                        
                        <div className="h-[420px] w-full border border-slate-100 rounded-xl overflow-hidden bg-slate-50/30">
                            <CaseDistributionCharts 
                                searchResult={searchResult} 
                                filePath={filePath} 
                                filters={{
                                    ...filters,
                                    dateRange: searchAllData ? {start: "", end: ""} : filters.dateRange
                                }}
                            />
                        </div>
                    </div>
                </AccordionItem>

                {/* بخش ۲: مسیر زمانی (Timeline) */}
                <AccordionItem 
                    key="2" 
                    aria-label="Timeline" 
                    title={
                        <div className="flex items-center gap-2">
                            <ListStart size={16} className="text-slate-500" />
                            <span>مسیر زمانی پرونده</span>
                        </div>
                    }
                >
                    <div className="px-2 pt-1">
                        <div className="relative pl-2 pr-4 py-2 border-r-2 border-slate-100 mr-2 space-y-0.5">
                            {searchResult.data.nodes.map((node, index) => {
                                const isLast = index === searchResult.data!.nodes.length - 1;
                                const isFirst = index === 0;
                                const duration = !isLast ? searchResult.data!.edge_durations[index] : null;
                                return (
                                    <div key={index} className="relative pb-4 last:pb-0">
                                        {/* خط اتصال */}
                                        {!isLast && <div className="absolute top-3 bottom-0 right-[6.5px] w-0.5 bg-slate-200" />}
                                        
                                        <div className="flex items-start gap-3 relative z-10">
                                            {/* دایره نشانگر */}
                                            <div className={`w-3.5 h-3.5 rounded-full border-[3px] shrink-0 bg-white mt-1 z-20 transition-colors 
                                                ${isFirst ? 'border-emerald-500 ring-2 ring-emerald-50' : 
                                                  isLast ? 'border-rose-500 ring-2 ring-rose-50' : 'border-blue-300'}`} 
                                            />
                                            
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className={`text-[11px] leading-tight ${isFirst || isLast ? 'font-bold text-slate-800' : 'font-medium text-slate-600'}`}>
                                                        {node}
                                                    </span>
                                                    {isFirst && <span className="text-[8px] px-1.5 py-px bg-emerald-100 text-emerald-700 rounded-md font-bold">شروع</span>}
                                                    {isLast && <span className="text-[8px] px-1.5 py-px bg-rose-100 text-rose-700 rounded-md font-bold">پایان</span>}
                                                </div>

                                                {/* نمایش زمان */}
                                                {!isLast && duration !== undefined && (
                                                    <div className="flex justify-start mt-1.5">
                                                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-[9px] text-slate-500   shadow-sm">
                                                            <ArrowDown size={8} />
                                                            {formatDuration(duration)}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </AccordionItem>
            </Accordion>

            </div>
        ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center opacity-50">
                <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center">
                    {searchAllData ? <History size={32} className="text-slate-400" /> : <FileText size={32} className="text-slate-400" />}
                </div>
                <div>
                    <p className="text-sm font-bold text-slate-600 mb-1">آماده جستجو</p>
                    <p className="text-xs text-slate-400 leading-5 max-w-[200px] mx-auto">
                        شماره پرونده را وارد کنید تا مسیر دقیق و تحلیل زمانی آن نمایش داده شود.
                    </p>
                </div>
            </div>
        )}
        </div>
    </div>
  );
}