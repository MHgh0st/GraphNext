'use client'

/**
 * @component SankeyFlow
 *
 * Sankey diagram for Route Builder, rendered INSIDE a ReactFlow canvas
 * so users get infinite pan/zoom out of the box.
 *
 * Architecture
 * ────────────
 * 1. d3-sankey computes positions in a fixed logical space (CANVAS_W × CANVAS_H).
 * 2. Each Sankey node → a ReactFlow custom node positioned at (n.x0, n.y0).
 * 3. Each Sankey link → a ReactFlow custom edge whose SVG path is pre-computed
 *    by d3-sankey (same coordinate space, so it lines up perfectly).
 * 4. ReactFlow provides pan / zoom / infinite canvas.
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
} from "@xyflow/react";
import {
  sankey as d3Sankey,
  sankeyLinkHorizontal,
  SankeyNode as D3SankeyNode,
  SankeyLink as D3SankeyLink,
  SankeyGraph,
} from "d3-sankey";
import { Node as GraphNode } from "@xyflow/react";
import {
  GitFork, RotateCcw, Milestone, CheckCircle2, ChevronRight,
} from "lucide-react";

import type { Variant } from "@/types/types";
import { useRouteBuilderStore } from "@/store/useRouteBuilderStore";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Fixed logical canvas d3-sankey uses for layout */
const CANVAS_W = 1400;
const CANVAS_H = 700;
const PAD_X    = 80;
const PAD_TOP  = 60;
const PAD_BOT  = 60;
const NODE_W   = 22;
const NODE_PAD = 20;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

type NodeType = "start" | "selected" | "current" | "candidate";

interface SankeyNodeExtra {
  id: string;
  label: string;
  type: NodeType;
  count?: number;
  stepIndex?: number;
}

interface SankeyLinkExtra {
  value: number;
}

type SNode  = D3SankeyNode<SankeyNodeExtra, SankeyLinkExtra>;
type SLink  = D3SankeyLink<SankeyNodeExtra, SankeyLinkExtra>;
type SGraph = SankeyGraph<SankeyNodeExtra, SankeyLinkExtra>;

interface RawLink { source: string; target: string; value: number; }

// RFNode data shape
interface NodeData extends Record<string, unknown> {
  label: string;
  type: NodeType;
  count?: number;
  stepIndex?: number;
  onSelect?: () => void;
  nodeWidth: number;
  nodeHeight: number;
}

// RFEdge data shape
interface EdgeData extends Record<string, unknown> {
  svgPath: string;
  linkWidth: number;
}

interface SankeyFlowProps {
  allVariants: Variant[];
  allNodes: GraphNode[];
}

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────

const COLORS: Record<NodeType, { bg: string; border: string; text: string; ring?: string }> = {
  start:     { bg: "linear-gradient(160deg,#fbbf24,#d97706)", border: "#fde68a", text: "#fff" },
  selected:  { bg: "linear-gradient(160deg,#fb923c,#ea580c)", border: "#fed7aa", text: "#fff" },
  current:   { bg: "linear-gradient(160deg,#f97316,#c2410c)", border: "#fb923c", text: "#fff", ring: "#f97316" },
  candidate: { bg: "linear-gradient(160deg,#fff,#fef9ee)",    border: "#fde68a", text: "#92400e" },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function computeCandidates(
  selectedPath: string[],
  allVariants: Variant[]
): { candidates: Array<{ nodeId: string; count: number }>; matchCount: number } {
  if (!selectedPath.length || !allVariants.length) return { candidates: [], matchCount: 0 };

  const pathSet = new Set(selectedPath);
  const map = new Map<string, number>();
  let matchCount = 0;

  for (const v of allVariants) {
    const vp = v.Variant_Path;
    const si = vp.indexOf(selectedPath[0]);
    if (si === -1) continue;
    let ok = true;
    for (let i = 1; i < selectedPath.length; i++) {
      if (vp[si + i] !== selectedPath[i]) { ok = false; break; }
    }
    if (!ok) continue;
    matchCount++;
    const ni = si + selectedPath.length;
    // Skip nodes already in path to prevent circular links
    if (ni < vp.length && !pathSet.has(vp[ni])) {
      map.set(vp[ni], (map.get(vp[ni]) ?? 0) + 1);
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
// CUSTOM REACT FLOW NODE
// ─────────────────────────────────────────────────────────────────────────────

function SankeyNodeRF({ data }: NodeProps<RFNode<NodeData>>) {
  const { label, type, count, stepIndex, onSelect, nodeWidth, nodeHeight } = data;
  const c = COLORS[type];
  const r  = Math.min(nodeWidth, nodeHeight) / 2;
  const isCandidate = type === "candidate";
  const isCurrent   = type === "current";

  return (
    <>
      {/* invisible handles so RF draws edges correctly */}
      <Handle type="target" position={Position.Left}  style={{ opacity: 0, pointerEvents: "none" }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0, pointerEvents: "none" }} />

      {/* Outer pulsing ring for candidates */}
      {isCandidate && (
        <div
          className="absolute inset-0 animate-pulse"
          style={{
            borderRadius: r + 6,
            margin: -6,
            border: "1.5px solid #f59e0b",
            opacity: 0.6,
          }}
        />
      )}

      {/* Dashed ring for current node */}
      {isCurrent && (
        <div
          className="absolute"
          style={{
            inset: -5,
            borderRadius: r + 5,
            border: "2px dashed #f97316",
            opacity: 0.7,
          }}
        />
      )}

      {/* Main pill */}
      <div
        onClick={isCandidate ? onSelect : undefined}
        style={{
          width: nodeWidth,
          height: nodeHeight,
          borderRadius: r,
          background: c.bg,
          border: `1.5px solid ${c.border}`,
          cursor: isCandidate ? "pointer" : "default",
          boxShadow: isCandidate
            ? "0 4px 16px rgba(245,158,11,0.3)"
            : "0 3px 10px rgba(245,158,11,0.2)",
          position: "relative",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Glass shine */}
        <div
          style={{
            position: "absolute",
            top: 2, left: 3, right: 3,
            height: "35%",
            borderRadius: r - 2,
            background: "rgba(255,255,255,0.35)",
          }}
        />
      </div>

      {/* Step number badge (non-candidates) */}
      {!isCandidate && stepIndex != null && (
        <div
          style={{
            position: "absolute",
            top: -12,
            left: "50%",
            transform: "translateX(-50%)",
            width: 18,
            height: 18,
            borderRadius: 9,
            background: "linear-gradient(135deg,#fbbf24,#f59e0b)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 8,
            fontWeight: 800,
            color: "#fff",
            boxShadow: "0 1px 4px rgba(245,158,11,0.4)",
          }}
        >
          {stepIndex + 1}
        </div>
      )}

      {/* Candidate count badge */}
      {isCandidate && count != null && (
        <div
          style={{
            position: "absolute",
            bottom: -18,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#fef3c7",
            border: "1px solid #fde68a",
            borderRadius: 8,
            padding: "1px 7px",
            fontSize: 9,
            fontWeight: 700,
            color: "#92400e",
            whiteSpace: "nowrap",
          }}
        >
          {count}
        </div>
      )}

      {/* Label — above for selected nodes, to the right for candidates */}
      <div
        style={{
          position: "absolute",
          ...(isCandidate
            ? { left: nodeWidth + 14, top: "50%", transform: "translateY(-50%)", textAlign: "left" }
            : { top: -30, left: "50%", transform: "translateX(-50%)", textAlign: "center", whiteSpace: "nowrap" }),
          fontSize: 11,
          fontWeight: 600,
          color: isCandidate ? "#78350f" : "#1e293b",
          maxWidth: 160,
          pointerEvents: "none",
        }}
      >
        {label.length > 26 ? label.slice(0, 25) + "…" : label}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM REACT FLOW EDGE
// ─────────────────────────────────────────────────────────────────────────────

function SankeyEdgeRF({ data }: EdgeProps<RFEdge<EdgeData>>) {
  if (!data?.svgPath) return null;
  const w = Math.max(data.linkWidth ?? 2, 2);
  return (
    <g>
      {/* glow */}
      <path d={data.svgPath} fill="none" stroke="#fbbf24" strokeWidth={w + 10} strokeOpacity={0.08} />
      {/* main */}
      <path d={data.svgPath} fill="none" stroke="#f59e0b" strokeWidth={w} strokeOpacity={0.55} />
    </g>
  );
}

const nodeTypes = { sankeyNode: SankeyNodeRF };
const edgeTypes = { sankeyEdge: SankeyEdgeRF };

// ─────────────────────────────────────────────────────────────────────────────
// INNER COMPONENT (needs useReactFlow, so inside ReactFlowProvider)
// ─────────────────────────────────────────────────────────────────────────────

function SankeyInner({
  allVariants,
  allNodes,
}: SankeyFlowProps) {
  const { selectedPath, addNode, removeLastNode, reset } = useRouteBuilderStore();
  const { fitView } = useReactFlow();

  const getLabel = useCallback(
    (id: string) => (allNodes.find(n => n.id === id)?.data?.label as string) || id,
    [allNodes]
  );

  /* ── Compute candidates ── */
  const { candidates, matchCount } = useMemo(
    () => computeCandidates(selectedPath, allVariants),
    [selectedPath, allVariants]
  );

  /* ── Build raw sankey data ── */
  const { rawNodes, rawLinks } = useMemo(() => {
    if (!selectedPath.length) return { rawNodes: [], rawLinks: [] };

    const nodes: SankeyNodeExtra[] = [];
    const links: RawLink[] = [];

    selectedPath.forEach((id, i) => {
      nodes.push({
        id,
        label: getLabel(id),
        type: i === 0 ? "start" : i === selectedPath.length - 1 ? "current" : "selected",
        stepIndex: i,
      });
    });
    candidates.forEach(c => {
      nodes.push({ id: c.nodeId, label: getLabel(c.nodeId), type: "candidate", count: c.count });
    });

    for (let i = 0; i < selectedPath.length - 1; i++)
      links.push({ source: selectedPath[i], target: selectedPath[i + 1], value: matchCount || 1 });

    const lastId = selectedPath[selectedPath.length - 1];
    candidates.forEach(c => links.push({ source: lastId, target: c.nodeId, value: c.count }));

    return { rawNodes: nodes, rawLinks: links };
  }, [selectedPath, candidates, matchCount, getLabel]);

  /* ── d3-sankey layout ── */
  const { laidOutNodes, laidOutLinks } = useMemo(() => {
    if (!rawNodes.length) return { laidOutNodes: [] as SNode[], laidOutLinks: [] as SLink[] };
    try {
      const layout = d3Sankey<SankeyNodeExtra, SankeyLinkExtra>()
        .nodeId((d: SankeyNodeExtra) => d.id)
        .nodeWidth(NODE_W)
        .nodePadding(NODE_PAD)
        .extent([[PAD_X, PAD_TOP], [CANVAS_W - PAD_X, CANVAS_H - PAD_BOT]]);

      const graph: SGraph = layout({
        nodes: rawNodes.map(n => ({ ...n })),
        links: rawLinks as unknown as Array<D3SankeyLink<SankeyNodeExtra, SankeyLinkExtra>>,
      });
      return { laidOutNodes: graph.nodes, laidOutLinks: graph.links };
    } catch (e) {
      console.error("d3-sankey layout error:", e);
      return { laidOutNodes: [] as SNode[], laidOutLinks: [] as SLink[] };
    }
  }, [rawNodes, rawLinks]);

  /* ── Convert to RF nodes / edges ── */
  const rfNodes = useMemo<RFNode<NodeData>[]>(() =>
    laidOutNodes.map((n: SNode, i: number) => {
      const nw = (n.x1 ?? 0) - (n.x0 ?? 0);
      const nh = (n.y1 ?? 0) - (n.y0 ?? 0);
      return {
        id: n.id,
        type: "sankeyNode",
        position: { x: n.x0 ?? 0, y: n.y0 ?? 0 },
        style: { width: nw, height: nh, overflow: "visible" },
        data: {
          label: n.label,
          type: n.type,
          count: n.count,
          stepIndex: i,
          onSelect: n.type === "candidate" ? () => addNode(n.id) : undefined,
          nodeWidth: nw,
          nodeHeight: nh,
        },
        draggable: false,
        selectable: false,
        connectable: false,
      };
    }),
  [laidOutNodes, addNode]);

  const rfEdges = useMemo<RFEdge<EdgeData>[]>(() =>
    laidOutLinks.map((link: SLink, i: number) => {
      const src = link.source as SNode;
      const tgt = link.target as SNode;
      return {
        id: `e-${i}`,
        source: src.id,
        target: tgt.id,
        type: "sankeyEdge",
        data: {
          svgPath: sankeyLinkHorizontal<SankeyNodeExtra, SankeyLinkExtra>()(link) || "",
          linkWidth: link.width ?? 2,
        },
        animated: false,
        interactionWidth: 0,
        selectable: false,
      };
    }),
  [laidOutLinks]);

  /* fitView whenever the nodes change */
  useEffect(() => {
    if (rfNodes.length > 0) {
      setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 50);
    }
  }, [rfNodes.length, fitView]);

  const isEmpty = selectedPath.length === 0;
  const hasTerminated = selectedPath.length > 0 && candidates.length === 0;
  const baseNodes = allNodes.filter(n => n.id !== "START_NODE" && n.id !== "END_NODE");

  return (
    <div className="relative w-full h-full">
      {/* React Flow canvas — always mounted so controls are visible */}
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={3}
        proOptions={{ hideAttribution: true }}
        className="bg-gradient-to-br from-slate-50 via-amber-50/20 to-white"
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="rgba(0,0,0,0.07)" />
        <Controls showInteractive={false} className="!bg-white !border-slate-200 !shadow-md" />
      </ReactFlow>

      {/* ── Top bar (floats above RF canvas) ── */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-5 py-3
        bg-white/80 backdrop-blur-sm border-b border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
            <GitFork size={14} className="text-amber-600" />
          </div>
          <span className="text-sm font-bold text-slate-800">مسیرساز هوشمند</span>
          {selectedPath.length > 0 && (
            <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              {selectedPath.length} گره &nbsp;•&nbsp; {matchCount} واریانت
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selectedPath.length > 0 && (
            <>
              <button onClick={removeLastNode}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-amber-700
                  bg-slate-100 hover:bg-amber-50 border border-slate-200 hover:border-amber-300
                  px-3 py-1.5 rounded-lg transition-all">
                <RotateCcw size={12} /> بازگشت
              </button>
              <button onClick={reset}
                className="flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-700
                  bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-lg transition-all">
                شروع مجدد
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── EMPTY STATE ── */}
      {isEmpty && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-6 pt-16 pb-6 px-6 overflow-y-auto
          bg-gradient-to-br from-slate-50/95 via-amber-50/50 to-white/95">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center">
              <Milestone size={28} className="text-amber-500" />
            </div>
            <p className="text-slate-700 font-bold text-lg">گره شروع را انتخاب کنید</p>
            <p className="text-slate-400 text-sm mt-1">برای شروع مسیرسازی روی یک گره کلیک کنید</p>
          </div>
          {baseNodes.length > 0 ? (
            <div className="grid gap-2 w-full max-w-2xl"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }}>
              {baseNodes.map(node => (
                <button key={node.id} onClick={() => addNode(node.id)}
                  className="group flex items-center gap-2 px-4 py-3 rounded-xl text-right
                    bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300
                    shadow-sm hover:shadow-md transition-all duration-200">
                  <ChevronRight size={14}
                    className="text-slate-300 group-hover:text-amber-500 shrink-0 rotate-180 transition-colors" />
                  <span className="text-sm text-slate-600 group-hover:text-amber-800 transition-colors leading-tight">
                    {node.data.label as string}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">ابتدا فیلتر تاریخ را اعمال کنید.</p>
          )}
        </div>
      )}

      {/* ── TERMINAL / CANDIDATE HINT ── */}
      {!isEmpty && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          {hasTerminated ? (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-2 shadow-sm">
              <CheckCircle2 size={15} className="text-emerald-500" />
              <span className="text-emerald-700 text-sm font-bold">پایان مسیر</span>
            </div>
          ) : candidates.length > 0 ? (
            <div className="bg-white/80 backdrop-blur-sm border border-slate-200 rounded-full px-4 py-1.5 shadow-sm">
              <p className="text-slate-500 text-xs">روی گره‌های نارنجی کلیک کنید تا مسیر ادامه پیدا کند</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTED WRAPPER — provides ReactFlowProvider
// ─────────────────────────────────────────────────────────────────────────────

export default function SankeyFlow(props: SankeyFlowProps) {
  return (
    <ReactFlowProvider>
      <SankeyInner {...props} />
    </ReactFlowProvider>
  );
}
