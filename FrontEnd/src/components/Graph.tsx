import { useMemo, useCallback, useState, useRef, memo, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Node,
  Edge,
  MarkerType,
  applyNodeChanges,
  NodeChange,
  OnMoveEnd,
  OnMoveStart,
  EdgeMouseHandler,
  NodeMouseHandler,
  NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Card } from "@heroui/card";

import { StyledSmoothStepEdge } from "./graph/ui/StyledSmoothStepEdge";
import { NodeTooltip } from "./graph/ui/NodeTooltip";
import EdgeTooltip from "./graph/ui/EdgeTooltip";
import CustomNode from "./graph/ui/CustomNode";
import { formatDuration } from "../utils/formatDuration";
import type { ExtendedPath } from "../types/types";
import { useGraphStore } from "../store/useGraphStore";
import { useAppStore } from "../hooks/useAppStore";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface EdgeTooltipOverride {
  label?: string | number;
  meanTime?: string;
  totalTime?: string;
  rawDuration?: number;
}

interface CustomEdgeData extends Record<string, unknown> {
  tooltipOverrideData?: EdgeTooltipOverride;
  isTooltipVisible?: boolean;
  isGhost?: boolean;
  onEdgeSelect?: (id: string) => void;
}

interface CustomNodeData extends Record<string, unknown> {
  label: string;
  isGhost?: boolean;
  type?: string;
  subLabel?: string;
}

interface GraphProps {
  className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_EDGE_OPTIONS = {
  markerEnd: {
    type: MarkerType.ArrowClosed,
    height: 7,
  },
  type: "default",
  animated: false,
} as const;

const EDGE_TYPES = {
  default: StyledSmoothStepEdge,
};

const NODE_TYPES: NodeTypes = {
  start: CustomNode,
  end: CustomNode,
  activity: CustomNode,
  default: CustomNode,
};

const EDGE_LABEL_ZOOM_THRESHOLD = 0.6;

// ============================================================================
// HELPERS
// ============================================================================

function calculateEdgeOverride(
  edge: Edge,
  activePath: ExtendedPath | null,
  isHighlighted: boolean
): { displayLabel: string; tooltipOverride?: EdgeTooltipOverride } | null {
  if (!activePath || !isHighlighted) return null;

  const pathEdges = activePath.edges || [];
  const edgeIndices: number[] = [];

  pathEdges.forEach((id: string, idx: number) => {
    if (id === edge.id) edgeIndices.push(idx);
  });

  if (
    activePath._specificEdgeDurations &&
    activePath._specificEdgeDurations[edge.id] !== undefined
  ) {
    const avgDuration = activePath._specificEdgeDurations[edge.id];
    const displayLabel = formatDuration(avgDuration);
    const tooltipMeanTime = `${displayLabel} (میانگین)`;

    const count = activePath._fullPathNodes
      ? activePath._fullPathNodes.filter((_, idx) => {
          if (idx >= activePath._fullPathNodes!.length - 1) return false;
          const src = activePath._fullPathNodes![idx];
          const trg = activePath._fullPathNodes![idx + 1];
          return `${src}->${trg}` === edge.id;
        }).length
      : 1;

    return {
      displayLabel,
      tooltipOverride: {
        label: activePath._frequency,
        meanTime: tooltipMeanTime,
        totalTime: formatDuration(activePath._specificTotalDurations?.[edge.id] ?? avgDuration),
        rawDuration: avgDuration,
      },
    };
  }

  if (
    edgeIndices.length > 0 &&
    activePath._variantTimings &&
    activePath._variantTimings.length > 0 &&
    typeof activePath._startIndex === "number"
  ) {
    let totalDuration = 0;
    let count = 0;

    edgeIndices.forEach((idx) => {
      const timeIndex = activePath._startIndex! + idx;
      const start = activePath._variantTimings![timeIndex];
      const end = activePath._variantTimings![timeIndex + 1];

      if (typeof start === "number" && typeof end === "number") {
        totalDuration += Math.max(0, end - start);
        count++;
      }
    });

    if (count > 0) {
      const displayLabel = formatDuration(totalDuration);
      const tooltipMeanTime =
        count > 1 ? `${displayLabel} (مجموع ${count} بار عبور)` : displayLabel;
      const frequency = activePath._frequency || 0;
      const tooltipTotalTime = formatDuration(totalDuration * frequency);

      return {
        displayLabel,
        tooltipOverride: {
          label: frequency,
          meanTime: tooltipMeanTime,
          totalTime: tooltipTotalTime,
        },
      };
    }
  }

  return null;
}

// ============================================================================
// COMPONENT
// ============================================================================

function Graph({
  className = "",
}: GraphProps): React.ReactElement {
  const [zoomLevel, setZoomLevel] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Get state from useGraphStore
  const {
    allNodes,
    allEdges,
    layoutedNodes,
    layoutedEdges,
    isLayoutLoading: isLoading,
    loadingMessage,
    setLayoutedNodes,
    setLayoutedEdges,
    activeTooltipEdgeId,
    isEdgeCardVisible,
    isNodeCardVisible,
    nodeTooltipTitle,
    nodeTooltipData,
    edgeTooltipTitle,
    edgeTooltipData,
    isPathFinding,
    foundPaths,
    selectedEdgeId,
    handleEdgeSelect,
    handleNodeClick: graphHandleNodeClick,
    closeNodeTooltip,
    closeEdgeTooltip,
    onPaneClick,
  } = useGraphStore();

  // Get state from useAppStore
  const {
    sidebarActiveTab: activeSideBar,
    dataFilePath: filePath,
    filters,
    selectedPathNodes,
    selectedPathEdges,
    selectedPathIndex,
    variants,
    setSelectedPathNodes,
    setSelectedPathEdges,
    selectedNodeIds: filteredNodeIds, // Selected nodes from Filters tab
  } = useAppStore();

  const activePath = useMemo((): ExtendedPath | null => {
    if (selectedPathIndex !== null && foundPaths?.[selectedPathIndex]) {
      return foundPaths[selectedPathIndex] as ExtendedPath;
    }
    return null;
  }, [selectedPathIndex, foundPaths]);

  const selectedNodeId = useMemo(() => {
    return layoutedNodes.find((n) => n.selected)?.id;
  }, [layoutedNodes]);

  // ============================================================================
  // EFFECT: Inject Nodes (Smart Mode)
  // ============================================================================
  useEffect(() => {
    if (activeSideBar !== "SearchCaseIds" || !activePath?.nodes) {
      setLayoutedNodes((prev) => {
        const hasGhost = prev.some(n => (n.data as CustomNodeData).isGhost);
        if (!hasGhost) return prev;
        return prev.filter((n) => !(n.data as CustomNodeData).isGhost);
      });
      return;
    }

    setLayoutedNodes((prevNodes) => {
      const cleanNodes = prevNodes.filter((n) => !(n.data as CustomNodeData).isGhost);
      const existingNodeIds = new Set(cleanNodes.map((n) => n.id));
      
      const missingNodeIds = activePath.nodes.filter((id) => !existingNodeIds.has(id));
      
      if (missingNodeIds.length === 0) {
         if (prevNodes.length === cleanNodes.length) return prevNodes;
         return cleanNodes;
      }

      // --- تغییر کلیدی: تشخیص بر اساس allNodes اصلی ---
      // اگر allNodes خالی است، یعنی هیچ گراف زمینه‌ای لود نشده است.
      const isPureSearchMode = allNodes.length === 0;

      const newNodes = missingNodeIds.map((id, index) => ({
        id: id,
        type: "activity",
        position: { x: 50 + index * 200, y: -150 },
        data: { 
            label: id, 
            isGhost: !isPureSearchMode // فقط اگر گراف زمینه داریم، این‌ها گوست باشند
        } as CustomNodeData,
        style: isPureSearchMode 
            ? {} 
            : {
                width: "fit-content",
                border: "2px dashed #f59e0b",
                backgroundColor: "#fffbeb",
                color: "#b45309",
            },
        draggable: true,
      } as Node));

      return [...cleanNodes, ...newNodes];
    });
  }, [activePath, activeSideBar, setLayoutedNodes, allNodes.length]); // وابستگی به allNodes.length

  // ============================================================================
  // EFFECT: Inject Edges (Smart Mode)
  // ============================================================================
  useEffect(() => {
    if (activeSideBar !== "SearchCaseIds" || !activePath?.nodes) {
      setLayoutedEdges((prev) => {
          const hasGhost = prev.some(e => (e.data as CustomEdgeData).isGhost);
          if(!hasGhost) return prev;
          return prev.filter((e) => !(e.data as CustomEdgeData).isGhost);
      });
      return;
    }

    setLayoutedEdges((prevEdges) => {
      const cleanEdges = prevEdges.filter((e) => !(e.data as CustomEdgeData).isGhost);
      const existingEdgeIds = new Set(cleanEdges.map((e) => e.id));
      
      // --- تغییر کلیدی: تشخیص بر اساس allEdges اصلی ---
      const isPureSearchMode = allEdges.length === 0;
      
      const newEdges: Edge[] = [];
      const pathNodes = activePath.nodes;

      for (let i = 0; i < pathNodes.length - 1; i++) {
        const src = pathNodes[i];
        const trg = pathNodes[i + 1];
        const edgeId = `${src}->${trg}`;

        if (!existingEdgeIds.has(edgeId)) {
          newEdges.push({
            id: edgeId,
            source: src,
            target: trg,
            type: "default",
            animated: true,
            label: "",
            style: isPureSearchMode 
                ? { strokeWidth: 1.5, stroke: "#b1b1b7" } 
                : {
                    stroke: "#f59e0b",
                    strokeDasharray: "5, 5",
                    strokeWidth: 2,
                    opacity: 1,
                },
            data: { 
                isGhost: !isPureSearchMode,
            } as CustomEdgeData,
          } as Edge);
        }
      }

      if (newEdges.length === 0) {
         if ( prevEdges.length === cleanEdges.length) return prevEdges;
         return cleanEdges;
      }

      return [...cleanEdges, ...newEdges];
    });

  }, [activePath, activeSideBar, setLayoutedEdges, allEdges.length]);


  // ... (بقیه کدها بدون تغییر: onNodesChange, onMoveStart, useMemoها و ...)
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setLayoutedNodes((nds) => applyNodeChanges(changes, nds));
    },
    [setLayoutedNodes]
  );

  const onMoveStart: OnMoveStart = useCallback(() => {
    containerRef.current?.classList.add("is-interacting");
  }, []);

  const onMoveEnd: OnMoveEnd = useCallback((_event, viewport) => {
    containerRef.current?.classList.remove("is-interacting");
    setZoomLevel(viewport.zoom);
  }, []);

  const handlePaneClick = useCallback(() => {
    containerRef.current?.classList.remove("is-interacting");
    onPaneClick();
  }, [onPaneClick]);

  // Wrap handleNodeClick to pass required params from store
  const handleNodeClick = useCallback<NodeMouseHandler>(
    (event, node) => {
      containerRef.current?.classList.remove("is-interacting");
      graphHandleNodeClick(
        event, 
        node, 
        variants || [], 
        selectedPathNodes, 
        setSelectedPathNodes, 
        selectedPathEdges, 
        setSelectedPathEdges
      );
    },
    [graphHandleNodeClick, variants, selectedPathNodes, setSelectedPathNodes, selectedPathEdges, setSelectedPathEdges]
  );

  const handleEdgeClickWrapper: EdgeMouseHandler = useCallback(
    (_event, edge) => {
      containerRef.current?.classList.remove("is-interacting");
      const data = edge.data as CustomEdgeData | undefined;
      const overrideData = data?.tooltipOverrideData;
      handleEdgeSelect(edge.id, overrideData);
    },
    [handleEdgeSelect]
  );

  const nodesForRender = useMemo(() => {
    const isHighlightingPath = selectedPathNodes.size > 0;
    
    const sourceNodes =
      filteredNodeIds && filteredNodeIds.size > 0
        ? layoutedNodes.filter((node) => 
            filteredNodeIds.has(node.id) || 
            (node.data as CustomNodeData)?.isGhost ||
            selectedPathNodes.has(node.id)
          )
        : layoutedNodes;

    return sourceNodes.map((node) => {
      const isGhost = (node.data as CustomNodeData)?.isGhost;
      const isPathHighlighted = selectedPathNodes.has(node.id);
      const isNodeSelected = node.id === selectedNodeId;
      
      let opacity = 1;
      let filter = "none";

      if (selectedNodeId) {
        if (!isNodeSelected && !isGhost) {
            opacity = 0.5;
            filter = "grayscale(100%)";
        }
      } else if (isHighlightingPath) {
        if (!isPathHighlighted && !isGhost) {
            opacity = 0.5;
        }
      }

      return {
        ...node,
        type: (node.data?.type as string) || "activity",
        data: {
          ...node.data,
          label: node.data?.label || node.id,
        },
        style: {
          ...node.style,
          opacity,
          filter,
          transition: "all 0.4s ease",
        },
      };
    });
  }, [layoutedNodes, selectedPathNodes, filteredNodeIds, selectedNodeId]);

  const edgesForRender = useMemo(() => {
    const isHighlightingPath = selectedPathEdges.size > 0;
    const showEdgeLabels = zoomLevel > EDGE_LABEL_ZOOM_THRESHOLD;

    const processedEdges = layoutedEdges.map((edge) => {
      const edgeData = edge.data as CustomEdgeData | undefined;
      const isGhost = edgeData?.isGhost === true;
      const isTooltipActive = edge.id === activeTooltipEdgeId;

      const isEdgeBetweenPathNodes = selectedPathNodes.has(edge.source) && selectedPathNodes.has(edge.target);
      const isPathHighlighted = selectedPathEdges.has(edge.id) || isGhost || isEdgeBetweenPathNodes;

      const isConnectedToSelectedNode = selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId);

      let opacity = 1;
      let grayscale = false;

      if (selectedNodeId) {
        if (!isConnectedToSelectedNode && !isGhost) {
            opacity = 0.25;
            grayscale = true;
        }
      } else if (isPathFinding || isHighlightingPath) {
        if (!isPathHighlighted) {
            opacity = 0.25;
        }
      }

      const override = calculateEdgeOverride(edge, activePath, isPathHighlighted);
      const displayLabel = override?.displayLabel || (edge.label as string);
      const tooltipOverride = override?.tooltipOverride;
      
      const showLabel = (isConnectedToSelectedNode || isPathHighlighted || showEdgeLabels) && opacity > 0.5;
      const finalLabel = showLabel ? displayLabel : "";

      return {
        ...edge,
        label: finalLabel,
        hidden: false,
        data: {
          ...edge.data,
          tooltipOverrideData: tooltipOverride,
          isTooltipVisible: isTooltipActive,
          isGhost: isGhost,
          onEdgeSelect: (id: string) => {
             handleEdgeSelect(id, tooltipOverride);
          }
        } as CustomEdgeData,
        style: {
          ...(edge.style || {}),
          opacity,
          filter: grayscale ? "grayscale(100%)" : "none",
          zIndex: isTooltipActive ? 1000 : (isPathHighlighted || isConnectedToSelectedNode) ? 500 : 0,
          stroke: isGhost 
            ? (isTooltipActive 
                ? "#FFC107" 
                : (edge.selected ? edge.style?.stroke : (edge.style?.stroke || "#f59e0b"))) 
            : edge.style?.stroke,
            
          transition: "all 0.4s ease",
        },
        focusable: true,
      };
    });

    return processedEdges.sort((a, b) => {
      if (a.id === activeTooltipEdgeId) return 1;
      if (b.id === activeTooltipEdgeId) return -1;
      
      const aData = a.data as CustomEdgeData;
      const bData = b.data as CustomEdgeData;
      
      if (aData?.isGhost && !bData?.isGhost) return 1;
      if (!aData?.isGhost && bData?.isGhost) return -1;

      const aSelected = selectedPathEdges.has(a.id);
      const bSelected = selectedPathEdges.has(b.id);
      if (aSelected && !bSelected) return 1;
      if (!aSelected && bSelected) return -1;
      return 0;
    });
  }, [
    layoutedEdges,
    activeTooltipEdgeId,
    selectedPathEdges,
    isPathFinding,
    activePath,
    zoomLevel,
    handleEdgeSelect,
    selectedNodeId,
    selectedPathNodes
  ]);

  const edgeChartProps = useMemo(() => {
    if ((activeSideBar !== "SearchCaseIds" && activeSideBar !== "Outliers") || !activeTooltipEdgeId || !filePath || !filters) {
      return null;
    }

    const activeEdge = edgesForRender.find((e) => e.id === activeTooltipEdgeId);
    const activeEdgeData = activeEdge?.data as CustomEdgeData | undefined;
    const rawDuration = activeEdgeData?.tooltipOverrideData?.rawDuration;

    if (activeEdge && typeof rawDuration === "number") {
      return {
        source: activeEdge.source,
        target: activeEdge.target,
        duration: rawDuration,
        filePath,
        filters,
      };
    }
    return null;
  }, [activeTooltipEdgeId, activeSideBar, edgesForRender, filePath, filters]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <h2 className="text-lg font-medium text-white/70">{loadingMessage}</h2>
      </div>
    );
  }

  if (layoutedNodes.length === 0) {
    return (
      <div className="flex justify-center items-center h-full">
        <h2 className="text-lg font-medium text-white/50">
          هیچ داده‌ای برای نمایش وجود ندارد.
        </h2>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`${className} w-full h-full`}>
      <div className="relative w-full h-full">
        {isNodeCardVisible && (
          <Card className="absolute right-2 z-50 p-2 max-h-[250px] min-w-[40%] shadow-xl">
            <NodeTooltip
              nodeTooltipTitle={nodeTooltipTitle}
              nodeTooltipData={nodeTooltipData}
              selectedEdgeId={selectedEdgeId}
              onClose={closeNodeTooltip}
              onEdgeSelect={handleEdgeSelect}
            />
          </Card>
        )}

        {isEdgeCardVisible && (
          <Card className="absolute z-10 top-0 left-0 min-w-[40%] shadow-xl">
            <EdgeTooltip
              edgeTooltipData={edgeTooltipData}
              edgeTooltipTitle={edgeTooltipTitle}
              onClose={closeEdgeTooltip}
              chartProps={edgeChartProps}
            />
          </Card>
        )}

        <ReactFlow
          nodes={nodesForRender}
          edges={edgesForRender}
          nodeTypes={NODE_TYPES}
          edgeTypes={EDGE_TYPES}
          onNodesChange={onNodesChange}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClickWrapper}
          onPaneClick={handlePaneClick}
          onMoveStart={onMoveStart}
          onMoveEnd={onMoveEnd}
          onlyRenderVisibleElements
          minZoom={0.05}
          maxZoom={4}
          defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
          nodesConnectable={false}
          nodesDraggable
          elementsSelectable
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} size={1} />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}

export default memo(Graph);