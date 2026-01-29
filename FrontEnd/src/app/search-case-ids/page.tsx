'use client';

import { useState, useEffect, useCallback } from 'react'; // Activity حذف شد چون در react وجود ندارد
import { NumberInput } from '@heroui/number-input';
import { Button } from '@heroui/button';
import { Chip } from '@heroui/chip';
import { ScrollShadow } from "@heroui/scroll-shadow";
import {
  Search,
  XCircle,
  CheckCircle2,
  Activity as ActivityIcon,
  SquareActivity,
  ArrowDown,
  Timer,
  LayoutList,
  BarChart3,
  History
} from 'lucide-react';

import type { SearchCaseIdsData, ExtendedPath } from '@/types/types';
import { formatDuration } from '@/utils/formatDuration';
import { api } from '@/utils/fetcher';
import { useGraphStore } from '@/store/useGraphStore';
import CaseDistributionCharts from '@/components/graph/ui/CaseDistributionCharts';
import { useAppStore } from '@/hooks';

export default function SearchCaseIdsRoute() {
  // --- Global Store ---
  const { 
    filters, 
    graphData, 
    startEndNodes, 
    selectedColorPalette, 
    selectedNodeIds,
    setSelectedPathNodes, 
    setSelectedPathEdges,
    setSelectedPathIndex 
  } = useAppStore();  
  
  const graphStore = useGraphStore();

  // --- Local State ---
  const [caseIdInput, setCaseIdInput] = useState<number | undefined>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchResult, setSearchResult] = useState<SearchCaseIdsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"Timeline" | "Charts">("Timeline");

  // --- Effects (Cleanup & Setup) ---
  useEffect(() => {
    return () => {
      resetGraphState();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setCaseIdInput(undefined);
    setSearchResult(null);
    setError(null);
    resetGraphState();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetGraphState = () => {
    setSelectedPathNodes(new Set());
    setSelectedPathEdges(new Set());
    setSelectedPathIndex(null);
    graphStore.setActivePath(null);
    
    if (graphData && startEndNodes) {
      graphStore.computeLayout({
        graphData,
        colorPaletteKey: selectedColorPalette,
        startEndNodes: startEndNodes,
        filteredNodeIds: selectedNodeIds,
        filteredEdgeIds: null,
        activePathInfo: undefined,
        searchCasePathInfo: undefined,
      });
    }
  };

  const displayPathInGraph = useCallback((pathForGraph: ExtendedPath) => {
    graphStore.setActivePath(pathForGraph);
    setSelectedPathNodes(new Set(pathForGraph.nodes));
    setSelectedPathEdges(new Set(pathForGraph.edges));
    setSelectedPathIndex(0);
    
    const activePathInfo = {
      nodes: pathForGraph.nodes,
      edges: pathForGraph.edges,
      edgeDurations: pathForGraph._specificEdgeDurations || {},
      edgeTotalDurations: pathForGraph._specificTotalDurations || {},
      edgeCounts: pathForGraph._specificEdgeCounts || {},
      frequency: pathForGraph._frequency || 1,
    };

    
    if (graphData && startEndNodes) {
      graphStore.computeLayout({
        graphData: graphData,
        colorPaletteKey: selectedColorPalette,
        startEndNodes: startEndNodes,
        filteredNodeIds: new Set(pathForGraph.nodes),
        filteredEdgeIds: new Set(pathForGraph.edges),
        activePathInfo,
        searchCasePathInfo: undefined,
      });
    }
  }, [graphStore, setSelectedPathNodes, setSelectedPathEdges, setSelectedPathIndex, graphData, startEndNodes, selectedColorPalette]);

  // --- Actions ---
  const submit = async () => {
    if (!caseIdInput) {
      setError('لطفاً شناسه پرونده را وارد کنید.');
      return;
    }

    if (!filters?.dateRange.start || !filters.dateRange.end) {
      setError('بازه زمانی مشخص نشده است.');
      return;
    }

    const caseIdNum = Number(caseIdInput);
    setIsLoading(true);
    setError(null);
    setSearchResult(null);

    try {
      const response = await api.search.byId(caseIdNum, {
        startDate: filters.dateRange.start,
        endDate: filters.dateRange.end,
        includeGlobalStats: true,
      });

      setSearchResult(response);

      if (response.found && response.data && response.data.nodes.length > 0) {
        // ... (Logic پردازش دیتا همانند قبل) ...
        // برای خلاصه شدن کد اینجا تکرار نکردم چون تغییری نکرده
        // Process Path Data Logic Here
        const edgeStats: Record<string, { sum: number; count: number }> = {};
        const nodes = response.data.nodes;
        const durations = response.data.edge_durations;
        
        for (let i = 0; i < nodes.length - 1; i++) {
          const source = nodes[i];
          const target = nodes[i + 1];
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

        const specificTotalDurations: Record<string, number> = {};
        Object.keys(edgeStats).forEach((edgeId) => {
          const stat = edgeStats[edgeId];
          specificTotalDurations[edgeId] = stat.sum;
        });

        // NEW: Edge counts for tooltip display
        const specificEdgeCounts: Record<string, number> = {};
        Object.keys(edgeStats).forEach((edgeId) => {
          specificEdgeCounts[edgeId] = edgeStats[edgeId].count;
        });

        const pathForGraph: ExtendedPath = {
          nodes: response.data.nodes,
          edges: Object.keys(specificDurations),
          averageDuration: response.data.total_duration,
          _frequency: 1,
          _startIndex: 0,
          _endIndex: response.data.nodes.length - 1,
          _pathType: 'absolute',
          _fullPathNodes: response.data.nodes,
          _variantTimings: response.data.edge_durations,
          _specificEdgeDurations: specificDurations,
          _specificTotalDurations: specificTotalDurations,
          _specificEdgeCounts: specificEdgeCounts,
        };
        
        displayPathInGraph(pathForGraph);
      } else {
        setError('پرونده‌ای با این شناسه یافت نشد.');
      }
    } catch (err: any) {
      console.error('Search error:', err);
      if (err.status === 404) {
        setError('پرونده‌ای با این شناسه یافت نشد.');
      } else {
        setError('خطایی در دریافت اطلاعات رخ داد.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') submit();
  };

  const clearSearch = () => {
    setCaseIdInput(undefined);
    setSearchResult(null);
    setError(null);
    resetGraphState();
  };

  // --- Render Helpers ---
  const renderPerformanceStats = () => {
    if (!searchResult?.data?.position_stats) return null;

    const stats = searchResult.data.position_stats;
    const percentile = stats.duration_percentile;
    
    const isCritical = percentile > 80;
    const isWarning = percentile > 50 && percentile <= 80;

    let styleClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    let barColor = 'bg-emerald-500';
    let icon = <CheckCircle2 size={18} />;
    let title = 'عملکرد سریع (مطلوب)';
    let description = '';

    if (isCritical) {
      styleClass = 'bg-rose-50 text-rose-700 border-rose-200';
      barColor = 'bg-rose-500';
      icon = <ActivityIcon size={18} />;
      title = 'عملکرد بحرانی (کند)';
      description = `این پرونده از ${percentile.toFixed(0)}٪ کل پرونده‌های ثبت شده کندتر بوده است.`;
    } else if (isWarning) {
      styleClass = 'bg-amber-50 text-amber-700 border-amber-200';
      barColor = 'bg-amber-500';
      icon = <ActivityIcon size={18} />;
      title = 'کندتر از میانگین';
      description = `زمان اجرای این مورد از میانگین بیشتر است (کندتر از ${percentile.toFixed(0)}٪ موارد).`;
    } else {
      const fasterThan = 100 - percentile;
      title = 'عملکرد نرمال و سریع';
      description = `این پرونده سریع‌تر از ${fasterThan.toFixed(0)}٪ موارد مشابه انجام شده است.`;
    }

    return (
      <div className={`p-4 rounded-xl border ${styleClass} flex flex-col gap-3 mb-3 shadow-sm`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold">
            {icon}
            <span>{title}</span>
          </div>
        </div>
        <p className="text-xs opacity-90 leading-5 font-medium">
          {description}
        </p>
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-[10px] opacity-70 px-0.5">
            <span>سریع‌ترین</span>
            <span>کندترین</span>
          </div>
          <div className="h-2 w-full bg-black/5 rounded-full overflow-hidden relative">
            <div 
              className={`h-full rounded-full ${barColor} transition-all duration-1000 ease-out`}
              style={{ width: `${percentile}%` }}
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full gap-3 p-1">
      
      {/* --- Top Section --- */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex flex-col gap-3 shrink-0 relative overflow-hidden">
        <div className="absolute top-1/2 right-8 left-8 h-0.5 bg-slate-200 -z-10" />

        <div className="flex gap-2 relative z-10">
          <NumberInput
            placeholder="شناسه پرونده (مثال: ۱۲۳۴۵)"
            value={caseIdInput}
            onValueChange={setCaseIdInput}
            onKeyDown={handleKeyDown}
            isDisabled={isLoading}
            min={0}
            hideStepper
            formatOptions={{ useGrouping: false }}
            variant="flat"
            size="sm"
            startContent={
              <div className="bg-slate-200/50 p-1 rounded text-slate-500 mr-1">
                <Search size={14} />
              </div>
            }
            classNames={{
              inputWrapper: "bg-white border border-slate-200 shadow-sm hover:bg-slate-50 focus-within:bg-white focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all",
              input: "text-right font-medium text-slate-700",
            }}
            className="flex-1"
          />
          <Button
            isIconOnly
            size="sm"
            color="primary"
            variant="shadow"
            className="rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/30"
            isLoading={isLoading}
            onPress={submit}
          >
            {!isLoading && <Search size={18} />}
          </Button>
        </div>

        {/* Status Indicator Card */}
        {searchResult?.found && searchResult.data ? (
          <div className="flex items-center justify-between gap-2">
             <div className="flex-1 bg-white border border-slate-200 rounded-xl p-2 shadow-sm flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500 shrink-0">
                  <SquareActivity size={18} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] text-slate-400 font-bold">فعالیت ها</span>
                  <span className="text-xs font-bold text-slate-800 truncate">{searchResult.data!.nodes.length}</span>
                </div>
             </div>
             
             <div className="text-emerald-400">
               <CheckCircle2 size={16} />
             </div>

             <div className="flex-1 bg-white border border-slate-200 rounded-xl p-2 shadow-sm flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500 shrink-0">
                  <Timer size={18} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] text-slate-400 font-bold">مدت زمان</span>
                  <span className="text-xs font-bold text-slate-800 truncate">
                    {formatDuration(searchResult.data.total_duration)}
                  </span>
                </div>
             </div>
          </div>
        ) : error ? (
           <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 flex items-center gap-2 text-xs font-medium animate-appearance-in">
              <XCircle size={16} className="shrink-0" />
              <span>{error}</span>
           </div>
        ) : (
          <div className="py-2 flex justify-center">
            <span className="text-[10px] text-slate-400 font-medium bg-slate-100 px-3 py-1 rounded-full">
              منتظر ورود شناسه
            </span>
          </div>
        )}
      </div>

      {/* --- Custom Tabs --- */}
      <div className="grid grid-cols-2 p-1 bg-slate-100/80 rounded-xl shrink-0 gap-1">
        <button
          onClick={() => setActiveTab("Timeline")}
          disabled={!searchResult?.found}
          className={`
            flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all
            ${activeTab === "Timeline" 
              ? "bg-white text-slate-800 shadow-sm" 
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
            }
            ${!searchResult?.found ? "opacity-50 cursor-not-allowed" : ""}
          `}
        >
          <LayoutList size={14} />
          مسیر زمانی
        </button>
        <button
          onClick={() => setActiveTab("Charts")}
          disabled={!searchResult?.found}
          className={`
            flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all
            ${activeTab === "Charts" 
              ? "bg-white text-slate-800 shadow-sm" 
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
            }
            ${!searchResult?.found ? "opacity-50 cursor-not-allowed" : ""}
          `}
        >
          <BarChart3 size={14} />
          تحلیل و نمودار
        </button>
      </div>

      {/* --- Content Area --- */}
      <div className="flex-1 min-h-0 relative overflow-hidden bg-white rounded-xl border border-slate-100">
        
        {/* Loading Overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-20 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-bold text-slate-600">در حال جستجو...</span>
          </div>
        )}

        {/* Empty State */}
        {!searchResult?.found && !isLoading && !error && (
          <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center opacity-70">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center border border-slate-100">
              <History size={32} className="text-slate-300" />
            </div>
            <p className="text-slate-500 text-sm font-bold">جستجوی پرونده</p>
            <p className="text-slate-400 text-xs max-w-[220px] leading-5">
              برای مشاهده مسیر دقیق و تحلیل آماری، شناسه پرونده را در کادر بالا وارد کنید.
            </p>
          </div>
        )}

        {/* تغییر کلیدی اینجاست: استفاده از display:none به جای شرطی رندر کردن */}
        {/* 1. Timeline Section */}
        {searchResult?.found && searchResult.data && (
           <div className={activeTab === "Timeline" ? "h-full" : "hidden"}>
             <ScrollShadow className="h-full p-3">
               <div className="flex flex-col relative pl-4 pr-2">
                  <div className="absolute right-[19px] top-4 bottom-4 w-0.5 bg-slate-100" />
                  
                  {searchResult.data.nodes.map((node, index) => {
                    const isLast = index === searchResult.data!.nodes.length - 1;
                    const isFirst = index === 0;
                    const duration = !isLast ? searchResult.data!.edge_durations[index] : null;

                    return (
                      <div key={index} className="relative mb-4 last:mb-0 group">
                        <div className="flex items-start gap-3 relative z-10">
                          <div className={`
                            w-4 h-4 rounded-full border-[3px] shrink-0 mt-3 transition-all duration-300 z-20 bg-white
                            ${isFirst 
                              ? 'border-emerald-500 ring-4 ring-emerald-50 shadow-sm' 
                              : isLast 
                              ? 'border-rose-500 ring-4 ring-rose-50 shadow-sm' 
                              : 'border-slate-300 group-hover:border-blue-400 group-hover:ring-4 group-hover:ring-blue-50'
                            }
                          `} />
                          <div className={`
                            flex-1 p-3 rounded-xl border transition-all duration-200
                            ${isFirst 
                              ? "bg-emerald-50/50 border-emerald-100" 
                              : isLast 
                              ? "bg-rose-50/50 border-rose-100" 
                              : "bg-white border-slate-100 hover:border-blue-200 hover:shadow-sm"
                            }
                          `}>
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-xs font-bold ${isFirst ? 'text-emerald-800' : isLast ? 'text-rose-800' : 'text-slate-700'}`}>
                                {node}
                              </span>
                              {isFirst && <Chip size="sm" color="success" variant="flat" className="h-4 text-[9px] px-1">شروع</Chip>}
                              {isLast && <Chip size="sm" color="danger" variant="flat" className="h-4 text-[9px] px-1">پایان</Chip>}
                            </div>
                            {!isLast && duration !== undefined && (
                              <div className="flex items-center gap-1 mt-2 text-[10px] text-slate-500 bg-slate-50 px-2 py-1 rounded-lg w-fit border border-slate-100">
                                 <ArrowDown size={10} className="text-slate-400" />
                                 <span>{formatDuration(duration as number)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
               </div>
             </ScrollShadow>
           </div>
        )}

        {/* 2. Charts Section - Always mounted but toggled via class */}
        {searchResult?.found && (
          <div className={activeTab === "Charts" ? "h-full" : "hidden"}>
            <ScrollShadow className="h-full p-3">
               {renderPerformanceStats()}
               <div className="bg-white">
                  <CaseDistributionCharts searchResult={searchResult} />
               </div>
            </ScrollShadow>
          </div>
        )}
      </div>
    </div>
  );
}