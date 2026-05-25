// فایل FrontEnd/src/components/Navbar.tsx را با این کد کامل، یکپارچه و بهینه جایگزین کن:

import { useState, useEffect, useCallback } from "react";
import { Button } from "@heroui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@heroui/popover";
import { Chip } from "@heroui/chip";
import { Checkbox } from "@heroui/checkbox";
import { SlidersHorizontal, Filter, CalendarRange, ListFilter, Check, Plus, Minus } from "lucide-react";
import moment from "moment-jalaali";
import { DateValue, parseDate } from "@internationalized/date";
import PersianRangeDatePicker from "./sideBarCards/RangeDatePicker";
import { FilterTypes, DimensionSchema } from "../types/types";
import { useAppStore } from "@/hooks/useAppStore";
import { useGraphStore } from "@/store/useGraphStore";
import api from "@/utils/fetcher";

moment.loadPersian({ dialect: "persian-modern", usePersianDigits: false });

interface NavbarProps {
  onFilterUpdate: (filters: FilterTypes) => void;
  isLoading?: boolean;
  currentFilters: FilterTypes | null;
}

export default function Navbar({ onFilterUpdate, isLoading = false, currentFilters }: NavbarProps) {
  const { setIsLoading, setProcessedData } = useAppStore();
  const { processInitialData } = useGraphStore();

  const [schema, setSchema] = useState<DimensionSchema | null>(null);
  const [schemaLoading, setSchemaLoading] = useState(true);

  const [dateRange, setDateRange] = useState<{ start: DateValue | null; end: DateValue | null }>({ start: null, end: null });
  const [isTimeFilterOpen, setIsTimeFilterOpen] = useState(false);
  const [isDimensionFilterOpen, setIsDimensionFilterOpen] = useState(false);
  const [isCourtKindsFilterOpen, setIsCourtKindsFilterOpen] = useState(false); // 🟢

  const [scopedDimensionOptions, setScopedDimensionOptions] = useState<Record<string, string[]>>({ root: [] });
  const [workingDimensions, setWorkingDimensions] = useState<Record<string, string[]>>({});
  const [selectedDimensions, setSelectedDimensions] = useState<Record<string, string[]>>({});
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // 🟢 استیت‌های جدید اختصاصی فیلتر صلاحیت شعبه
  const [courtKindsOptions, setCourtKindsOptions] = useState<string[]>([]);
  const [workingCourtKinds, setWorkingCourtKinds] = useState<string[]>([]);
  const [selectedCourtKinds, setSelectedCourtKinds] = useState<string[]>([]);
  const [courtKindsSearch, setCourtKindsSearch] = useState("");

  useEffect(() => {
    let active = true;
    // الف) بارگذاری اسکیما
    api.graph.getSchema()
      .then((schemaData) => {
        if (!active) return;
        setSchema(schemaData);
        const emptyDimensions: Record<string, string[]> = {};
        schemaData.levels.forEach((level) => { emptyDimensions[level.key] = []; });
        setWorkingDimensions(emptyDimensions);
        setSelectedDimensions(emptyDimensions);
      })
      .catch((error) => { console.error("Error loading schema:", error); })
      .finally(() => { if (active) setSchemaLoading(false); });

    // ب) بارگذاری صلاحیت‌های شعبه
    api.graph.getCourtKinds().then((data) => {
      if (active) setCourtKindsOptions(data);
    });

    return () => { active = false; };
  }, []);

  // بارگذاری لایه اول درخت پس از دریافت اسکیما
  useEffect(() => {
    if (!schema) return;
    let active = true;
    const rootLevelKey = schema.levels[0]?.key;
    if (!rootLevelKey) return;

    api.graph.getDimensions()
      .then((data) => {
        if (!active) return;
        const cleanRoot = (data[rootLevelKey] || [])
          .map((opt: any) => (opt !== null && opt !== undefined ? String(opt) : ""))
          .filter((opt: string) => opt.trim() !== "");
        setScopedDimensionOptions((prev) => ({ ...prev, root: cleanRoot }));
      })
      .catch((error) => { console.error("Error loading root dimensions:", error); });
    return () => { active = false; };
  }, [schema]);

  // همگام‌سازی و بازیابی وضعیت فیلترها
  useEffect(() => {
    if (!currentFilters) return;
    try {
      if (currentFilters.dateRange.start && currentFilters.dateRange.end) {
        setDateRange({
          start: parseDate(currentFilters.dateRange.start),
          end: parseDate(currentFilters.dateRange.end),
        });
      }
    } catch (e) { console.error("Error parsing dates", e); }

    if (schema) {
      const restored: Record<string, string[]> = {};
      schema.levels.forEach((level) => {
        restored[level.key] = currentFilters.dimensionFilters?.[level.key] ?? [];
      });
      setSelectedDimensions(restored);
    }
    setSelectedCourtKinds(currentFilters.courtKinds ?? []); // 🟢
  }, [currentFilters, schema]);

  useEffect(() => {
    if (!isDimensionFilterOpen || !currentFilters || !schema) return;
    const restored: Record<string, string[]> = {};
    schema.levels.forEach((level) => {
      restored[level.key] = currentFilters.dimensionFilters?.[level.key] ?? [];
    });
    setWorkingDimensions(restored);
  }, [isDimensionFilterOpen, currentFilters, schema]);

  // 🟢 بازیابی صلاحیت‌ها در زمان باز شدن پاپ‌اور
  useEffect(() => {
    if (isCourtKindsFilterOpen && currentFilters) {
      setWorkingCourtKinds(currentFilters.courtKinds ?? []);
      setCourtKindsSearch("");
    }
  }, [isCourtKindsFilterOpen, currentFilters]);

  const loadGraph = useCallback(async (filtersToUse: FilterTypes) => {
    if (!filtersToUse) return;
    setIsLoading(true);
    try {
      const data = await api.graph.getData(filtersToUse);
      setProcessedData({
        graphData: data.graphData, variants: data.variants, outliers: data.outliers,
        startActivities: data.startActivities, endActivities: data.endActivities,
      });
      processInitialData(data.graphData, data.startActivities, data.endActivities);
    } catch (error) { console.error("Error loading graph:", error); } 
    finally { setIsLoading(false); }
  }, [setIsLoading, setProcessedData, processInitialData]);

  const getDimensionBadgeLabel = () => {
    if (!schema) return "در حال بارگذاری...";
    const rootOptions = scopedDimensionOptions.root || [];
    const selectedRoot = workingDimensions[schema.levels[0]?.key] || [];
    if (rootOptions.length > 0 && selectedRoot.length === rootOptions.length) return "همه موارد";

    for (let i = schema.levels.length - 1; i >= 0; i--) {
      const levelKey = schema.levels[i].key;
      const currentLevelValues = workingDimensions[levelKey] || [];
      if (currentLevelValues.length > 0) return `${currentLevelValues.length} مورد`;
    }
    return "بدون انتخاب";
  };

  // 🟢 تولید برچسب دکمه صلاحیت شعبه
  const getCourtKindsBadgeLabel = () => {
    if (courtKindsOptions.length > 0 && workingCourtKinds.length === courtKindsOptions.length) return "همه موارد";
    if (workingCourtKinds.length > 0) return `${workingCourtKinds.length} صلاحیت`;
    return "بدون انتخاب";
  };

  const getDateLabel = () => {
    if (dateRange.start && dateRange.end) {
      const start = moment(new Date(dateRange.start.year, dateRange.start.month - 1, dateRange.start.day)).format("jYYYY/jMM/jDD");
      const end = moment(new Date(dateRange.end.year, dateRange.end.month - 1, dateRange.end.day)).format("jYYYY/jMM/jDD");
      return `${start} - ${end}`;
    }
    return "انتخاب بازه";
  };

  const toggleSelectedNode = (levelKey: string, option: string, levelIndex: number, parentPath: string[]) => {
    if (!schema) return;
    const nodePath = [...parentPath, option];
    const isChecking = !workingDimensions[levelKey]?.includes(option);

    setWorkingDimensions((prev) => {
      const updated = { ...prev };
      const cascade = (idx: number, path: string[]) => {
        if (!schema || idx >= schema.levels.length) return;
        const lvlKey = schema.levels[idx].key;
        const pathStr = path.join("|");
        const childOptions = scopedDimensionOptions[pathStr] || [];
        if (isChecking) {
          updated[lvlKey] = Array.from(new Set([...(updated[lvlKey] || []), ...childOptions]));
        } else {
          updated[lvlKey] = (updated[lvlKey] || []).filter((opt) => !childOptions.includes(opt));
        }
        childOptions.forEach((childOpt) => { cascade(idx + 1, [...path, childOpt]); });
      };

      if (isChecking) {
        updated[levelKey] = Array.from(new Set([...(prev[levelKey] || []), option]));
        cascade(levelIndex + 1, nodePath);
      } else {
        updated[levelKey] = (prev[levelKey] || []).filter((item) => item !== option);
        cascade(levelIndex + 1, nodePath);
        for (let i = 0; i < levelIndex; i++) {
          const parentLevelKey = schema.levels[i].key;
          const parentValue = parentPath[i];
          updated[parentLevelKey] = (updated[parentLevelKey] || []).filter((item) => item !== parentValue);
        }
      }
      return updated;
    });
  };

  const toggleNodeExpand = async (levelKey: string, option: string, levelIndex: number, parentPath: string[]) => {
    if (!schema) return;
    const currentPath = [...parentPath, option];
    const pathKey = currentPath.join("|");
    const nodeKey = `${levelKey}_${pathKey}`;
    setExpandedNodes((prev) => ({ ...prev, [nodeKey]: !prev[nodeKey] }));

    if (!scopedDimensionOptions[pathKey]) {
      const nextLevelIndex = levelIndex + 1;
      if (nextLevelIndex < schema.levels.length) {
        const nextLevelKey = schema.levels[nextLevelIndex].key;
        const apiFilters: Record<string, string[]> = {};
        for (let i = 0; i <= levelIndex; i++) { apiFilters[schema.levels[i].key] = [currentPath[i]]; }

        try {
          const data = await api.graph.getDimensions(apiFilters);
          const fetchedOptions = (data[nextLevelKey] || [])
            .map((opt: any) => (opt !== null && opt !== undefined ? String(opt) : ""))
            .filter((opt: string) => opt.trim() !== "");

          setScopedDimensionOptions((prev) => ({ ...prev, [pathKey]: fetchedOptions }));
          setWorkingDimensions((prevSel) => {
            if (prevSel[levelKey]?.includes(option) && fetchedOptions.length > 0) {
              return { ...prevSel, [nextLevelKey]: Array.from(new Set([...(prevSel[nextLevelKey] || []), ...fetchedOptions])) };
            }
            return prevSel;
          });
        } catch (error) { console.error("Error fetching children:", pathKey, error); }
      }
    }
  };

  const handleApply = () => {
    if (!dateRange.start || !dateRange.end || !schema) return;
    const startIso = dateRange.start.toString();
    const endIso = dateRange.end.toString();

    const newFilters: FilterTypes = {
      ...currentFilters,
      dateRange: { start: startIso, end: endIso },
      dimensionFilters: workingDimensions,
      courtKinds: workingCourtKinds, // 🟢 کامیت صلاحیت‌های جدید
    };

    setSelectedDimensions(workingDimensions);
    setSelectedCourtKinds(workingCourtKinds); // 🟢

    onFilterUpdate(newFilters);
    setIsTimeFilterOpen(false);
    setIsDimensionFilterOpen(false);
    setIsCourtKindsFilterOpen(false); // 🟢
    loadGraph(newFilters);
  };

  const renderDimensionTree = (levelIndex: number, parentPath: string[] = []) => {
    if (!schema || levelIndex >= schema.levels.length) return null;
    const levelInfo = schema.levels[levelIndex];
    const pathKey = parentPath.join("|") || "root";
    const currentOptions = scopedDimensionOptions[pathKey] || [];
    const currentSelected = workingDimensions[levelInfo.key] || [];

    if (!currentOptions.length) {
      if (levelIndex === 0) return <div className="text-slate-400 text-[11px] py-4 text-center">در حال بارگذاری سطوح اصلی...</div>;
      return null;
    }

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {currentOptions.map((option) => {
          const currentPath = [...parentPath, option];
          const childPathKey = currentPath.join("|");
          const nodeKey = `${levelInfo.key}_${childPathKey}`;
          const isExpanded = expandedNodes[nodeKey] || false;
          const isChecked = currentSelected.includes(option);
          
          const nextLevelIndex = levelIndex + 1;
          const nextLevelInfo = nextLevelIndex < schema.levels.length ? schema.levels[nextLevelIndex] : null;
          const childOptions = scopedDimensionOptions[childPathKey];
          const hasLoadedChildren = childOptions !== undefined;
          const hasValidChildren = hasLoadedChildren && childOptions.length > 0;
          
          const nextSelected = nextLevelInfo ? workingDimensions[nextLevelInfo.key] || [] : [];
          const isAnyChildSelected = hasValidChildren && childOptions.some(opt => nextSelected.includes(opt));
          const isIndeterminate = !isChecked && isAnyChildSelected;
          const showExpandButton = levelIndex < schema.levels.length - 1 && (!hasLoadedChildren || hasValidChildren);

          return (
            <div key={option} className={`flex flex-col w-full relative ${levelIndex > 0 ? "pr-3 mr-1.5 border-r border-slate-200/40 mt-1" : ""}`}>
              <div className="w-full flex items-center justify-between bg-white/40 backdrop-blur-md border border-white/60 rounded-xl p-2 transition-all duration-300 hover:bg-white/80 shadow-sm gap-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    isSelected={isChecked} isIndeterminate={isIndeterminate} radius="md" size="sm" color="primary"
                    onValueChange={() => toggleSelectedNode(levelInfo.key, option, levelIndex, parentPath)}
                    classNames={{ wrapper: "before:border-slate-300 mr-1" }}
                  />
                  <span className="text-xs font-semibold text-slate-700 select-none truncate max-w-[220px]">{option}</span>
                </div>
                {showExpandButton && (
                  <Button
                    isIconOnly size="sm" variant="light" className="w-7 h-7 min-w-7 rounded-lg text-slate-500 hover:bg-blue-50/80 hover:text-blue-600 transition-colors"
                    onPress={() => toggleNodeExpand(levelInfo.key, option, levelIndex, parentPath)}
                  >
                    {isExpanded ? <Minus size={12} strokeWidth={2.5} /> : <Plus size={12} strokeWidth={2.5} />}
                  </Button>
                )}
              </div>
              {isExpanded && hasValidChildren && (
                <div className="mt-1.5 w-full">{renderDimensionTree(levelIndex + 1, currentPath)}</div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // فیلتراسیون کلاینت صلاحیت‌ها بر اساس فیلد سرچ
  const filteredCourtKinds = courtKindsOptions.filter(kind => 
    kind.toLowerCase().includes(courtKindsSearch.toLowerCase())
  );

  return (
    <div className="w-full h-16 bg-white/80 backdrop-blur-xl rounded-2xl border border-slate-200/60 shadow-sm px-4 flex gap-x-4 items-center z-30 relative transition-all duration-300">
      <div className="flex items-center gap-3 border-l pl-3 border-slate-300">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
          <SlidersHorizontal size={20} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* ۱. پاپ‌اور فیلتر زمان */}
        <Popover
          isOpen={isTimeFilterOpen}
          onOpenChange={(open) => {
            setIsTimeFilterOpen(open);
            if (open) { setIsDimensionFilterOpen(false); setIsCourtKindsFilterOpen(false); }
          }}
          placement="bottom" offset={10} showArrow backdrop="transparent"
          shouldCloseOnInteractOutside={(el) => !el.closest("[data-slot='content'][data-open],[role='dialog'],[role='listbox'],.heroui-popover-content,[data-dismissable-layer]")}
        >
          <PopoverTrigger>
            <Button variant="flat" className="h-10 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl px-4 min-w-[220px] justify-between group hover:bg-white hover:border-blue-300 hover:shadow-md transition-all duration-300">
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
                <span className="text-xs font-bold text-slate-700">فیلترهای زمان</span>
              </div>
              <div dir="ltr" className="flex items-center gap-1.5">
                {dateRange.start && <Chip size="sm" variant="flat" className="h-5 bg-blue-100 text-blue-700 border border-blue-200 text-[10px] px-1">{getDateLabel()}</Chip>}
              </div>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="text-right w-[320px] p-0 border border-slate-100 shadow-2xl rounded-2xl max-h-[80vh] overflow-y-auto">
            <div dir="ltr" className="flex flex-col min-h-0">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                <div className="p-1.5 bg-white border border-slate-200 rounded-lg shadow-sm"><ListFilter size={14} className="text-slate-400" /></div>
                <span className="text-xs font-bold text-slate-700">فیلترهای زمان</span>
              </div>
              <div className="p-4 flex flex-col gap-5 bg-white overflow-y-auto min-h-0 max-h-[calc(80vh-120px)]">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-slate-500 mb-1">
                    <CalendarRange size={14} className="text-blue-500" />
                    <span className="text-[11px] font-bold">بازه زمانی</span>
                  </div>
                  <PersianRangeDatePicker value={dateRange} onChange={setDateRange} placeholder={{ start: "شروع...", end: "پایان..." }} />
                </div>
              </div>
              <div className="p-3 border-t border-slate-100 bg-slate-50 flex gap-2 justify-end">
                <Button size="sm" variant="light" color="danger" onPress={() => setIsTimeFilterOpen(false)} className="text-xs font-medium h-8">انصراف</Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* ۲. پاپ‌اور فیلتر ابعاد (درخت پویای Lazy log) */}
        <Popover
          isOpen={isDimensionFilterOpen}
          onOpenChange={(open) => {
            setIsDimensionFilterOpen(open);
            if (open) { setIsTimeFilterOpen(false); setIsCourtKindsFilterOpen(false); }
          }}
          placement="bottom" offset={10} showArrow backdrop="transparent"
          shouldCloseOnInteractOutside={(el) => !el.closest("[data-slot='content'][data-open],[role='dialog'],[role='listbox'],.heroui-popover-content,[data-dismissable-layer]")}
        >
          <PopoverTrigger>
            <Button variant="flat" className="h-10 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl px-4 min-w-[220px] justify-between group hover:bg-white hover:border-blue-300 hover:shadow-md transition-all duration-300">
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
                <span className="text-xs font-bold text-slate-700">فیلتر ابعاد</span>
              </div>
              <div dir="ltr" className="flex items-center gap-1.5">
                <Chip size="sm" variant="flat" className="h-5 bg-slate-100 text-slate-600 border border-slate-200 text-[10px] px-1 font-bold">{getDimensionBadgeLabel()}</Chip>
              </div>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="text-right w-[360px] p-0 border border-white/40 bg-white/70 backdrop-blur-xl shadow-2xl rounded-2xl max-h-[80vh] overflow-y-auto">
            <div dir="rtl" className="flex flex-col min-h-0 w-full">
              <div className="px-4 py-3 border-b border-slate-200/50 bg-white/40 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-700">ساختار درختی ابعاد</span>
                <div className="p-1.5 bg-white/80 border border-slate-200/60 rounded-lg shadow-sm"><ListFilter size={14} className="text-slate-500" /></div>
              </div>
              <div className="p-4 space-y-3 overflow-y-auto min-h-0 max-h-[calc(80vh-120px)]">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200/40">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Filter size={14} className="text-blue-500" />
                    <span className="text-[11px] font-bold">انتخاب بر اساس سطوح دیتای واقعی</span>
                  </div>
                  <Chip size="sm" variant="flat" className="h-5 bg-blue-50 text-blue-600 border border-blue-100 text-[10px] font-bold px-1">{getDimensionBadgeLabel()}</Chip>
                </div>
                <div className="space-y-2">{renderDimensionTree(0)}</div>
              </div>
              <div className="p-3 border-t border-slate-200/50 bg-white/40 flex gap-2 justify-between">
                <Button size="sm" variant="light" color="danger" onPress={() => { if (schema) { const cleared: Record<string, string[]> = {}; schema.levels.forEach(level => { cleared[level.key] = []; }); setWorkingDimensions(cleared); setExpandedNodes({}); } }} className="text-xs font-medium h-8">پاک کردن</Button>
                <Button size="sm" variant="light" color="danger" onPress={() => setIsDimensionFilterOpen(false)} className="text-xs font-medium h-8">انصراف</Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* 🟢 ۳. پاپ‌اور جدید فیلتر صلاحیت شعبه با سرچ‌بار و دیزاین گلس‌مورفیسم */}
        <Popover
          isOpen={isCourtKindsFilterOpen}
          onOpenChange={(open) => {
            setIsCourtKindsFilterOpen(open);
            if (open) { setIsTimeFilterOpen(false); setIsDimensionFilterOpen(false); }
          }}
          placement="bottom" offset={10} showArrow backdrop="transparent"
          shouldCloseOnInteractOutside={(el) => !el.closest("[data-slot='content'][data-open],[role='dialog'],[role='listbox'],.heroui-popover-content,[data-dismissable-layer]")}
        >
          <PopoverTrigger>
            <Button variant="flat" className="h-10 bg-slate-50 border border-slate-200 text-slate-600 rounded-xl px-4 min-w-[200px] justify-between group hover:bg-white hover:border-blue-300 hover:shadow-md transition-all duration-300">
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-slate-400 group-hover:text-blue-500 transition-colors" />
                <span className="text-xs font-bold text-slate-700">صلاحیت شعبه</span>
              </div>
              <div dir="ltr" className="flex items-center gap-1.5">
                <Chip size="sm" variant="flat" className="h-5 bg-slate-100 text-slate-600 border border-slate-200 text-[10px] px-1 font-bold">{getCourtKindsBadgeLabel()}</Chip>
              </div>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="text-right w-[340px] p-0 border border-white/40 bg-white/70 backdrop-blur-xl shadow-2xl rounded-2xl max-h-[80vh] overflow-y-auto">
            <div dir="rtl" className="flex flex-col min-h-0 w-full">
              <div className="px-4 py-3 border-b border-slate-200/50 bg-white/40 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-700">فیلتر صلاحیت شعبه</span>
                <div className="p-1.5 bg-white/80 border border-slate-200/60 rounded-lg shadow-sm"><ListFilter size={14} className="text-slate-500" /></div>
              </div>

              <div className="p-4 space-y-3 flex flex-col min-h-0">
                {/* کادر سرچ صلاحیت‌ها */}
                <input
                  type="text" placeholder="جستجوی صلاحیت..." value={courtKindsSearch} onChange={(e) => setCourtKindsSearch(e.target.value)}
                  className="w-full h-9 px-3 bg-white/50 backdrop-blur-sm border border-slate-200/60 rounded-xl text-xs font-medium text-slate-700 placeholder-slate-400 outline-none focus:border-blue-400 focus:bg-white transition-all duration-200 shadow-sm"
                />

                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 px-1 pt-1">
                  <div className="flex gap-3">
                    <button onClick={() => setWorkingCourtKinds(courtKindsOptions)} className="text-blue-600 hover:text-blue-700 hover:underline transition-all">انتخاب همه</button>
                    <button onClick={() => setWorkingCourtKinds([])} className="text-slate-400 hover:text-slate-600 hover:underline transition-all">پاک کردن همه</button>
                  </div>
                  <span className="text-slate-400 font-medium">{filteredCourtKinds.length} مورد</span>
                </div>

                {/* لیست چک‌باکس‌ها */}
                <div className="grid grid-cols-1 gap-1.5 max-h-52 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                  {filteredCourtKinds.length > 0 ? (
                    filteredCourtKinds.map((kind) => {
                      const isChecked = workingCourtKinds.includes(kind);
                      return (
                        <label key={kind} className="flex items-center gap-2 rounded-xl bg-white/40 backdrop-blur-sm border border-slate-200/30 px-3 py-2 text-slate-700 text-xs hover:bg-white/80 hover:border-slate-300/60 transition-all cursor-pointer shadow-sm">
                          <Checkbox
                            isSelected={isChecked} radius="md" size="sm" color="primary"
                            onValueChange={() => { setWorkingCourtKinds(prev => isChecked ? prev.filter(k => k !== kind) : [...prev, kind]); }}
                            classNames={{ wrapper: "before:border-slate-300 mr-1" }}
                          />
                          <span className="truncate select-none font-medium text-[11px]">{kind}</span>
                        </label>
                      );
                    })
                  ) : (
                    <div className="text-slate-400 text-[11px] py-4 text-center bg-slate-50/20 rounded-xl border border-dashed border-slate-200/40">صلاحیتی پیدا نشد.</div>
                  )}
                </div>
              </div>

              <div className="p-3 border-t border-slate-200/50 bg-white/40 flex gap-2 justify-end">
                <Button size="sm" variant="light" color="danger" onPress={() => setIsCourtKindsFilterOpen(false)} className="text-xs font-medium h-8">بستن</Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      
        <Button
          size="sm" color="primary" onPress={handleApply} isLoading={isLoading} isDisabled={!dateRange.start || !dateRange.end || schemaLoading}
          className="text-xs font-bold bg-blue-600 text-white shadow-md shadow-blue-500/20 h-10 px-4 rounded-xl" startContent={!isLoading ? <Check size={14} /> : undefined}
        >
          اعمال فیلترها
        </Button>
      </div>
    </div>
  );
}