'use client'

/**
 * @component RouteBuilderPage  (sidebar panel)
 * @description
 * The sidebar card for the route-builder feature.
 * Path state lives in useRouteBuilderStore so the SankeyFlow (main panel)
 * and this sidebar stay in perfect sync.
 *
 * This panel shows:
 *  - The current path with step numbers
 *  - Next-candidate list (same as the Sankey, but in a searchable list)
 *  - Results tab with PathList of matching paths
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { Node } from "@xyflow/react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Chip } from "@heroui/chip";
import { ScrollShadow } from "@heroui/scroll-shadow";
import {
  Search,
  List,
  GitFork,
  ChevronLeft,
  RotateCcw,
  CheckCircle2,
  Circle,
  ArrowRight,
  Milestone,
  Timer,
  ArrowUpDown,
  RefreshCcw,
} from "lucide-react";

import type { Variant, ExtendedPath, Path } from "@/types/types";
import { PathList } from "@/components/sideBarCards/PathList";
import { useAppStore } from "@/hooks/useAppStore";
import { useGraphStore } from "@/store/useGraphStore";
import { useRouteBuilderStore } from "@/store/useRouteBuilderStore";

// ============================================================================
// HELPERS
// ============================================================================

interface NextCandidate {
  nodeId: string;
  label: string;
  variantCount: number;
}

function computeNextCandidates(
  selectedPath: string[],
  allVariants: Variant[]
): { matchingVariants: Variant[]; candidates: NextCandidate[] } {
  if (allVariants.length === 0 || selectedPath.length === 0)
    return { matchingVariants: [], candidates: [] };

  const matchingVariants: Variant[] = [];
  const candidateMap = new Map<string, number>();

  for (const variant of allVariants) {
    const vp = variant.Variant_Path;
    const si = vp.indexOf(selectedPath[0]);
    if (si === -1) continue;
    let ok = true;
    for (let i = 1; i < selectedPath.length; i++) {
      if (vp[si + i] !== selectedPath[i]) { ok = false; break; }
    }
    if (!ok) continue;
    matchingVariants.push(variant);
    const ni = si + selectedPath.length;
    if (ni < vp.length) candidateMap.set(vp[ni], (candidateMap.get(vp[ni]) ?? 0) + 1);
  }

  return {
    matchingVariants,
    candidates: Array.from(candidateMap.entries())
      .map(([nodeId, variantCount]) => ({ nodeId, label: nodeId, variantCount }))
      .sort((a, b) => b.variantCount - a.variantCount),
  };
}

function buildExtendedPaths(
  selectedPath: string[],
  matchingVariants: Variant[]
): ExtendedPath[] {
  if (selectedPath.length < 2) return [];

  type Entry = {
    path: ExtendedPath;
    totalFreq: number;
    weightedDur: number;
    wEdge: Record<string, number>;
    sumTotal: Record<string, number>;
  };
  const pathMap = new Map<string, Entry>();

  for (const variant of matchingVariants) {
    const vp = variant.Variant_Path;
    const si = vp.indexOf(selectedPath[0]);
    if (si === -1) continue;
    const ei = si + selectedPath.length - 1;
    const isAbsolute = si === 0 && ei === vp.length - 1;
    const freq = variant.Frequency || 1;
    let totalDur = 0;
    const edgeDurs: Record<string, number> = {};
    const edgeTotals: Record<string, number> = {};
    if (variant.Avg_Timings?.length) {
      for (let i = si; i < ei && i + 1 < variant.Avg_Timings.length; i++) {
        const dur = Math.max(0, (variant.Avg_Timings[i + 1] ?? 0) - (variant.Avg_Timings[i] ?? 0));
        const tdur = Math.max(0, (variant.Total_Timings?.[i + 1] ?? 0) - (variant.Total_Timings?.[i] ?? 0));
        totalDur += dur;
        const eid = `${vp[i]}->${vp[i + 1]}`;
        edgeDurs[eid] = dur;
        edgeTotals[eid] = tdur;
      }
    }
    const ep: ExtendedPath = {
      nodes: [...selectedPath], edges: [], frequency: freq, totalDuration: totalDur,
      averageDuration: selectedPath.length > 1 ? totalDur / (selectedPath.length - 1) : 0,
      _pathType: isAbsolute ? "absolute" : "relative", _frequency: freq,
      _fullPathNodes: vp, _startIndex: si, _endIndex: ei,
      _variantTimings: variant.Avg_Timings?.slice(si, ei + 1),
      _specificEdgeDurations: edgeDurs, _specificTotalDurations: edgeTotals,
    };
    const key = selectedPath.join("->") + JSON.stringify(edgeDurs);
    const ex = pathMap.get(key);
    if (ex) {
      ex.totalFreq += freq; ex.weightedDur += totalDur * freq;
      for (const [id, d] of Object.entries(edgeDurs)) ex.wEdge[id] = (ex.wEdge[id] ?? 0) + d * freq;
      for (const [id, d] of Object.entries(edgeTotals)) ex.sumTotal[id] = (ex.sumTotal[id] ?? 0) + d;
    } else {
      const we: Record<string, number> = {}; for (const [id, d] of Object.entries(edgeDurs)) we[id] = d * freq;
      pathMap.set(key, { path: { ...ep }, totalFreq: freq, weightedDur: totalDur * freq, wEdge: we, sumTotal: { ...edgeTotals } });
    }
  }
  return Array.from(pathMap.values()).map(({ path, totalFreq, weightedDur, wEdge, sumTotal }) => {
    const ae: Record<string, number> = {}; for (const [id, w] of Object.entries(wEdge)) ae[id] = w / totalFreq;
    path.frequency = totalFreq; path._frequency = totalFreq;
    path.totalDuration = weightedDur / totalFreq;
    path.averageDuration = path.nodes.length > 1 ? path.totalDuration / (path.nodes.length - 1) : 0;
    path._variantDuration = path.totalDuration; path._specificEdgeDurations = ae; path._specificTotalDurations = sumTotal;
    return path;
  }).sort((a, b) => (b.frequency ?? 0) - (a.frequency ?? 0));
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function RouteBuilderPage() {
  // ── Shared route-builder state ────────────────────────────────────────────
  const { selectedPath, addNode, removeLastNode, reset } = useRouteBuilderStore();

  // ── App + graph stores ────────────────────────────────────────────────────
  const {
    variants, outliers, isLoading: appLoading, graphData,
    selectedNodeIds, startEndNodes, selectedColorPalette,
    setSelectedPathNodes, setSelectedPathEdges,
    setSelectedPathIndex: setAppSelectedPathIndex,
  } = useAppStore();

  const { allNodes, setFoundPaths, setActivePath, computeLayout } = useGraphStore();

  const allVariants = useMemo<Variant[]>(() =>
    [...(variants ?? []), ...(outliers ?? [])], [variants, outliers]);

  // ── Local UI state ────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"Build" | "Results">("Build");
  const [searchValue, setSearchValue] = useState("");
  const [searchedNodes, setSearchedNodes] = useState<Node[]>([]);
  const [selectedPathIndex, setSelectedPathIndex] = useState<number | null>(null);
  const [isSorted, setIsSorted] = useState(false);
  const [isSorting, setIsSorting] = useState(false);
  const [processedPaths, setProcessedPaths] = useState<ExtendedPath[]>([]);
  const [sortedPaths, setSortedPaths] = useState<ExtendedPath[]>([]);

  const baseNodes = useMemo(() =>
    allNodes.filter(n => n.id !== "START_NODE" && n.id !== "END_NODE"), [allNodes]);

  useEffect(() => {
    const norm = searchValue.toLowerCase().replace("ی", "ي");
    setSearchedNodes(norm.trim() ? baseNodes.filter(n => (n.data.label as string).toLowerCase().includes(norm)) : baseNodes);
  }, [baseNodes, searchValue]);

  const { matchingVariants, candidates } = useMemo(() => {
    if (!selectedPath.length || !allVariants.length) return { matchingVariants: [], candidates: [] };
    return computeNextCandidates(selectedPath, allVariants);
  }, [selectedPath, allVariants]);

  useEffect(() => {
    if (selectedPath.length >= 2 && matchingVariants.length > 0) {
      const paths = buildExtendedPaths(selectedPath, matchingVariants);
      setProcessedPaths(paths); setSortedPaths(paths); setIsSorted(false);
    } else { setProcessedPaths([]); setSortedPaths([]); }
  }, [selectedPath, matchingVariants]);

  const getNodeLabel = useCallback(
    (id: string) => allNodes.find(n => n.id === id)?.data?.label as string || id, [allNodes]);

  const enrichedCandidates = useMemo<NextCandidate[]>(() =>
    candidates.map(c => ({ ...c, label: getNodeLabel(c.nodeId) })), [candidates, getNodeLabel]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSelectFirstNode = useCallback((node: Node) => {
    addNode(node.id); setActiveTab("Build"); setSearchValue("");
  }, [addNode]);

  const handleSelectNext = useCallback((candidate: NextCandidate) => {
    addNode(candidate.nodeId); setSelectedPathIndex(null);
  }, [addNode]);

  const handleRemoveLastNode = useCallback(() => {
    removeLastNode(); setSelectedPathIndex(null);
    setSelectedPathNodes(new Set()); setSelectedPathEdges(new Set());
    setAppSelectedPathIndex(null); setActivePath(null);
  }, [removeLastNode, setSelectedPathNodes, setSelectedPathEdges, setAppSelectedPathIndex, setActivePath]);

  const handleReset = useCallback(() => {
    reset(); setActiveTab("Build"); setSearchValue(""); setSelectedPathIndex(null);
    setIsSorted(false); setProcessedPaths([]); setSortedPaths([]);
    setSelectedPathNodes(new Set()); setSelectedPathEdges(new Set());
    setAppSelectedPathIndex(null); setActivePath(null); setFoundPaths([]);
    computeLayout({ graphData, colorPaletteKey: selectedColorPalette,
      startEndNodes: startEndNodes || { start: [], end: [] },
      filteredNodeIds: selectedNodeIds, filteredEdgeIds: null,
      activePathInfo: undefined, searchCasePathInfo: undefined });
  }, [reset, setSelectedPathNodes, setSelectedPathEdges, setAppSelectedPathIndex, setActivePath,
    setFoundPaths, computeLayout, graphData, selectedColorPalette, startEndNodes, selectedNodeIds]);

  const handleSelectPath = useCallback((path: Path, index: number) => {
    setSelectedPathIndex(index); setAppSelectedPathIndex(index);
    const nodeSet = new Set(path.nodes); setSelectedPathNodes(nodeSet);
    const edgeSet = new Set<string>();
    for (let i = 0; i < path.nodes.length - 1; i++) edgeSet.add(`${path.nodes[i]}->${path.nodes[i + 1]}`);
    setSelectedPathEdges(edgeSet);
    const ext = path as ExtendedPath; setActivePath(ext);
    computeLayout({ graphData, colorPaletteKey: selectedColorPalette,
      startEndNodes: startEndNodes || { start: [], end: [] },
      filteredNodeIds: nodeSet, filteredEdgeIds: edgeSet,
      activePathInfo: { nodes: path.nodes, edges: Array.from(edgeSet),
        edgeDurations: ext._specificEdgeDurations || {},
        edgeTotalDurations: ext._specificTotalDurations || {},
        frequency: ext._frequency || ext.frequency },
      searchCasePathInfo: undefined });
  }, [setSelectedPathNodes, setSelectedPathEdges, setAppSelectedPathIndex, setActivePath,
    computeLayout, graphData, selectedColorPalette, startEndNodes]);

  const handleRemovePath = useCallback((index: number) => {
    setProcessedPaths(p => p.filter((_, i) => i !== index));
    setSortedPaths(p => p.filter((_, i) => i !== index));
    if (selectedPathIndex === index) {
      setSelectedPathIndex(null); setSelectedPathNodes(new Set()); setSelectedPathEdges(new Set());
      setAppSelectedPathIndex(null);
      computeLayout({ graphData, colorPaletteKey: selectedColorPalette,
        startEndNodes: startEndNodes || { start: [], end: [] },
        filteredNodeIds: selectedNodeIds, filteredEdgeIds: null,
        activePathInfo: undefined, searchCasePathInfo: undefined });
    } else if (selectedPathIndex !== null && selectedPathIndex > index) {
      setSelectedPathIndex(selectedPathIndex - 1);
    }
  }, [selectedPathIndex, setSelectedPathNodes, setSelectedPathEdges, setAppSelectedPathIndex,
    computeLayout, graphData, selectedColorPalette, startEndNodes, selectedNodeIds]);

  const handleSortPaths = useCallback(() => {
    if (isSorted) return; setIsSorting(true);
    setTimeout(() => {
      setSortedPaths([...processedPaths].sort((a, b) => (a.averageDuration ?? 0) - (b.averageDuration ?? 0)));
      setIsSorted(true); setIsSorting(false);
    }, 10);
  }, [isSorted, processedPaths]);

  // Cleanup on unmount
  useEffect(() => () => {
    setSelectedPathNodes(new Set()); setSelectedPathEdges(new Set());
    setAppSelectedPathIndex(null); setActivePath(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasPath = selectedPath.length > 0;
  const hasResults = processedPaths.length > 0;
  const displayPaths = sortedPaths.length > 0 ? sortedPaths : processedPaths;

  return (
    <div className="flex flex-col h-full gap-3" dir="rtl">

      {/* ── Path Stepper ── */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/60 rounded-2xl p-3 flex flex-col gap-2 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <GitFork size={15} className="text-amber-600" />
            <span className="text-xs font-bold text-amber-700">مسیر در حال ساخت</span>
          </div>
          {hasPath && (
            <button onClick={handleRemoveLastNode}
              className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-rose-500 transition-colors">
              <RotateCcw size={10} />بازگشت
            </button>
          )}
        </div>

        {!hasPath ? (
          <div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-white/60 border border-dashed border-amber-300/60">
            <Circle size={14} className="text-amber-300" />
            <span className="text-xs text-amber-400">گره اول را از لیست پایین یا از روی نمودار انتخاب کنید</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {selectedPath.map((nodeId, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="flex flex-col items-center shrink-0 w-5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0
                    ${idx === 0 ? "bg-amber-400 text-white" : "bg-emerald-100 text-emerald-700 border border-emerald-200"}`}>
                    {idx + 1}
                  </div>
                </div>
                <div className={`flex-1 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium
                  ${idx === 0 ? "bg-amber-100 border-amber-300 text-amber-800" : "bg-white border-amber-200 text-slate-700"}`}>
                  {idx === 0
                    ? <Milestone size={11} className="text-amber-600 shrink-0" />
                    : <CheckCircle2 size={11} className="text-emerald-500 shrink-0" />}
                  <span className="leading-tight">{getNodeLabel(nodeId)}</span>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-center shrink-0 w-5">
                <div className="w-5 h-5 rounded-full flex items-center justify-center border border-dashed border-slate-300 bg-slate-50">
                  <span className="text-[8px] text-slate-400">…</span>
                </div>
              </div>
              <div className="flex-1 px-2.5 py-1.5 rounded-xl border border-dashed border-slate-300 bg-slate-50/60">
                <span className="text-[10px] text-slate-400">
                  {candidates.length > 0 ? `${candidates.length} گزینه بعدی` : "پایان مسیر"}
                </span>
              </div>
            </div>
          </div>
        )}

        {hasPath && (
          <div className="flex items-center gap-3 mt-1 pt-2 border-t border-amber-200/40">
            <span className="text-[10px] text-amber-600 font-bold">{selectedPath.length} گره</span>
            <span className="text-[10px] text-slate-400">•</span>
            <span className="text-[10px] text-slate-500">
              {matchingVariants.length} واریانت منطبق از {allVariants.length} کل واریانت
            </span>
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="grid grid-cols-2 p-1 bg-slate-100/80 rounded-xl shrink-0 gap-1">
        <button onClick={() => setActiveTab("Build")}
          className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all
            ${activeTab === "Build" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"}`}>
          <GitFork size={14} />ساخت مسیر
        </button>
        <button onClick={() => setActiveTab("Results")} disabled={!hasResults}
          className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all
            ${activeTab === "Results" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"}
            ${!hasResults ? "opacity-40 cursor-not-allowed" : ""}`}>
          <List size={14} />
          مسیرهای یافت‌شده
          {hasResults && <span className="bg-amber-100 text-amber-700 px-1.5 rounded-md text-[10px]">{processedPaths.length}</span>}
        </button>
      </div>

      {/* ── Tab Content ── */}
      <div className="flex-1 min-h-0 relative overflow-hidden bg-white rounded-xl border border-slate-100">

        {/* BUILD TAB */}
        {activeTab === "Build" && (
          <div className="h-full flex flex-col">
            {appLoading ? (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-slate-500">در حال بارگذاری...</span>
              </div>
            ) : baseNodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 p-4 text-center">
                <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                  <GitFork size={24} className="text-slate-400" />
                </div>
                <p className="text-slate-500 text-sm font-bold">هیچ گره‌ای وجود ندارد</p>
                <p className="text-slate-400 text-xs max-w-[200px]">لطفاً ابتدا فیلتر تاریخ را اعمال کنید.</p>
              </div>
            ) : (
              <>
                <div className="p-2 border-b border-slate-100">
                  <Input type="text" variant="flat" size="sm"
                    placeholder={selectedPath.length === 0 ? "جستجو برای گره اول..." : "جستجو در گره‌های بعدی..."}
                    startContent={<Search size={16} className="text-slate-400" />}
                    value={searchValue} onValueChange={setSearchValue}
                    classNames={{ inputWrapper: "bg-slate-50 hover:bg-slate-100 focus-within:bg-white border-slate-200 shadow-none" }} />
                </div>

                <ScrollShadow className="flex-1 p-2">
                  <div className="flex flex-col gap-1.5">
                    {selectedPath.length === 0 ? (
                      searchedNodes.length > 0 ? (
                        searchedNodes.map(node => (
                          <div key={node.id} onClick={() => handleSelectFirstNode(node)}
                            className="group flex items-center justify-between p-3 rounded-xl border cursor-pointer
                              bg-white border-slate-100 hover:border-amber-300 hover:shadow-md hover:bg-amber-50/30 transition-all duration-200">
                            <span className="text-sm font-medium text-slate-700 group-hover:text-amber-800 transition-colors">
                              {node.data.label as string}
                            </span>
                            <ChevronLeft size={14} className="text-slate-300 group-hover:text-amber-400 transition-colors" />
                          </div>
                        ))
                      ) : <div className="text-center py-8 text-slate-400 text-xs">گره‌ای یافت نشد.</div>
                    ) : (
                      enrichedCandidates.length > 0 ? (
                        enrichedCandidates
                          .filter(c => !searchValue.trim() || c.label.toLowerCase().includes(searchValue.toLowerCase().replace("ی", "ي")))
                          .map(candidate => (
                            <div key={candidate.nodeId} onClick={() => handleSelectNext(candidate)}
                              className="group flex items-center justify-between p-3 rounded-xl border cursor-pointer
                                bg-white border-slate-100 hover:border-amber-300 hover:shadow-md hover:bg-amber-50/30 transition-all duration-200">
                              <div className="flex items-center gap-2">
                                <ArrowRight size={12} className="text-amber-400 shrink-0" />
                                <span className="text-sm font-medium text-slate-700 group-hover:text-amber-800 transition-colors">
                                  {candidate.label}
                                </span>
                              </div>
                              <Chip size="sm" className="h-5 bg-amber-100 text-amber-700 text-[10px]">
                                {candidate.variantCount} واریانت
                              </Chip>
                            </div>
                          ))
                      ) : (
                        <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                          <CheckCircle2 size={28} className="text-emerald-300" />
                          <p className="text-slate-500 text-sm font-bold">پایان مسیر</p>
                          <p className="text-slate-400 text-xs">هیچ گره‌ای بعد از این نقطه وجود ندارد.</p>
                          {hasResults && (
                            <button onClick={() => setActiveTab("Results")}
                              className="mt-2 text-xs font-bold text-amber-600 hover:text-amber-700 underline">
                              مشاهده مسیرهای یافت‌شده ←
                            </button>
                          )}
                        </div>
                      )
                    )}
                  </div>
                </ScrollShadow>

                <div className="p-2 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 text-center">
                  {selectedPath.length === 0
                    ? "روی یک گره کلیک کنید یا از نمودار انتخاب کنید"
                    : `${matchingVariants.length} واریانت با مسیر فعلی منطبق است`}
                </div>
              </>
            )}
          </div>
        )}

        {/* RESULTS TAB */}
        {activeTab === "Results" && (
          <div className="h-full flex flex-col relative">
            {isSorting && (
              <div className="absolute inset-0 z-20 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                <RefreshCcw className="animate-spin text-amber-500" />
                <span className="text-xs font-bold text-slate-600">در حال مرتب‌سازی...</span>
              </div>
            )}
            {processedPaths.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center opacity-70">
                <List size={32} className="text-slate-300" />
                <p className="text-slate-500 text-sm font-bold">مسیری یافت نشد</p>
                <p className="text-slate-400 text-xs">ابتدا مسیر را از تب «ساخت مسیر» بسازید.</p>
              </div>
            ) : (
              <div className="flex flex-col h-full">
                <div className="flex items-center justify-between p-2 border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-1">
                    <Timer size={14} className="text-slate-400" />
                    <span className="text-xs text-slate-500">{isSorted ? "مرتب شده زمانی" : "مرتب شده فرکانسی"}</span>
                  </div>
                  <Button size="sm" variant="light" color="warning" isDisabled={isSorted} onPress={handleSortPaths}
                    startContent={<ArrowUpDown size={14} />} className="h-7 text-xs font-bold px-2 min-w-0">
                    مرتب‌سازی زمانی
                  </Button>
                </div>
                <ScrollShadow className="flex-1 p-2">
                  <PathList paths={displayPaths} allNodes={allNodes} selectedIndex={selectedPathIndex}
                    onSelectPath={handleSelectPath} onRemovePath={handleRemovePath}
                    groupByType={true} emptyMessage="مسیر معتبری یافت نشد." />
                </ScrollShadow>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <Button fullWidth color="danger" variant="flat" startContent={<RotateCcw size={16} />}
        onPress={handleReset} className="shrink-0 font-bold">
        شروع مجدد
      </Button>
    </div>
  );
}
