'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { NumberInput } from '@heroui/number-input';
import { Button } from '@heroui/button';
import { Chip } from '@heroui/chip';
import { Accordion, AccordionItem } from '@heroui/accordion';

import {
  Search,
  XCircle,
  CheckCircle2,
  Clock,
  MapPin,
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
  ArrowLeft,
} from 'lucide-react';

import type { SearchCaseIdsData, ExtendedPath } from '@/types/types';
import { formatDuration } from '@/utils/formatDuration';
import { api } from '@/utils/fetcher';
import { useGraphStore } from '@/store/useGraphStore';
import CaseDistributionCharts from '@/components/graph/ui/CaseDistributionCharts';
import { useAppStore } from '@/hooks';


export default function SearchCaseIdsRoute() {
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
  const [caseIdInput, setCaseIdInput] = useState<number | undefined>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchResult, setSearchResult] = useState<SearchCaseIdsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const graphStore = useGraphStore();

    useEffect(() => {
    return () => {
      // 1. پاکسازی selected nodes و edges در appStore
      setSelectedPathNodes(new Set());
      setSelectedPathEdges(new Set());
      setSelectedPathIndex(null);
      
      // 2. پاکسازی active path در graphStore
      graphStore.setActivePath(null);
      
      // 3. بازگرداندن layout اصلی گراف (با فیلترهای قبلی)
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
  }, []); // dependency array خالی - فقط هنگام unmount اجرا شود

  // پاکسازی stateهای داخلی هنگام mount - فقط یکبار اجرا شود
  useEffect(() => {
    // این ensure می‌کند وقتی صفحه باز می‌شود stateهای داخلی clean هستند
    setCaseIdInput(undefined);
    setSearchResult(null);
    setError(null);
  }, []); // dependency array خالی - فقط هنگام mount اجرا شود

  // پاکسازی گراف هنگام mount - فقط یکبار اجرا شود
  useEffect(() => {
    // همچنین پاکسازی گراف فعلی
    setSelectedPathNodes(new Set());
    setSelectedPathEdges(new Set());
    setSelectedPathIndex(null);
    graphStore.setActivePath(null);
    
    // بازگرداندن گراف به حالت اصلی
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
  }, []); 
  const displayPathInGraph = useCallback((pathForGraph: ExtendedPath) => {
    // 1. ذخیره مسیر در store گراف
    graphStore.setActivePath(pathForGraph);
    
    // 2. به روزرسانی selected nodes و edges در appStore
    setSelectedPathNodes(new Set(pathForGraph.nodes));
    setSelectedPathEdges(new Set(pathForGraph.edges));
    setSelectedPathIndex(0);
    
    // 3. ایجاد activePathInfo
    const activePathInfo = {
      nodes: pathForGraph.nodes,
      edges: pathForGraph.edges,
      edgeDurations: pathForGraph._specificEdgeDurations || {},
      edgeTotalDurations: {},
      frequency: pathForGraph._frequency || 1,
    };
    
    // 4. فراخوانی computeLayout با activePathInfo
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
  }, [
    graphStore, 
    setSelectedPathNodes, 
    setSelectedPathEdges, 
    setSelectedPathIndex, 
    graphData, 
    startEndNodes, 
    selectedColorPalette
  ]);

  const submit = async () => {
    if (!caseIdInput) {
      setError('لطفاً شناسه پرونده را وارد کنید.');
      return;
    }

    if (!filters?.dateRange.start || !filters.dateRange.end) {
      setError('لطفا در منوی بالای گراف، بازه زمانی را مشخص کنید.');
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
        // پردازش برای نمایش در گراف
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
          _specificTotalDurations: specificDurations,
        };
        
        // نمایش مسیر در گراف
        displayPathInGraph(pathForGraph);
        
      } else {
        setError('پرونده‌ای با این شناسه در محدوده انتخابی یافت نشد.');
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

  const renderPerformanceStats = () => {
    if (!searchResult?.data?.position_stats) return null;

    const stats = searchResult.data.position_stats;
    const isCritical = stats.duration_percentile > 80;
    const isWarning = stats.duration_percentile > 50 && stats.duration_percentile <= 80;

    let styleClass = 'bg-slate-50 text-slate-600 border-slate-200';
    let icon = <Info size={16} />;
    let title = 'عملکرد نرمال';
    let desc = 'زمان اجرای این پرونده در محدوده میانگین است.';

    if (isCritical) {
      styleClass = 'bg-rose-50 text-rose-700 border-rose-200';
      icon = <AlertCircle size={16} />;
      title = 'عملکرد بحرانی (کند)';
      desc = `این پرونده از ${stats.duration_percentile.toFixed(0)}٪ کل پرونده‌ها کندتر است.`;
    } else if (isWarning) {
      styleClass = 'bg-amber-50 text-amber-700 border-amber-200';
      icon = <TrendingUp size={16} />;
      title = 'کندتر از میانگین';
      desc = `این پرونده از ${stats.duration_percentile.toFixed(0)}٪ پرونده‌ها طولانی‌تر شده است.`;
    } else {
      styleClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      icon = <TrendingDown size={16} />;
      title = 'عملکرد سریع';
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
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-4 md:p-6">
      <div className="max-w-6xl mx-auto">


        <div className="flex flex-col gap-6">
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sticky top-6">
              

            

              {/* ورودی شماره پرونده */}
              <div className="mb-6">
                {/* <label className="block text-sm font-medium text-slate-700 mb-2">
                  شناسه پرونده (Case ID)
                </label> */}
                <div className="flex gap-3">
                  <NumberInput
                    placeholder="مثال: ۱۲۳۴۵"
                    value={caseIdInput}
                    onValueChange={setCaseIdInput}
                    onKeyDown={handleKeyDown}
                    isDisabled={isLoading}
                    formatOptions={{ useGrouping: false }}
                    minValue={0}
                    hideStepper
                    isClearable
                    variant="bordered"
                    classNames={{
                      inputWrapper: ' bg-white hover:bg-slate-50 border-slate-300',
                      input: 'text-right',
                    }}
                    startContent={
                      <span className="text-slate-400 text-sm border-r border-slate-300 mr-2">#</span>
                    }
                    className="flex-1"
                  />
                  <Button
                    color="primary"
                    variant="shadow"
                    onPress={submit}
                    isLoading={isLoading}
                    isIconOnly
                    className="bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/30"
                  >
                    <Search size={22}/>
                  </Button>
                </div>
              </div>

              {error && (
                <div className="p-4 rounded-xl bg-rose-50 text-rose-700 text-sm flex items-start gap-3 border border-rose-200 animate-appearance-in">
                  <XCircle size={18} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {searchResult?.found && (
                <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                      <CheckCircle2 size={20} />
                    </div>
                    <div>
                      <p className="font-semibold text-emerald-800">پرونده یافت شد!</p>
                      <p className="text-sm text-emerald-600">
                        شناسه: <span className="font-mono font-bold">{searchResult.data?.case_id}</span>
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white p-3 rounded-lg border border-emerald-100">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock size={14} className="text-emerald-600" />
                        <span className="text-xs text-slate-500">مدت زمان</span>
                      </div>
                      <p className="text-sm font-bold text-slate-800">
                        {formatDuration(searchResult.data!.total_duration)}
                      </p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-emerald-100">
                      <div className="flex items-center gap-2 mb-1">
                        <MapPin size={14} className="text-emerald-600" />
                        <span className="text-xs text-slate-500">طول مسیر</span>
                      </div>
                      <p className="text-sm font-bold text-slate-800">
                        {searchResult.data!.nodes.length} فعالیت
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ستون سمت راست: نتایج */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-full">
              {searchResult?.found && searchResult.data ? (
                <div className="h-full overflow-y-auto">
                  <div className="p-6 border-b border-slate-100">
                    <h2 className="text-xl font-bold text-slate-800 mb-2">نتایج تحلیل پرونده</h2>
                    <p className="text-slate-500 text-sm">
                      جزئیات کامل پرونده شناسه {searchResult.data.case_id}
                    </p>
                  </div>

                  <div className="p-6">
                    {/* آکاردئون‌ها */}
                    <Accordion
                      keepContentMounted
                      defaultExpandedKeys={['1', '2']}
                      variant="splitted"
                      className="px-0 gap-4"
                      itemClasses={{
                        base: 'group bg-slate-50 border border-slate-100 rounded-xl px-0 data-[open=true]:border-blue-200',
                        title: 'text-sm font-semibold text-slate-800',
                        trigger: 'py-4 px-6 data-[hover=true]:bg-slate-100',
                        indicator: 'text-slate-500',
                        content: 'pb-6 px-6',
                      }}
                    >
                      {/* بخش ۱: تحلیل آماری */}
                      <AccordionItem
                        key="1"
                        aria-label="Charts"
                        title={
                          <div className="flex items-center gap-3">
                            <Activity size={18} className="text-indigo-600" />
                            <span>تحلیل آماری و نمودارها</span>
                          </div>
                        }
                      >
                        <div className="flex flex-col gap-4">
                          {renderPerformanceStats()}

                          <div className="h-[400px] w-full border border-slate-200 rounded-xl overflow-hidden bg-white">
                            <CaseDistributionCharts
                              searchResult={searchResult}
                            />
                          </div>
                        </div>
                      </AccordionItem>

                      {/* بخش ۲: مسیر زمانی */}
                      <AccordionItem
                        key="2"
                        aria-label="Timeline"
                        title={
                          <div className="flex items-center gap-3">
                            <ListStart size={18} className="text-slate-600" />
                            <span>مسیر زمانی پرونده</span>
                          </div>
                        }
                      >
                        <div className="pt-2">
                          <div className="relative pl-4 pr-6 py-4 border-r-2 border-slate-200 mr-4 space-y-1">
                            {searchResult.data.nodes.map((node, index) => {
                              const isLast = index === searchResult.data!.nodes.length - 1;
                              const isFirst = index === 0;
                              const duration = !isLast ? searchResult.data!.edge_durations[index] : null;

                              return (
                                <div key={index} className="relative pb-6 last:pb-0">
                                  {!isLast && (
                                    <div className="absolute top-5 bottom-0 right-[9px] w-0.5 bg-slate-300" />
                                  )}

                                  <div className="flex items-start gap-4 relative z-10">
                                    <div
                                      className={`w-5 h-5 rounded-full border-4 shrink-0 bg-white mt-1 z-20 transition-colors ${
                                        isFirst
                                          ? 'border-emerald-600 ring-3 ring-emerald-100'
                                          : isLast
                                          ? 'border-rose-600 ring-3 ring-rose-100'
                                          : 'border-blue-400 ring-2 ring-blue-50'
                                      }`}
                                    />

                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-3 flex-wrap">
                                        <span
                                          className={`text-sm leading-tight ${
                                            isFirst || isLast
                                              ? 'font-bold text-slate-900'
                                              : 'font-medium text-slate-700'
                                          }`}
                                        >
                                          {node}
                                        </span>
                                        {isFirst && (
                                          <span className="text-xs px-2 py-1 bg-emerald-100 text-emerald-800 rounded-md font-semibold">
                                            شروع
                                          </span>
                                        )}
                                        {isLast && (
                                          <span className="text-xs px-2 py-1 bg-rose-100 text-rose-800 rounded-md font-semibold">
                                            پایان
                                          </span>
                                        )}
                                      </div>

                                      {!isLast && duration !== undefined && (
                                        <div className="flex justify-start mt-3">
                                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-700 font-medium shadow-sm">
                                            <ArrowDown size={12} />
                                            {formatDuration(duration as number)}
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
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[calc(100vh-200px)] gap-6 p-8 text-center">
                  {/* <div className="w-24 h-24 rounded-full bg-slate-100 flex items-center justify-center">
                    {searchAllData ? (
                      <History size={40} className="text-slate-400" />
                    ) : (
                      <FileText size={40} className="text-slate-400" />
                    )}
                  </div> */}
                  <div>
                    <h3 className="text-lg font-semibold text-slate-700 mb-2">آماده جستجو</h3>
                    <p className="text-slate-500 max-w-md mx-auto">
                      شماره پرونده مورد نظر را در بخش سمت چپ وارد کنید تا مسیر دقیق و تحلیل زمانی آن نمایش داده شود.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}