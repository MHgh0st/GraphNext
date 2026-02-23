  'use client'

  /**
   * @component RouteBuilderFlow (formerly SankeyFlow)
   *
   * A modern step-by-step Directed Acyclic Graph (DAG) layout for Route Building.
   * Replaces the legacy d3-sankey layout with a clean, deterministic tree layout.
   */

  import { useMemo, useCallback, useEffect } from "react";
  import {
    ReactFlow,
    ReactFlowProvider,
    Background,
    BackgroundVariant,
    Controls,
    useReactFlow,
    NodeProps,
    EdgeProps,
    Handle,
    Position,
    Node as RFNode,
    Edge as RFEdge,
    getSmoothStepPath,
    EdgeLabelRenderer,
  } from "@xyflow/react";
  import { Node as GraphNode } from "@xyflow/react";
  import {
  GitFork, RotateCcw, Milestone, CheckCircle2, ChevronRight, Check, MoreHorizontal
} from "lucide-react";

  import type { Variant } from "@/types/types";
  import { useRouteBuilderStore } from "@/store/useRouteBuilderStore";

  // ─────────────────────────────────────────────────────────────────────────────
  // CONSTANTS & LAYOUT SETTINGS
  // ─────────────────────────────────────────────────────────────────────────────

  const X_OFFSET = 500; // فاصله افقی بین مراحل
  const Y_OFFSET = 150;  // فاصله عمودی بین کاندیداها

  type NodeType = "start" | "selected" | "current" | "candidate";

  interface NodeData extends Record<string, unknown> {
    label: string;
    type: NodeType;
    count?: number;
    totalMatches?: number;
    stepIndex?: number;
    isMore?: boolean;
    onSelect?: () => void;
  }

  interface EdgeData extends Record<string, unknown> {
    isCandidate: boolean;
    count?: number;
    totalMatches?: number;
    maxCount?: number;
    isMore?: boolean;
  }

  interface SankeyFlowProps {
    allVariants: Variant[];
    allNodes: GraphNode[];
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  function computeCandidates(
    selectedPath: string[],
    allVariants: Variant[]
  ): { candidates: Array<{ nodeId: string; count: number }>; matchCount: number } {
    if (!selectedPath.length || !allVariants.length) return { candidates: [], matchCount: 0 };

    const map = new Map<string, number>();
    let matchCount = 0;

    for (const v of allVariants) {
      const vp = v.Variant_Path;
      let variantMatched = false;
      let nextNodesForThisVariant = new Set<string>(); // برای جلوگیری از شمارش تکراری گره بعدی در یک واریانت

      // جستجوی توالی مسیر انتخابی در سرتاسر واریانت (Sliding Window)
      for (let i = 0; i <= vp.length - selectedPath.length; i++) {
        let ok = true;
        for (let j = 0; j < selectedPath.length; j++) {
          if (vp[i + j] !== selectedPath[j]) {
            ok = false;
            break;
          }
        }
        
        // اگر توالی پیدا شد، گره بعدی را شکار کن
        if (ok) {
          variantMatched = true;
          const ni = i + selectedPath.length; 
          if (ni < vp.length) {
            nextNodesForThisVariant.add(vp[ni]);
          }
        }
      }

      if (variantMatched) {
        matchCount++;
        nextNodesForThisVariant.forEach(nodeId => {
          map.set(nodeId, (map.get(nodeId) ?? 0) + 1);
        });
      }
    }

    return {
      matchCount,
      candidates: Array.from(map.entries())
        .map(([nodeId, count]) => ({ nodeId, count }))
        .sort((a, b) => b.count - a.count),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CUSTOM REACT FLOW NODE (Step Card)
  // ─────────────────────────────────────────────────────────────────────────────

  function StepNode({ data }: NodeProps<RFNode<NodeData>>) {
  const { label, type, count, totalMatches, stepIndex, onSelect, isMore } = data;
  const isCandidate = type === "candidate";
  const isCurrent = type === "current";
  const isSelected = type === "selected" || type === "start";

  const percentage = isCandidate && count && totalMatches 
    ? Math.round((count / totalMatches) * 100) 
    : 0;

  return (
    <div
      onClick={isCandidate && !isMore ? onSelect : undefined}
      className={`relative group flex items-center gap-3 px-5 py-3.5 rounded-2xl min-w-[200px] max-w-[280px] transition-all duration-300
        ${isCandidate 
          ? isMore 
            ? "cursor-default bg-slate-50 border-2 border-dashed border-slate-300" // استایل گره تجمیعی (خاکستری)
            : "cursor-pointer bg-white border-2 border-dashed border-amber-300 hover:border-amber-500 hover:bg-amber-50 hover:shadow-lg hover:-translate-y-1" 
          : "bg-white border border-slate-200 shadow-md"}
        ${isCurrent ? "ring-4 ring-amber-500/20 border-amber-500" : ""}
      `}
      dir="rtl"
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />

      {/* آیکون وضعیت بر اساس نوع گره */}
      <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-inner
        ${isSelected ? "bg-amber-500 text-white" : ""}
        ${isCurrent ? "bg-orange-600 text-white animate-pulse" : ""}
        ${isCandidate && !isMore ? "bg-amber-100 text-amber-600 border border-amber-200" : ""}
        ${isMore ? "bg-slate-200 text-slate-500 border border-slate-300" : ""}
      `}>
        {isSelected ? <Check size={16} strokeWidth={3} /> : 
         isCurrent ? (stepIndex ?? 0) + 1 : 
         isMore ? <MoreHorizontal size={16} /> : "?"}
      </div>

      <div className="flex flex-col overflow-hidden">
        <span className={`text-sm font-bold truncate ${isMore ? "text-slate-500" : isCandidate ? "text-slate-700" : "text-slate-800"}`}>
          {label}
        </span>
        
        {isCandidate && (
          <div className="flex items-center gap-1.5 mt-1">
            <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${isMore ? "text-slate-600 bg-slate-200" : "text-amber-700 bg-amber-100/80"}`}>
              {percentage}%
            </span>
            <span className="text-[10px] text-slate-500">
              ({count} مسیر)
            </span>
          </div>
        )}
      </div>

      {/* فلش ادامه مسیر فقط برای کاندیداهای واقعی */}
      {isCandidate && !isMore && (
        <div className="absolute right-3 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0 duration-300">
          <ChevronRight size={18} className="text-amber-500" />
        </div>
      )}
    </div>
  );
}

  // ─────────────────────────────────────────────────────────────────────────────
  // CUSTOM REACT FLOW EDGE (Smooth Step with Label)
  // ─────────────────────────────────────────────────────────────────────────────


  function StepEdge({
  sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data
}: EdgeProps<RFEdge<EdgeData>>) {
  const [edgePath] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
    borderRadius: 50, 
  });

  const { isCandidate, count, totalMatches, maxCount, isMore } = data || {};
  
  let strokeWidth = 2;
  let displayPercentage = 0;
  let edgeColor = "#fbbf24"; // amber-400
  let haloColor = "#fef3c7"; // amber-100
  let edgeOpacity = 0.5;

  if (isCandidate && !isMore && count != null && totalMatches != null && maxCount != null) {
    // درصدی که روی لیبل نوشته می‌شود (درصد واقعی از کل)
    displayPercentage = Math.round((count / totalMatches) * 100);
    
    // درصدی که برای استایل‌دهی استفاده می‌شود (درصد نسبی در مقایسه با بهترین کاندیدا)
    const relativePercentage = (count / maxCount) * 100;

    // ۱. محاسبه ضخامت بر اساس کاندیدای برتر (از ۲ تا ۱۴ پیکسل)
    strokeWidth = 2 + (relativePercentage / 100) * 12;

    // ۲. محاسبه شفافیت
    edgeOpacity = 0.35 + (relativePercentage / 100) * 0.65;

    // ۳. تغییر رنگ بر اساس قدرت نسبی
    if (relativePercentage >= 75) {
      edgeColor = "#ea580c"; // orange-600 (بهترین گزینه‌ها)
      haloColor = "#ffedd5"; // orange-100
    } else if (relativePercentage >= 35) {
      edgeColor = "#f59e0b"; // amber-500 (گزینه‌های متوسط)
      haloColor = "#fef3c7"; // amber-100
    } else {
      edgeColor = "#fbbf24"; // amber-400 (گزینه‌های ضعیف)
      haloColor = "#fffbeb"; // amber-50
    }

  }else if (isMore) {
    // خط مربوط به "سایر گره‌ها" (خاکستری و خنثی)
    displayPercentage = Math.round(((count || 0) / (totalMatches || 1)) * 100);
    strokeWidth = 3;
    edgeColor = "#cbd5e1"; // slate-300
    haloColor = "#f8fafc"; // slate-50
    edgeOpacity = 0.7;
  } else if (!isCandidate) {
    strokeWidth = 5;
    edgeColor = "#d97706"; // amber-600
    haloColor = "#fde68a"; // amber-200
    edgeOpacity = 1;
  }

  const customLabelX = targetX - 55; 
  const customLabelY = targetY;      

  return (
    <>
      <path
        d={edgePath}
        fill="none"
        stroke={haloColor}
        strokeWidth={strokeWidth + 8}
        strokeOpacity={0.6}
        className="transition-all duration-300"
      />
      <path
        d={edgePath}
        fill="none"
        stroke={edgeColor}
        strokeWidth={strokeWidth}
        strokeOpacity={edgeOpacity}
        strokeDasharray={isCandidate ? "6, 6" : "none"}
        className={isCandidate ? "animate-[dash_1s_linear_infinite]" : ""}
      />

      {isCandidate && displayPercentage > 0 && (
        <EdgeLabelRenderer>
          <div
            className="absolute nodrag nopan pointer-events-none"
            style={{
              transform: `translate(-50%, -50%) translate(${customLabelX}px, ${customLabelY}px)`,
              zIndex: 20,
            }}
          >
            <div 
              className="bg-white/95 backdrop-blur shadow-sm text-[11px] font-bold px-2 py-0.5 rounded-full border"
              style={{ 
                color: edgeColor, 
                borderColor: haloColor,
                opacity: edgeOpacity >= 0.8 ? 1 : 0.8
              }}
            >
              {displayPercentage}%
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

  const nodeTypes = { stepNode: StepNode };
  const edgeTypes = { stepEdge: StepEdge };

  // ─────────────────────────────────────────────────────────────────────────────
  // INNER COMPONENT
  // ─────────────────────────────────────────────────────────────────────────────

  function SankeyInner({ allVariants, allNodes }: SankeyFlowProps) {
    const { selectedPath, addNode, removeLastNode, reset } = useRouteBuilderStore();
    const { fitView, setCenter } = useReactFlow();

    const getLabel = useCallback(
      (id: string) => (allNodes.find(n => n.id === id)?.data?.label as string) || id,
      [allNodes]
    );

    const { candidates, matchCount } = useMemo(
      () => computeCandidates(selectedPath, allVariants),
      [selectedPath, allVariants]
    );

    // ─── ALGORITHMIC LAYOUT (No external library needed) ───
  const { rfNodes, rfEdges } = useMemo(() => {
      if (!selectedPath.length) return { rfNodes: [], rfEdges: [] };

      const nodes: RFNode<NodeData>[] = [];
      const edges: RFEdge<EdgeData>[] = [];

      // 1. Layout Selected Path
      selectedPath.forEach((id, i) => {
        const rfNodeId = `path-${i}-${id}`; // ساخت آیدی کاملا یکتا برای هر مرحله
        
        nodes.push({
          id: rfNodeId,
          type: "stepNode",
          position: { x: i * X_OFFSET, y: 0 },
          data: {
            label: getLabel(id),
            type: i === 0 ? "start" : i === selectedPath.length - 1 ? "current" : "selected",
            stepIndex: i,
            rawId: id // نگهداری شناسه اصلی دیتابیس
          },
        });

        if (i > 0) {
          const prevRfNodeId = `path-${i - 1}-${selectedPath[i - 1]}`;
          edges.push({
            id: `e-${prevRfNodeId}-to-${rfNodeId}`,
            source: prevRfNodeId,
            target: rfNodeId,
            type: "stepEdge",
            data: { isCandidate: false },
            animated: false,
          });
        }
      });

      // 2. Layout Candidates
      const lastRawId = selectedPath[selectedPath.length - 1];
      const lastRfNodeId = `path-${selectedPath.length - 1}-${lastRawId}`;
      
      const candX = selectedPath.length * X_OFFSET; 
      const MAX_VISIBLE = 7;
      const topCandidates = candidates.slice(0, MAX_VISIBLE);
      const hiddenCount = candidates.length - MAX_VISIBLE;
    
      // اگر کاندیدای پنهانی داریم، یک ردیف اضافی برای گره "سایر موارد" در نظر می‌گیریم
      const totalCands = hiddenCount > 0 ? topCandidates.length + 1 : topCandidates.length;
      const startY = -((totalCands - 1) * Y_OFFSET) / 2;

      const maxCandidateCount = candidates.length > 0 ? candidates[0].count : 1;

      topCandidates.forEach((c, j) => {
        const candRfId = `cand-${c.nodeId}`; // آیدی یکتا برای کاندیداها

        nodes.push({
          id: candRfId,
          type: "stepNode",
          position: { x: candX, y: startY + j * Y_OFFSET },
          data: {
            label: getLabel(c.nodeId),
            type: "candidate",
            count: c.count,
            totalMatches: matchCount,
            rawId: c.nodeId, 
          },
        });

        edges.push({
          id: `e-${lastRfNodeId}-to-${candRfId}`,
          source: lastRfNodeId,
          target: candRfId,
          type: "stepEdge",
          animated: true,
          data: { isCandidate: true, count: c.count, totalMatches: matchCount, maxCount: maxCandidateCount },
        });
      });

      // ─── اضافه کردن گره "سایر مسیرها" در صورت وجود ───
    if (hiddenCount > 0) {
      const moreId = `cand-more-hidden`;
      // جمع زدن تعداد مسیرهای پنهان شده
      const hiddenSum = candidates.slice(MAX_VISIBLE).reduce((sum, c) => sum + c.count, 0);

      nodes.push({
        id: moreId,
        type: "stepNode",
        position: { x: candX, y: startY + topCandidates.length * Y_OFFSET },
        data: {
          label: `+ ${hiddenCount} گره دیگر`,
          type: "candidate",
          count: hiddenSum,
          totalMatches: matchCount,
          maxCount: maxCandidateCount,
          rawId: "NONE",
          isMore: true,
        },
      });

      edges.push({
        id: `e-${lastRfNodeId}-to-${moreId}`,
        source: lastRfNodeId,
        target: moreId,
        type: "stepEdge",
        animated: false,
        data: { isCandidate: true, isMore: true, count: hiddenSum, totalMatches: matchCount, maxCount: maxCandidateCount },
      });
    }

      return { rfNodes: nodes, rfEdges: edges };
    }, [selectedPath, candidates, matchCount, getLabel]);

    // ─── راهکار دوم: زوم هوشمند دوربین به جای fitView کُلی ───
  useEffect(() => {
    if (rfNodes.length > 0) {
      setTimeout(() => {
        // پیدا کردن آخرین گره از مسیر انتخاب شده
        const lastSelectedNode = rfNodes.find(n => n.data.type === 'current' || n.data.type === 'start' && rfNodes.filter(x => x.data.type === 'selected').length === 0);
        
        if (lastSelectedNode) {
          // فوکوس دوربین روی مختصات Xِ گرهِ آخر (کمی متمایل به راست برای دیدن کاندیداها) و Yِ وسط صفحه
          // زوم را روی 0.9 قفل می‌کنیم تا همیشه خوانا بماند
          setCenter(lastSelectedNode.position.x + 250, 0, { zoom: 0.9, duration: 600 });
        } else {
          // اگر گرهی نبود (حالت شروع)، همان fitView عادی را انجام بده
          fitView({ padding: 0.3, duration: 600 });
        }
      }, 50);
    }
  }, [rfNodes.length, setCenter, fitView]);

    const isEmpty = selectedPath.length === 0;
    const hasTerminated = selectedPath.length > 0 && candidates.length === 0;
    const baseNodes = allNodes.filter(n => n.id !== "START_NODE" && n.id !== "END_NODE");

    return (
      <div className="relative w-full h-full bg-slate-50" dir="ltr">
        {/* تعریف انیمیشن خط چین در CSS محلی */}
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes dash {
            to { stroke-dashoffset: -10; }
          }
        `}} />

        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.1}
          maxZoom={1.5}
          proOptions={{ hideAttribution: true }}
          className="bg-gradient-to-br from-slate-50 via-slate-100/50 to-amber-50/10"
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={true}
          onNodeClick={(_, node) => {
            if (node.data.type === "candidate") {
              // استفاده از rawId به جای node.id
              addNode(node.data.rawId as string); 
            }
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={30} size={1.5} color="#cbd5e1" />
          <Controls showInteractive={false} className="!bg-white !border-slate-200 !shadow-md" />
        </ReactFlow>

        {/* ── Top bar ── */}
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-5 py-3
          bg-white/80 backdrop-blur-md border-b border-slate-200 shadow-sm" dir="rtl">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center shadow-inner text-white">
              <GitFork size={18} />
            </div>
            {/* <span className="text-sm font-bold text-slate-800">مسیرساز هوشمند</span> */}
            {selectedPath.length > 0 && (
              <div className="flex gap-2 mr-3 border-r pr-3 border-slate-300">
                <span className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-md font-medium">
                  {selectedPath.length} گره
                </span>
                <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md font-medium">
                  {matchCount} مسیر باقی‌مانده
                </span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {selectedPath.length > 0 && (
              <>
                <button onClick={removeLastNode}
                  className="flex items-center gap-1.5 text-xs text-slate-600 hover:text-amber-700
                    bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300
                    px-4 py-2 rounded-lg transition-all shadow-sm">
                  <RotateCcw size={14} /> بازگشت یک مرحله
                </button>
                <button onClick={reset}
                  className="flex items-center gap-1.5 text-xs text-rose-600 hover:text-white
                    bg-rose-50 hover:bg-rose-500 border border-rose-200 hover:border-rose-500 px-4 py-2 rounded-lg transition-all shadow-sm">
                  شروع مجدد
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── EMPTY STATE ── */}
        {isEmpty && (
          <div className="absolute inset-0 z-10 flex flex-col overflow-y-auto pt-24 pb-12 px-6
            bg-gradient-to-br from-slate-50 via-white to-amber-50/30 backdrop-blur-sm" dir="rtl">
            
            {/* Wrapper داخلی با margin-auto که باعث می‌شود محتوا در صورت کم بودن وسط بماند و در صورت زیاد بودن به درستی اسکرول شود */}
            <div className="m-auto flex flex-col items-center w-full max-w-4xl gap-8">
              
              <div className="text-center animate-in fade-in zoom-in duration-500 shrink-0">
                <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-amber-100 border-2 border-amber-200 flex items-center justify-center shadow-lg shadow-amber-100/50">
                  <Milestone size={36} className="text-amber-500" />
                </div>
                <h2 className="text-slate-800 font-extrabold text-2xl">نقطه شروع مسیر را انتخاب کنید</h2>
                <p className="text-slate-500 text-sm mt-2 max-w-md mx-auto">
                  با انتخاب اولین رویداد، الگوریتم سامانه تمام مسیرهای ممکنی که پرونده ها طی کرده‌اند را به شما پیشنهاد می‌دهد.
                </p>
              </div>
              
              {baseNodes.length > 0 ? (
                <div className="grid gap-3 w-full animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150 shrink-0"
                  style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
                  {baseNodes.map(node => (
                    <button key={node.id} onClick={() => addNode(node.id)}
                      className="group flex items-center justify-between px-5 py-4 rounded-2xl text-right
                        bg-white hover:bg-amber-50 border-2 border-slate-100 hover:border-amber-400
                        shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 cursor-pointer">
                      <span className="text-sm font-bold text-slate-700 group-hover:text-amber-800 leading-tight">
                        {node.data.label as string}
                      </span>
                      <div className="w-6 h-6 rounded-full bg-slate-50 group-hover:bg-amber-200 flex items-center justify-center transition-colors">
                        <ChevronRight size={14} className="text-slate-400 group-hover:text-amber-700 rotate-180" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 text-amber-700 px-6 py-4 rounded-xl text-sm font-medium shrink-0">
                  لطفاً ابتدا از پنل بالایی فیلتر تاریخ را اعمال کنید تا گره‌ها بارگذاری شوند.
                </div>
              )}

            </div>
          </div>
        )}

        {/* ── TERMINAL HINT ── */}
        {!isEmpty && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 pointer-events-none" dir="rtl">
            {hasTerminated ? (
              <div className="flex items-center gap-3 bg-white border-2 border-emerald-500 rounded-2xl px-6 py-3 shadow-xl animate-bounce">
                <div className="bg-emerald-100 rounded-full p-1">
                  <CheckCircle2 size={20} className="text-emerald-600" />
                </div>
                <span className="text-emerald-700 text-base font-bold">پایان مسیر — هیچ رویداد ادامه‌دهنده‌ای وجود ندارد</span>
              </div>
            ) : null}
          </div>
        )}
      </div>
    );
  }

  export default function SankeyFlow(props: SankeyFlowProps) {
    return (
      <ReactFlowProvider>
        <SankeyInner {...props} />
      </ReactFlowProvider>
    );
  }