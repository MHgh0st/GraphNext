/**
 * @deprecated This hook is deprecated. Use `useGraphStore` from `@/store/useGraphStore` instead.
 * This file is kept for backward compatibility only.
 * 
 * @see {@link useGraphStore} for the new implementation
 */
import { useState, useCallback, useMemo } from "react";
import { Node, Edge } from "@xyflow/react";
import type { Path, Variant, ExtendedPath, NodeTooltipType } from "src/types/types";
import { formatDuration } from "../../../utils/formatDuration";



function calculateEdgeOverride(
  edge: Edge,
  activePath: ExtendedPath | null | undefined
): { displayLabel: string; tooltipOverride?: any } | null {
  if (!activePath) return null;

  const pathEdges = activePath.edges || [];
  const edgeIndices: number[] = [];

  pathEdges.forEach((id: string, idx: number) => {
    if (id === edge.id) edgeIndices.push(idx);
  });

  // 1. آمار دقیق یال (برای Outliers یا Search)
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
        label: 1,
        meanTime: tooltipMeanTime,
        totalTime: formatDuration(avgDuration * count),
        rawDuration: avgDuration,
      },
    };
  }

  // 2. آمار مسیر واریانت
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

// تابع کمکی برای محاسبه اطلاعات یال از روی مسیر (برای یال‌های Ghost)
function calculatePathData(
  edgeId: string,
  activePath: ExtendedPath | null
): { label?: string | number; meanTime?: string; totalTime?: string } | null {
  if (!activePath) return null;

  const pathEdges = activePath.edges || [];
  const edgeIndices: number[] = [];

  pathEdges.forEach((id: string, idx: number) => {
    if (id === edgeId) edgeIndices.push(idx);
  });

  // ۱. حالت آمار دقیق (Specific Edge Stats)
  if (
    activePath._specificEdgeDurations &&
    activePath._specificEdgeDurations[edgeId] !== undefined
  ) {
    const avgDuration = activePath._specificEdgeDurations[edgeId];
    const displayLabel = formatDuration(avgDuration);
    const tooltipMeanTime = `${displayLabel} (میانگین)`;

    const count = activePath._fullPathNodes
      ? activePath._fullPathNodes.filter((_, idx) => {
          if (idx >= activePath._fullPathNodes!.length - 1) return false;
          const src = activePath._fullPathNodes![idx];
          const trg = activePath._fullPathNodes![idx + 1];
          return `${src}->${trg}` === edgeId;
        }).length
      : 1;

    return {
      label: 1,
      meanTime: tooltipMeanTime,
      totalTime: formatDuration(avgDuration * count),
    };
  }

  // ۲. حالت مسیر واریانت (Variant Path)
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
        label: frequency,
        meanTime: tooltipMeanTime,
        totalTime: tooltipTotalTime,
      };
    }
  }

  return null;
}

export const useGraphInteraction = (
  allNodes: Node[],
  allEdges: Edge[],
  layoutedEdges: Edge[], 
  layoutedNodes: Node[],
  variants: Variant[],
  setLayoutedNodes: React.Dispatch<React.SetStateAction<Node[]>>,
  setLayoutedEdges: React.Dispatch<React.SetStateAction<Edge[]>>,
  selectedPathNodes: Set<string>,
  setSelectedPathNodes: React.Dispatch<React.SetStateAction<Set<string>>>,
  selectedPathEdges: Set<string>,
  setSelectedPathEdges: React.Dispatch<React.SetStateAction<Set<string>>>,
  selectedPathIndex: number | null,
  setSelectedPathIndex: React.Dispatch<React.SetStateAction<number | null>>,
  selectedNodeIds: Set<string>
) => {
  const [activeTooltipEdgeId, setActiveTooltipEdgeId] = useState<string | null>(null);
  const [isNodeCardVisible, setIsNodeCardVisible] = useState<boolean>(false);
  const [isEdgeCardVisible, setIsEdgeCardVisible] = useState<boolean>(false);
  const [edgeTooltipTitle, setEdgeTooltipTitle] = useState<string | null>(null);
  const [edgeTooltipData, setEdgeTooltipData] = useState<Array<{ label: string; value: string | number }>>([]);
  const [nodeTooltipTitle, setNodeTooltipTitle] = useState<string | null>(null);
  const [nodeTooltipData, setNodeTooltipData] = useState<Array<NodeTooltipType>>([]);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [isPathFinding, setIsPathFinding] = useState(false);
  const [pathStartNodeId, setPathStartNodeId] = useState<string | null>(null);
  const [pathEndNodeId, setPathEndNodeId] = useState<string | null>(null);
  const [foundPaths, setFoundPaths] = useState<ExtendedPath[]>([]);

  // محاسبه activePath
  const activePath = useMemo((): ExtendedPath | null => {
    if (selectedPathIndex !== null && foundPaths?.[selectedPathIndex]) {
      return foundPaths[selectedPathIndex] as ExtendedPath;
    }
    return null;
  }, [selectedPathIndex, foundPaths]);

  const edgeLookupMap = useMemo(() => {
    const map = new Map<string, Edge>();
    allEdges.forEach((edge) => {
      map.set(`${edge.source}->${edge.target}`, edge);
    });
    return map;
  }, [allEdges]);

  const removePath = useCallback((indexToRemove: number) => {
    setFoundPaths((prevPaths) => prevPaths.filter((_, index) => index !== indexToRemove));
    setSelectedPathIndex((prevIndex) => {
        if (prevIndex === indexToRemove) return null;
        if (prevIndex !== null && prevIndex > indexToRemove) return prevIndex - 1;
        return prevIndex;
    });
  }, [setSelectedPathIndex]);

  const calculatePathDuration = useCallback((path: Path) => {
    const extPath = path as ExtendedPath;
    if (typeof extPath._variantDuration === "number") {
      return {
        totalDuration: extPath._variantDuration,
        averageDuration: path.edges.length > 0 ? extPath._variantDuration : 0,
      };
    }
    return { totalDuration: 0, averageDuration: 0 };
  }, []);

  const handleEdgeSelect = useCallback(
    (
      edgeId: string,
      overrides?: {
        label?: string | number;
        meanTime?: string;
        totalTime?: string;
      }
    ) => {
      setSelectedEdgeId(edgeId);
      // ابتدا در layoutedEdges (شامل Ghost) جستجو کن، اگر نبود در allEdges
      const selectedEdge = layoutedEdges.find((e) => e.id === edgeId) || allEdges.find((e) => e.id === edgeId);

      setLayoutedEdges((prevEdges) => {
        return prevEdges.map((edge) => {
          const isSelected = edge.id === edgeId;
          const originalStroke = (edge.data as any)?.originalStroke || "#3b82f6";
          const originalStrokeWidth = (edge.data as any)?.originalStrokeWidth ?? 2;

          return {
            ...edge,
            selected: isSelected,
            style: {
              ...(edge.style || {}),
              strokeWidth: isSelected ? 4 : originalStrokeWidth,
              stroke: isSelected ? "#FFC107" : originalStroke,
              zIndex: isSelected ? 500 : undefined,
            },
          };
        });
      });

      const isGhostEdge = (selectedEdge?.data as any)?.isGhost;
      
      // اگر اوررایدها نیامده‌اند (مثلاً کلیک از لیست NodeTooltip)، خودمان محاسبه می‌کنیم
      let finalOverrides = overrides;
      if (!finalOverrides && activePath) {
         // اگر یال انتخاب شده است ولی اطلاعاتش پاس داده نشد (مثلا از لیست نود انتخاب شده)
         const calculated = calculateEdgeOverride(selectedEdge!, activePath);
         if (calculated?.tooltipOverride) {
             finalOverrides = calculated.tooltipOverride;
         }
      }

      if (selectedEdge || isGhostEdge) {
        const dataToShow: Array<{ label: string; value: string | number }> = [];
        
        const labelValue = finalOverrides?.label !== undefined 
          ? finalOverrides.label 
          : (selectedEdge?.data?.Case_Count as string | number);
        
        if (labelValue !== undefined) dataToShow.push({ label: "تعداد", value: labelValue });

        const meanTimeValue = finalOverrides?.meanTime || (selectedEdge?.data?.Tooltip_Mean_Time as string);
        if (meanTimeValue) dataToShow.push({ label: "میانگین زمان", value: meanTimeValue });

        const totalTimeValue = finalOverrides?.totalTime || (selectedEdge?.data?.Tooltip_Total_Time as string);
        if (totalTimeValue) dataToShow.push({ label: "زمان کل", value: totalTimeValue });

        setEdgeTooltipData(dataToShow);

        const sourceId = selectedEdge?.source || edgeId.split("->")[0];
        const targetId = selectedEdge?.target || edgeId.split("->")[1];
        
        // پیدا کردن نام گره‌ها (از layoutedNodes استفاده می‌کنیم که Ghostها را دارد)
        const sourceNode = layoutedNodes.find((n) => n.id === sourceId) || allNodes.find((n) => n.id === sourceId);
        const targetNode = layoutedNodes.find((n) => n.id === targetId) || allNodes.find((n) => n.id === targetId);
        
        setEdgeTooltipTitle(`از یال ${sourceNode?.data?.label || sourceId} به ${targetNode?.data?.label || targetId}`);
        setIsEdgeCardVisible(true);
        setActiveTooltipEdgeId(edgeId);
      } else {
        setIsEdgeCardVisible(false);
        setActiveTooltipEdgeId(null);
      }

      setLayoutedNodes((prevNodes) => prevNodes.map((node) => ({ ...node, selected: false })));
    },
    [allEdges, layoutedEdges, allNodes, layoutedNodes, activePath, setLayoutedEdges, setLayoutedNodes]
  );

  const handleSelectPath = (path: Path, index: number) => {
    setSelectedPathNodes(new Set(path.nodes));
    setSelectedPathEdges(new Set(path.edges));
    setSelectedPathIndex(index);
  };

  const handleSelectOutlier = (outlierPath: Path, index: number) => {
    setSelectedPathEdges(new Set(outlierPath.edges));
    setSelectedPathNodes(new Set(outlierPath.nodes));
    setFoundPaths([outlierPath]);
    setSelectedPathIndex(0);
  }

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setActiveTooltipEdgeId(null);

      if (!isPathFinding) {
        const nodeLabel = (node.data?.label as string) || node.id;
        
        const outgoingEdges = layoutedEdges.filter(e => e.source === node.id);
        const incomingEdges = layoutedEdges.filter(e => e.target === node.id);
        
        const outgoingEdgeIds = new Set(outgoingEdges.map(e => e.id));
        const incomingEdgeIds = new Set(incomingEdges.map(e => e.id));

        // تابع کمکی برای لیبل نود
        const getNodeLabel = (id: string) => {
            const n = layoutedNodes.find(n => n.id === id) || allNodes.find(n => n.id === id);
            return (n?.data?.label as string) || id;
        };

        // --- تابع کمکی جدید برای محاسبه لیبل یال (شامل Ghost) ---
        const getEdgeLabel = (edge: Edge) => {
            // اگر activePath داریم (مثلاً در جستجوی پرونده یا Outlier)، اولویت با دیتای محاسبه شده از مسیر است
            if (activePath) {
               const override = calculateEdgeOverride(edge, activePath);
               if (override?.displayLabel) return override.displayLabel;
            }
            // اگر یال معمولی است و لیبل استاتیک دارد
            if (edge.label && edge.label !== "") return edge.label as string;
            
            return "N/A";
        };

        // ساخت داده‌ها با استفاده از getEdgeLabel
        const outgoingTooltipData = outgoingEdges.map((edge) => ({
          label: getNodeLabel(edge.target),
          weight: getEdgeLabel(edge), // <--- اینجا از تابع جدید استفاده می‌کنیم
          edgeId: edge.id,
          direction: "outgoing",
        }));

        const incomingTooltipData = incomingEdges.map((edge) => ({
          label: getNodeLabel(edge.source),
          weight: getEdgeLabel(edge), // <--- اینجا از تابع جدید استفاده می‌کنیم
          edgeId: edge.id,
          direction: "incoming",
        }));

        setIsNodeCardVisible(true);
        setNodeTooltipData([...outgoingTooltipData, ...incomingTooltipData] as any);
        setNodeTooltipTitle(nodeLabel);

        // هایلایت
        setLayoutedNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === node.id })));

        setLayoutedEdges((prevEdges) =>
          prevEdges.map((edge) => {
            const originalStroke = (edge.data as any)?.originalStroke || "#05ff69ff";
            const originalStrokeWidth = (edge.data as any)?.originalStrokeWidth ?? 2;

            const isOutgoing = outgoingEdgeIds.has(edge.id);
            const isIncoming = incomingEdgeIds.has(edge.id);
            
            let strokeColor = originalStroke;
            if (isOutgoing) strokeColor = "#ef4444"; 
            else if (isIncoming) strokeColor = "#a6058eff"; 

            const isSelected = isOutgoing || isIncoming;

            return {
              ...edge,
              selected: isSelected,
              style: {
                ...edge.style,
                stroke: strokeColor,
                zIndex: isSelected ? 1000 : undefined,
                strokeWidth: isSelected ? 3 : originalStrokeWidth,
              },
            };
          })
        );
        return;
      }

      // ... (بخش مسیریابی بدون تغییر) ...
      setActiveTooltipEdgeId(null);

      if (!pathStartNodeId) {
        setPathStartNodeId(node.id);
        setPathEndNodeId(null);
        setFoundPaths([]);
        setSelectedPathNodes(new Set([node.id]));
        setSelectedPathEdges(new Set());
        return;
      }

      if (pathStartNodeId && !pathEndNodeId && node.id !== pathStartNodeId) {
        const endId = node.id;
        setPathEndNodeId(endId);

        const validPaths: ExtendedPath[] = [];
        variants.forEach((variant) => {
          let startIdx = pathStartNodeId === "START_NODE" ? 0 : variant.Variant_Path.indexOf(pathStartNodeId);
          let endIdx = endId === "END_NODE" ? variant.Variant_Path.length - 1 : variant.Variant_Path.lastIndexOf(endId);

          if (startIdx !== -1 && endIdx !== -1 && startIdx < endIdx) {
            const pathNodes = variant.Variant_Path.slice(startIdx, endIdx + 1);
            const pathEdges: string[] = [];
            for (let i = 0; i < pathNodes.length - 1; i++) {
              const source = pathNodes[i];
              const target = pathNodes[i + 1];
              pathEdges.push(`${source}->${target}`);
            }

            const accurateDuration = variant.Avg_Timings[endIdx] - variant.Avg_Timings[startIdx];

            validPaths.push({
              nodes: pathNodes,
              edges: pathEdges,
              _variantDuration: accurateDuration,
              _frequency: variant.Frequency,
              _fullPathNodes: variant.Variant_Path,
              _startIndex: startIdx,
              _endIndex: endIdx,
              _pathType: startIdx === 0 && endIdx === variant.Variant_Path.length - 1 ? "absolute" : "relative",
              _variantTimings: variant.Avg_Timings,
            });
          }
        });

        setFoundPaths(validPaths);
        setSelectedPathNodes(new Set([pathStartNodeId, endId]));
        setSelectedPathEdges(new Set());
        return;
      }

      setPathStartNodeId(node.id);
      setPathEndNodeId(null);
      setFoundPaths([]);
      setSelectedPathNodes(new Set([node.id]));
      setSelectedPathEdges(new Set());
    },
    [
      isPathFinding,
      pathStartNodeId,
      pathEndNodeId,
      layoutedEdges, 
      layoutedNodes, 
      allNodes,
      variants,
      activePath, 
      setLayoutedEdges,
      setLayoutedNodes,
      setSelectedPathNodes,
      setSelectedPathEdges,
    ]
  );

  const closeNodeTooltip = () => {
    setIsNodeCardVisible(false);
    setNodeTooltipTitle(null);
    setLayoutedNodes((nds) => nds.map((n) => ({ ...n, selected: false })));  
    setLayoutedEdges((eds) =>
      eds.map((e) => ({
        ...e,
        selected: false,
        style: {
          ...e.style,
          stroke: (e.data as any)?.originalStroke || "#3b82f6",
          strokeWidth: (e.data as any)?.originalStrokeWidth || 2,
        },
      }))
    );
    closeEdgeTooltip();
  };

  const closeEdgeTooltip= () => {
    setIsEdgeCardVisible(false)
    setSelectedEdgeId(null);
    setActiveTooltipEdgeId(null);
    setLayoutedEdges((eds) =>
      eds.map((e) => ({
        ...e,
        selected: false,
        style: {
          ...e.style,
          stroke: (e.data as any)?.originalStroke || "#3b82f6",
          strokeWidth: (e.data as any)?.originalStrokeWidth || 2,
        },
      }))
    );
  }

  const resetPathfinding = () => {
    setIsPathFinding(false);
    setPathStartNodeId(null);
    setPathEndNodeId(null);
    setFoundPaths([]);
    setSelectedPathNodes(new Set());
    setSelectedPathEdges(new Set());
    setSelectedPathIndex(null);
  };

  const onPaneClick = useCallback(() => {
    setActiveTooltipEdgeId(null);
    closeNodeTooltip();
  }, [closeNodeTooltip]);

  return {
    activeTooltipEdgeId,
    isNodeCardVisible,
    isEdgeCardVisible,
    nodeTooltipTitle,
    nodeTooltipData,
    edgeTooltipTitle,
    edgeTooltipData,
    isPathFinding,
    pathStartNodeId,
    pathEndNodeId,
    foundPaths,
    selectedEdgeId,
    isPathfindingLoading: false, 
    handleEdgeSelect,
    handleSelectPath,
    handleNodeClick,
    closeNodeTooltip,
    closeEdgeTooltip,
    setIsPathFinding,
    setIsNodeCardVisible,
    setIsEdgeCardVisible,
    resetPathfinding,
    calculatePathDuration,
    onPaneClick,
    removePath,
    handleSelectOutlier
  };
};
