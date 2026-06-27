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
  Panel,
  getNodesBounds,
  getViewportForBounds,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Card } from "@heroui/card";
import { Button } from "@heroui/button";
import { Camera } from "lucide-react";
import { toPng } from "html-to-image";

import { StyledSmoothStepEdge } from "./graph/ui/StyledSmoothStepEdge";
import { NodeTooltip } from "./graph/ui/NodeTooltip";
import EdgeTooltip from "./graph/ui/EdgeTooltip";
import CustomNode from "./graph/ui/CustomNode";
import { formatDuration } from "../utils/formatDuration";
import type { ExtendedPath } from "../types/types";
import { useGraphStore, calculateEdgeOverride } from "../store/useGraphStore";
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
// COMPONENT
// ============================================================================

function InnerGraph({
  className = "",
}: GraphProps): React.ReactElement {
  const [zoomLevel, setZoomLevel] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const { getNodes } = useReactFlow();
  const [isExporting, setIsExporting] = useState(false);

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
    injectGhostElements,
    activePath,
    isHighlightModeActive,
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

  const selectedNodeId = useMemo(() => {
    return layoutedNodes.find((n) => n.selected)?.id;
  }, [layoutedNodes]);

  // ============================================================================
  // EFFECT: Inject Ghost Elements via Store Action
  // ============================================================================
  useEffect(() => {
    injectGhostElements(activePath, activeSideBar);
  }, [activePath, activeSideBar, injectGhostElements]);

  // DEBUG: Log when layoutedEdges changes
  useEffect(() => {
    console.log('[GRAPH DEBUG] layoutedEdges changed, count:', layoutedEdges.length);
    console.log('[GRAPH DEBUG] layoutedEdges ghost:', layoutedEdges.filter(e => (e.data as any)?.isGhost).length);
  }, [layoutedEdges]);



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
      // In highlight mode, do NOT pass pre-baked overrideData (which is from the merged activePath).
      // Let the store compute fresh tooltip values from highlightedActivePath.
      const overrideData = isHighlightModeActive ? undefined : data?.tooltipOverrideData;
      handleEdgeSelect(edge.id, overrideData);
    },
    [handleEdgeSelect, isHighlightModeActive]
  );

  const nodesForRender = useMemo(() => {
    const isHighlightingPath = selectedPathNodes.size > 0;
    
    // اصلاح منطق فیلتر: گره‌هایی رندر می‌شوند که تیک دارند یا گره شروع و پایان سیستمی هستند
    const sourceNodes =
      filteredNodeIds && filteredNodeIds.size > 0
        ? layoutedNodes.filter((node) => {
            const nodeType = (node.data?.type as string) || node.type || "";
            // 🟢 اگر گره در لیست تیک‌خورده‌ها بود، یا نوع آن start یا end بود، مجاز به رندر است
            return (
              filteredNodeIds.has(node.id) || 
              nodeType === "start" || 
              nodeType === "end" ||
              node.id.toLowerCase().includes("start") ||
              node.id.toLowerCase().includes("end")
            );
          })
        : layoutedNodes;

    return sourceNodes.map((node) => {
      const isGhost = (node.data as CustomNodeData)?.isGhost;
      const isPathHighlighted = selectedPathNodes.has(node.id);
      const isNodeSelected = node.id === selectedNodeId;
      const isHighlightManaged = (node.data as any)?._highlightActive === true;

      if (isHighlightManaged) {
        return {
          ...node,
          type: (node.data?.type as string) || "activity",
          data: { ...node.data, label: node.data?.label || node.id },
        };
      }

      let opacity = 1;
      let filter = "none";

      if (selectedNodeId) {
        if (!isNodeSelected && !isGhost) {
            opacity = 0.5;
            filter = "grayscale(100%)";
        }
      } else if (isHighlightingPath) {
        if (!isPathHighlighted && !isGhost) {
            opacity = 0.1;
            filter = "grayscale(1)";
        }
      }

      return {
        ...node,
        type: (node.data?.type as string) || "activity",
        data: { ...node.data, label: node.data?.label || node.id },
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
    const isSearchCaseMode = activeSideBar === "SearchCaseIds";

    // Detect if any edge is in explicit highlight mode (once, outside the map)
    const hasExplicitHighlight = layoutedEdges.some((e) => (e.data as any)?._highlighted === true);

    const processedEdges = layoutedEdges.map((edge) => {
      const edgeData = edge.data as CustomEdgeData | undefined;
      const isGhost = edgeData?.isGhost === true;
      const isTooltipActive = edge.id === activeTooltipEdgeId;

      const isEdgeBetweenPathNodes = selectedPathNodes.has(edge.source) && selectedPathNodes.has(edge.target);
      const isPathHighlighted = selectedPathEdges.has(edge.id) || isGhost || isEdgeBetweenPathNodes;
      // Edge is explicitly managed by highlightPath() store action
      const isHighlightManaged = (edgeData as any)?._highlighted === true;
      
      // In SearchCaseIds mode, edges in the path should be styled distinctively
      const isSearchPathEdge = isSearchCaseMode && (selectedPathEdges.has(edge.id) || isEdgeBetweenPathNodes);

      const isConnectedToSelectedNode = selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId);


      let opacity = 1;
      let grayscale = false;

      if (selectedNodeId) {
        if (!isConnectedToSelectedNode && !isGhost && !isSearchPathEdge) {
            opacity = 0.25;
            grayscale = true;
        }
      } else if (isPathFinding || isHighlightingPath) {
        if (!isPathHighlighted) {
            opacity = hasExplicitHighlight ? 0.08 : 0.25;
            grayscale = true;
        }
      }

      const override = isPathHighlighted ? calculateEdgeOverride(edge, activePath) : null;
      const displayLabel = override?.displayLabel || (edge.label as string);
      const tooltipOverride = override?.tooltipOverride;
      
      const showLabel = (isConnectedToSelectedNode || isPathHighlighted || showEdgeLabels) && opacity > 0.5;
      const finalLabel = showLabel ? displayLabel : "";

      // Determine stroke color and style based on edge type
      let strokeColor = edge.style?.stroke;
      let strokeDasharray = edge.style?.strokeDasharray;
      let strokeWidth = edge.style?.strokeWidth;
      // let animated = edge.animated;

      // Only ghost edges (edges not in base graph) get distinctive styling
      if (isGhost) {
        strokeColor = isTooltipActive ? "#FFC107" : "#f59e0b"; // Amber
        strokeDasharray = "5, 5"; // Dashed
        strokeWidth = 2.5;
        // animated = true;
      }

      // If highlightPath() is managing this edge, trust its stroke/dasharray/animated directly
      if (isHighlightManaged) {
        return {
          ...edge,
          label: finalLabel,
          hidden: false,
          animated: edge.animated, // preserve what highlightPath set
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
            // Keep all style values from highlightPath, only override zIndex and transition
            zIndex: isTooltipActive ? 1000 : 500,
            transition: "all 0.4s ease",
          },
          focusable: true,
        };
      }

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
          stroke: strokeColor,
          strokeDasharray: strokeDasharray,
          strokeWidth: strokeWidth,
          transition: "all 0.4s ease",
        },
        animated: false,
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
    
    console.log('[RENDER DEBUG] layoutedEdges count:', layoutedEdges.length);
    console.log('[RENDER DEBUG] processedEdges count:', processedEdges.length);
    
    return processedEdges;
  }, [
    layoutedEdges,
    activeTooltipEdgeId,
    selectedPathEdges,
    isPathFinding,
    activePath,
    zoomLevel,
    handleEdgeSelect,
    selectedNodeId,
    selectedPathNodes,
    activeSideBar,
  ]);

  const edgeChartProps = useMemo(() => {
    if ((activeSideBar !== "SearchCaseIds" && activeSideBar !== "Outliers") || !activeTooltipEdgeId) {
      return null;
    }

    const activeEdge = edgesForRender.find((e) => e.id === activeTooltipEdgeId);
    const activeEdgeData = activeEdge?.data as CustomEdgeData | undefined;
    
    // Check for rawDuration in tooltipOverrideData first, then fallback to pathDuration on edge.data
    const rawDuration = activeEdgeData?.tooltipOverrideData?.rawDuration 
      ?? (activeEdgeData as any)?.pathDuration;

    if (activeEdge && typeof rawDuration === "number") {
      return {
        source: activeEdge.source,
        target: activeEdge.target,
        duration: rawDuration,
      };
    }
    return null;
  }, [activeTooltipEdgeId, activeSideBar, edgesForRender]);

  const handleExport = useCallback(() => {
    // ۱. استیت لودینگ را فعال می‌کنیم
    setIsExporting(true);

    // ۲. با setTimeout پردازش را به انتهای صف Event Loop می‌فرستیم
    // این کار به مرورگر فرصت می‌دهد که بچرخد و دکمه لودینگ را به کاربر نشان دهد
    setTimeout(async () => {
      try {
        const currentNodes = getNodes();
        const visibleNodeIds = new Set(nodesForRender.map(n => n.id));
        const visibleNodes = currentNodes.filter(n => visibleNodeIds.has(n.id));

        if (visibleNodes.length === 0) {
          setIsExporting(false);
          return;
        }

        const nodesBounds = getNodesBounds(visibleNodes);
        const padding = 50;
        const imageWidth = nodesBounds.width + padding * 2;
        const imageHeight = nodesBounds.height + padding * 2;

        const viewport = getViewportForBounds(
            nodesBounds,
            imageWidth,
            imageHeight,
            1,
            1,
            padding
        );

        const viewportElement = document.querySelector(".react-flow__viewport");
        if (!viewportElement) {
          throw new Error("Viewport element not found");
        }

        // ۳. بهینه‌سازی رم: اگر گراف غول‌پیکر است، کیفیت اضافی را فدا می‌کنیم تا مرورگر کرش نکند
        const isHugeGraph = imageWidth > 4000 || imageHeight > 4000;
        const dynamicPixelRatio = isHugeGraph ? 1 : 2;

        const dataUrl = await toPng(viewportElement, {
          backgroundColor: "#ffffff",
          width: imageWidth,
          height: imageHeight,
          pixelRatio: dynamicPixelRatio,
          style: {
            width: `${imageWidth}px`,
            height: `${imageHeight}px`,
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          },
          // ۴. بهینه‌سازی سرعت: المان‌های اضافی را برای خروجی عکس پردازش نکن!
          filter: (node) => {
            // اگر گره یک المان HTML معتبر است
            if (node instanceof HTMLElement) {
              const classList = node.classList;
              // نادیده گرفتن پنل‌ها، کنترل‌ها، مینی‌مپ و تولتیپ‌های شناور
              if (
                  classList.contains('react-flow__controls') ||
                  classList.contains('react-flow__panel') ||
                  classList.contains('react-flow__minimap') ||
                  // اگر کلاس خاصی برای کاردهای تولتیپ خود دارید اینجا اضافه کنید
                  classList.contains('shadow-xl') // کلاس مربوط به Card های تولتیپ شما
              ) {
                return false;
              }
            }
            return true;
          }
        });

        const link = document.createElement("a");
        link.download = `process-graph-${new Date().toISOString().slice(0, 10)}.png`;
        link.href = dataUrl;
        link.click();
      } catch (error) {
        console.error("Failed to export image:", error);
        alert("خطا در خروجی گرفتن از تصویر گراف. ممکن است گراف بیش از حد بزرگ باشد.");
      } finally {
        // پایان لودینگ
        setIsExporting(false);
      }
    }, 100); // 100 میلی‌ثانیه زمان طلایی برای نفس کشیدن مرورگر
  }, [nodesForRender, getNodes]);

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
          <Panel position="bottom-left" className="m-4">
            <Button
              isIconOnly
              color="primary"
              variant="flat"
              size="md"
              className="bg-white/80 border border-slate-200 shadow-md backdrop-blur-md hover:bg-slate-50 rounded-xl"
              onPress={handleExport}
              isLoading={isExporting}
              title="خروجی تصویر گراف"
            >
              <Camera size={18} className="text-blue-600" />
            </Button>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}

function Graph(props: GraphProps) {
  return (
    <ReactFlowProvider>
      <InnerGraph {...props} />
    </ReactFlowProvider>
  );
}

export default memo(Graph);