/**
 * @module store/useGraphStore
 * @description
 * Unified Zustand store for all graph-related state and actions.
 * Combines functionality from useGraphLayout and useGraphInteraction hooks.
 * 
 * Provides global access to:
 * - Graph layout state (nodes, edges, loading)
 * - Interaction state (selection, tooltips, pathfinding)
 * - All graph manipulation actions
 */

import { create } from "zustand";
import { Node, Edge } from "@xyflow/react";
import ELK from "elkjs/lib/elk.bundled.js";
import { colorPalettes } from "../constants/colorPalettes";
import { formatDuration } from "../utils/formatDuration";
import type { Path, Variant, ExtendedPath, NodeTooltipType } from "../types/types";

// ============================================================================
// TYPES
// ============================================================================

export interface ActivePathInfo {
  nodes: string[];
  edges: string[];
  /** Edge average durations keyed by edge ID (e.g., "A->B": 3600) in seconds */
  edgeDurations?: Record<string, number>;
  /** Edge total durations keyed by edge ID (from Total_Timings) in seconds */
  edgeTotalDurations?: Record<string, number>;
  /** Frequency of this path */
  frequency?: number;
}

export interface SearchCasePathInfo {
  nodes: string[];
  edges: string[];
}

export interface LayoutConfig {
  graphData: any[] | null;
  colorPaletteKey: string;
  startEndNodes: { start: string[]; end: string[] };
  filteredNodeIds: Set<string>;
  filteredEdgeIds: Set<string> | null;
  activePathInfo?: ActivePathInfo;
  searchCasePathInfo?: SearchCasePathInfo;
}

interface GraphState {
  // Layout State
  allNodes: Node[];
  allEdges: Edge[];
  layoutedNodes: Node[];
  layoutedEdges: Edge[];
  isLayoutLoading: boolean;
  loadingMessage: string;
  
  // Interaction State
  activeTooltipEdgeId: string | null;
  selectedEdgeId: string | null;
  isNodeCardVisible: boolean;
  isEdgeCardVisible: boolean;
  nodeTooltipTitle: string | null;
  nodeTooltipData: NodeTooltipType[];
  edgeTooltipTitle: string | null;
  edgeTooltipData: Array<{ label: string; value: string | number }>;
  
  // Pathfinding State
  isPathFinding: boolean;
  pathStartNodeId: string | null;
  pathEndNodeId: string | null;
  foundPaths: ExtendedPath[];
  activePath: ExtendedPath | null;
  
  // Internal refs
  _workerRef: Worker | null;
  _elkInstance: InstanceType<typeof ELK> | null;
  _edgeLookupMap: Map<string, Edge>;
}

interface GraphActions {
  // Layout Actions
  setAllNodes: (nodes: Node[]) => void;
  setAllEdges: (edges: Edge[]) => void;
  setLayoutedNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void;
  setLayoutedEdges: (edges: Edge[] | ((prev: Edge[]) => Edge[])) => void;
  setIsLayoutLoading: (loading: boolean) => void;
  setLoadingMessage: (message: string) => void;
  
  // Compute Layout
  computeLayout: (config: LayoutConfig) => Promise<void>;
  processInitialData: (graphData: any[], startActivities: string[], endActivities: string[]) => void;
  
  // Interaction Actions
  handleNodeClick: (event: React.MouseEvent, node: Node, variants: Variant[], selectedPathNodes: Set<string>, setSelectedPathNodes: (nodes: Set<string>) => void, selectedPathEdges: Set<string>, setSelectedPathEdges: (edges: Set<string>) => void) => void;
  handleEdgeSelect: (edgeId: string, overrides?: { label?: string | number; meanTime?: string; totalTime?: string }) => void;
  handleSelectPath: (path: Path, index: number, setSelectedPathNodes: (nodes: Set<string>) => void, setSelectedPathEdges: (edges: Set<string>) => void, setSelectedPathIndex: (index: number) => void) => void;
  handleSelectOutlier: (outlierPath: Path, setSelectedPathNodes: (nodes: Set<string>) => void, setSelectedPathEdges: (edges: Set<string>) => void, setSelectedPathIndex: (index: number | null) => void) => void;
  
  // Tooltip Actions
  closeNodeTooltip: () => void;
  closeEdgeTooltip: () => void;
  onPaneClick: () => void;
  
  // Pathfinding Actions
  setIsPathFinding: (value: boolean) => void;
  setPathStartNodeId: (id: string | null) => void;
  setPathEndNodeId: (id: string | null) => void;
  setFoundPaths: (paths: ExtendedPath[]) => void;
  setActivePath: (path: ExtendedPath | null) => void;
  removePath: (index: number, selectedPathIndex: number | null, setSelectedPathIndex: (index: number | null) => void) => void;
  resetPathfinding: (setSelectedPathNodes: (nodes: Set<string>) => void, setSelectedPathEdges: (edges: Set<string>) => void, setSelectedPathIndex: (index: number | null) => void) => void;
  calculatePathDuration: (path: Path) => { totalDuration: number; averageDuration: number };
  
  // Visibility Actions
  setIsNodeCardVisible: (visible: boolean) => void;
  setIsEdgeCardVisible: (visible: boolean) => void;
  
  // Initialization
  initializeWorker: () => void;
  cleanupWorker: () => void;
  updateEdgeLookupMap: () => void;
}

type GraphStore = GraphState & GraphActions;

// ============================================================================
// CONSTANTS
// ============================================================================

const layoutOptions = {
  algorithm: "layered",
  direction: "RIGHT",
  "layered.layering.strategy": "LONGEST_PATH",
  "layered.nodePlacement.strategy": "BRANDES_KOEPF",
  "layered.spacing.layerLayer": "600",
  "layered.spacing.nodeNode": "300",
  "layered.spacing.nodeNodeBetweenLayers": "300",
  "elk.edgeRouting": "ORTHOGONAL",
  "layered.mergeEdges": "true",
  "spacing.edgeNode": "40",
  "spacing.edgeEdge": "30",
  "elk.separateConnectedComponents": "true",
  "layered.crossingMinimization.strategy": "LAYER_SWEEP",
  "layered.crossingMinimization.semiInteractive": "true",
  "org.eclipse.elk.portConstraints": "FIXED_SIDE",
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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

  // Specific edge stats
  if (
    activePath._specificEdgeDurations &&
    activePath._specificEdgeDurations[edge.id] !== undefined
  ) {
    const avgDuration = activePath._specificEdgeDurations[edge.id];
    const displayLabel = formatDuration(avgDuration);
    const tooltipMeanTime = `${displayLabel} (میانگین)`;
    
    // Use path frequency instead of hardcoded 1
    const pathFrequency = activePath._frequency || activePath.frequency || 1;
    
    // Use Total_Timings if available, otherwise fall back to avgDuration
    const totalDuration = (activePath as any)._specificTotalDurations?.[edge.id] ?? avgDuration;

    return {
      displayLabel,
      tooltipOverride: {
        label: pathFrequency,
        meanTime: tooltipMeanTime,
        totalTime: formatDuration(totalDuration),
        rawDuration: avgDuration,
      },
    };
  }

  // Variant path stats
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
// STORE
// ============================================================================

export const useGraphStore = create<GraphStore>((set, get) => ({
  // Initial Layout State
  allNodes: [],
  allEdges: [],
  layoutedNodes: [],
  layoutedEdges: [],
  isLayoutLoading: false,
  loadingMessage: "در حال بارگذاری داده‌ها...",
  
  // Initial Interaction State
  activeTooltipEdgeId: null,
  selectedEdgeId: null,
  isNodeCardVisible: false,
  isEdgeCardVisible: false,
  nodeTooltipTitle: null,
  nodeTooltipData: [],
  edgeTooltipTitle: null,
  edgeTooltipData: [],
  
  // Initial Pathfinding State
  isPathFinding: false,
  pathStartNodeId: null,
  pathEndNodeId: null,
  foundPaths: [],
  activePath: null,
  
  // Internal refs
  _workerRef: null,
  _elkInstance: null,
  _edgeLookupMap: new Map(),

  // ============================================================================
  // LAYOUT ACTIONS
  // ============================================================================
  
  setAllNodes: (nodes) => set({ allNodes: nodes }),
  setAllEdges: (edges) => set({ allEdges: edges }),
  
  setLayoutedNodes: (nodesOrUpdater) => {
    if (typeof nodesOrUpdater === "function") {
      set((state) => ({ layoutedNodes: nodesOrUpdater(state.layoutedNodes) }));
    } else {
      set({ layoutedNodes: nodesOrUpdater });
    }
  },
  
  setLayoutedEdges: (edgesOrUpdater) => {
    if (typeof edgesOrUpdater === "function") {
      set((state) => ({ layoutedEdges: edgesOrUpdater(state.layoutedEdges) }));
    } else {
      set({ layoutedEdges: edgesOrUpdater });
    }
  },
  
  setIsLayoutLoading: (loading) => set({ isLayoutLoading: loading }),
  setLoadingMessage: (message) => set({ loadingMessage: message }),

  initializeWorker: () => {
    // Worker initialization moved to component level for now
    // since dynamic imports need React context
  },

  cleanupWorker: () => {
    const { _workerRef } = get();
    if (_workerRef) {
      _workerRef.terminate();
      set({ _workerRef: null });
    }
  },

  processInitialData: (graphData, startActivities, endActivities) => {
    // Process raw data into nodes and edges
    const nodesMap: Map<string, Node> = new Map();
    const edgesMap: Map<string, Edge> = new Map();

    // Collect all valid node IDs from graph data
    const validNodeIds = new Set<string>();
    graphData.forEach((item: any) => {
      validNodeIds.add(item.Source_Activity);
      validNodeIds.add(item.Target_Activity);
    });

    graphData.forEach((item: any) => {
      const source = item.Source_Activity;
      const target = item.Target_Activity;

      // Create source node if not exists
      if (!nodesMap.has(source)) {
        nodesMap.set(source, {
          id: source,
          type: "activity",
          position: { x: 0, y: 0 },
          data: {
            label: source,
            type: "activity",
            isStart: startActivities.includes(source),
            isEnd: endActivities.includes(source),
          },
          style: { width: 250 },
          draggable: true,
        });
      }

      // Create target node if not exists
      if (!nodesMap.has(target)) {
        nodesMap.set(target, {
          id: target,
          type: "activity",
          position: { x: 0, y: 0 },
          data: {
            label: target,
            type: "activity",
            isStart: startActivities.includes(target),
            isEnd: endActivities.includes(target),
          },
          style: { width: 250 },
          draggable: true,
        });
      }

      // Create edge
      const edgeId = `${source}->${target}`;
      if (!edgesMap.has(edgeId)) {
        edgesMap.set(edgeId, {
          id: edgeId,
          source,
          target,
          type: "default",
          label: item.Edge_Label,
          data: {
            Weight_Value: item.Weight_Value,
            Case_Count: item.Case_Count,
            Mean_Duration_Seconds: item.Mean_Duration_Seconds,
            Tooltip_Total_Time: item.Tooltip_Total_Time,
            Tooltip_Mean_Time: item.Tooltip_Mean_Time,
          },
        });
      }
    });

    // Create START_NODE
    const startNode: Node = {
      id: "START_NODE",
      type: "start",
      position: { x: 0, y: 0 },
      data: { label: "شروع", type: "start" },
      style: { width: 150 },
      draggable: true,
    };
    nodesMap.set("START_NODE", startNode);

    // Create END_NODE
    const endNode: Node = {
      id: "END_NODE",
      type: "end",
      position: { x: 0, y: 0 },
      data: { label: "پایان", type: "end" },
      style: { width: 150 },
      draggable: true,
    };
    nodesMap.set("END_NODE", endNode);

    // Create edges from START_NODE to start activities
    startActivities
      .filter((targetId) => validNodeIds.has(targetId))
      .forEach((targetNodeId) => {
        const edgeId = `start-to-${targetNodeId}`;
        edgesMap.set(edgeId, {
          id: edgeId,
          source: "START_NODE",
          target: targetNodeId,
          type: "default",
          data: { originalStroke: "#a0aec0", originalStrokeWidth: 1.5 },
          style: { stroke: "#a0aec0", strokeDasharray: "5 5" },
        });
      });

    // Create edges from end activities to END_NODE
    endActivities
      .filter((sourceId) => validNodeIds.has(sourceId))
      .forEach((sourceNodeId) => {
        const edgeId = `${sourceNodeId}-to-end`;
        edgesMap.set(edgeId, {
          id: edgeId,
          source: sourceNodeId,
          target: "END_NODE",
          type: "default",
          data: { originalStroke: "#a0aec0", originalStrokeWidth: 1.5 },
          style: { stroke: "#a0aec0", strokeDasharray: "5 5" },
        });
      });

    set({
      allNodes: Array.from(nodesMap.values()),
      allEdges: Array.from(edgesMap.values()),
    });
  },

  computeLayout: async (config) => {
    const { allNodes, allEdges } = get();
    const {
      colorPaletteKey,
      filteredNodeIds,
      filteredEdgeIds,
      activePathInfo,
      searchCasePathInfo,
    } = config;

    let nodesToLayout = [...allNodes];
    let edgesToLayout = [...allEdges];

    // Apply node filters
    if (nodesToLayout.length > 0 && filteredNodeIds.size > 0) {
      // Create extended set that always includes START_NODE and END_NODE (unless in pathfinding mode)
      const extendedNodeIds = new Set(filteredNodeIds);
      
      // Only include START/END nodes if we are NOT showing a specific path
      if (!activePathInfo) {
        extendedNodeIds.add("START_NODE");
        extendedNodeIds.add("END_NODE");
      }
      
      // Filter nodes to include selected ones plus START/END
      nodesToLayout = nodesToLayout.filter((node) => extendedNodeIds.has(node.id));
      
      // Filter edges: include if both source and target are in extended set
      // This ensures START->activity and activity->END edges are included
      edgesToLayout = edgesToLayout.filter((edge) => 
        extendedNodeIds.has(edge.source) && extendedNodeIds.has(edge.target)
      );
    }

    // Apply edge filters
    if (edgesToLayout.length > 0 && filteredEdgeIds && filteredEdgeIds.size > 0) {
      edgesToLayout = edgesToLayout.filter((edge) => filteredEdgeIds.has(edge.id));
    }

    // Add Ghost Nodes (from activePathInfo)
    if (activePathInfo?.nodes && activePathInfo.nodes.length > 0) {
      const existingNodeIds = new Set(nodesToLayout.map((n) => n.id));
      const ghostNodeIds = activePathInfo.nodes.filter((id) => !existingNodeIds.has(id));

      const ghostNodes = ghostNodeIds.map((id: string) => ({
        id: id,
        type: "activity",
        position: { x: 0, y: 0 },
        data: { label: id, isGhost: true },
        style: {
          width: 250,
          border: "2px dashed #f59e0b",
          backgroundColor: "#fffbeb",
          color: "#b45309",
        },
        draggable: true,
      } as Node));

      nodesToLayout = [...nodesToLayout, ...ghostNodes];
    }

    // Add Ghost Edges
    if (activePathInfo?.edges && activePathInfo.edges.length > 0) {
      const existingEdgeIds = new Set(edgesToLayout.map((e) => e.id));
      const ghostEdgeIds = activePathInfo.edges.filter((id) => !existingEdgeIds.has(id));

      const ghostEdges = ghostEdgeIds.map((edgeId: string) => {
        const [source, target] = edgeId.split("->") as [string, string];
        return {
          id: edgeId,
          source: source,
          target: target,
          type: "default",
          animated: true,
          label: "",
          style: {
            stroke: "#f59e0b",
            strokeDasharray: "5, 5",
            strokeWidth: 2,
          },
          data: { isGhost: true },
        } as Edge;
      });

      edgesToLayout = [...edgesToLayout, ...ghostEdges];
    }

    // Add Search Case Nodes (non-ghosted)
    if (searchCasePathInfo?.nodes && searchCasePathInfo.nodes.length > 0) {
      const existingNodeIds = new Set(nodesToLayout.map((n) => n.id));
      const newNodeIds = searchCasePathInfo.nodes.filter((id) => !existingNodeIds.has(id));

      const newNodes = newNodeIds.map((id: string) => ({
        id: id,
        type: "activity",
        position: { x: 0, y: 0 },
        data: { label: id, isGhost: false },
        style: { width: 250 },
        draggable: true,
      } as Node));

      nodesToLayout = [...nodesToLayout, ...newNodes];
    }

    // Add Search Case Edges (non-ghosted)
    if (searchCasePathInfo?.edges && searchCasePathInfo.edges.length > 0) {
      const existingEdgeIds = new Set(edgesToLayout.map((e) => e.id));
      const newEdgeIds = searchCasePathInfo.edges.filter((id) => !existingEdgeIds.has(id));

      const newEdges = newEdgeIds.map((edgeId: string) => {
        const [source, target] = edgeId.split("->") as [string, string];
        return {
          id: edgeId,
          source: source,
          target: target,
          type: "default",
          animated: false,
          label: "",
          style: { strokeWidth: 2 },
          data: { isGhost: false },
        } as Edge;
      });

      edgesToLayout = [...edgesToLayout, ...newEdges];
    }

    // If nothing to layout, clear and return
    if (nodesToLayout.length === 0) {
      set({ layoutedNodes: [], layoutedEdges: [], isLayoutLoading: false });
      return;
    }

    set({ isLayoutLoading: true, loadingMessage: "در حال محاسبه چیدمان گراف..." });

    try {
      const elk = new ELK();
      const nodeHeight = 50;

      const elkNodes = nodesToLayout.map((node: Node) => {
        const elkNode: any = {
          id: node.id,
          width: (node.style?.width as number) || 250,
          height: nodeHeight,
        };

        if (node.id === "START_NODE") {
          elkNode.layoutOptions = {
            "org.eclipse.elk.layered.layering.layerConstraint": "FIRST",
          };
        }

        if (node.id === "END_NODE") {
          elkNode.layoutOptions = {
            "org.eclipse.elk.layered.layering.layerConstraint": "LAST",
          };
        }

        return elkNode;
      });

      const elkEdges = edgesToLayout.map((edge: Edge) => ({
        id: edge.id,
        sources: [edge.source],
        targets: [edge.target],
      }));

      const graphToLayout = {
        id: "root",
        layoutOptions: layoutOptions,
        children: elkNodes,
        edges: elkEdges,
      };

      const layoutedGraph: any = await elk.layout(graphToLayout);

      const newLayoutedNodes = nodesToLayout.map((node) => {
        const elkNode = layoutedGraph.children.find((n: any) => n.id === node.id);
        return {
          ...node,
          position: { x: elkNode?.x || 0, y: elkNode?.y || 0 },
        };
      });

      // Calculate weight range for coloring
      let minWeight = Infinity;
      let maxWeight = -Infinity;
      edgesToLayout.forEach((edge) => {
        if ((edge.data as any)?.isGhost) return;
        const weight = ((edge.data as any)?.Weight_Value as number) || 0;
        if (weight < minWeight) minWeight = weight;
        if (weight > maxWeight) maxWeight = weight;
      });

      if (minWeight === Infinity) { minWeight = 0; maxWeight = 1; }
      if (minWeight === maxWeight) { maxWeight = minWeight + 1; }

      const getEdgeColor = colorPalettes[colorPaletteKey] || colorPalettes.default;

      const coloredEdges = edgesToLayout.map((edge) => {
        if ((edge.data as any)?.isGhost) {
          // For ghost edges, check if we have duration info from activePathInfo
          if (activePathInfo?.edgeDurations && activePathInfo.edgeDurations[edge.id] !== undefined) {
            const avgDuration = activePathInfo.edgeDurations[edge.id];
            const totalDuration = activePathInfo.edgeTotalDurations?.[edge.id] ?? avgDuration;
            const pathFrequency = activePathInfo.frequency || 1;
            const label = formatDuration(avgDuration);
            return {
              ...edge,
              label,
              data: {
                ...edge.data,
                pathDuration: avgDuration,
                pathFrequency,
                Tooltip_Mean_Time: formatDuration(avgDuration),
                Tooltip_Total_Time: formatDuration(totalDuration),
                Case_Count: pathFrequency,
              },
            };
          }
          return edge;
        }

        const weight = ((edge.data as any)?.Weight_Value as number) || 0;
        const color = getEdgeColor(weight, minWeight, maxWeight);

        // Check if we have path-specific duration override from activePathInfo
        let label = edge.label;
        let edgeData = { ...edge.data, originalStroke: color };
        
        if (activePathInfo?.edgeDurations && activePathInfo.edgeDurations[edge.id] !== undefined) {
          const avgDuration = activePathInfo.edgeDurations[edge.id];
          const totalDuration = activePathInfo.edgeTotalDurations?.[edge.id] ?? avgDuration;
          const pathFrequency = activePathInfo.frequency || 1;
          
          label = formatDuration(avgDuration);
          edgeData = {
            ...edgeData,
            pathDuration: avgDuration,
            pathFrequency,
            // Override tooltip info with path-specific data
            Tooltip_Mean_Time: formatDuration(avgDuration),
            Tooltip_Total_Time: formatDuration(totalDuration),
            Case_Count: pathFrequency,
          } as typeof edgeData;
          
        }

        return {
          ...edge,
          label,
          style: {
            ...edge.style,
            stroke: color,
          },
          data: edgeData,
        };
      });

      set({
        layoutedNodes: newLayoutedNodes,
        layoutedEdges: coloredEdges,
        isLayoutLoading: false,
      });

      // Update edge lookup map
      get().updateEdgeLookupMap();
    } catch (e) {
      console.error("ELK layout failed:", e);
      set({ isLayoutLoading: false });
    }
  },

  updateEdgeLookupMap: () => {
    const { allEdges } = get();
    const map = new Map<string, Edge>();
    allEdges.forEach((edge) => {
      map.set(`${edge.source}->${edge.target}`, edge);
    });
    set({ _edgeLookupMap: map });
  },

  // ============================================================================
  // INTERACTION ACTIONS
  // ============================================================================

  handleEdgeSelect: (edgeId, overrides) => {
    const { layoutedEdges, allEdges, layoutedNodes, allNodes, activePath } = get();

    set({ selectedEdgeId: edgeId });

    const selectedEdge = layoutedEdges.find((e) => e.id === edgeId) || allEdges.find((e) => e.id === edgeId);

    // Update edge styles
    const updatedEdges = layoutedEdges.map((edge) => {
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

    set({ layoutedEdges: updatedEdges });

    const isGhostEdge = (selectedEdge?.data as any)?.isGhost;

    // Calculate overrides if not provided
    let finalOverrides = overrides;
    if (!finalOverrides && activePath && selectedEdge) {
      const calculated = calculateEdgeOverride(selectedEdge, activePath);
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

      const sourceId = selectedEdge?.source || edgeId.split("->")[0];
      const targetId = selectedEdge?.target || edgeId.split("->")[1];

      const sourceNode = layoutedNodes.find((n) => n.id === sourceId) || allNodes.find((n) => n.id === sourceId);
      const targetNode = layoutedNodes.find((n) => n.id === targetId) || allNodes.find((n) => n.id === targetId);

      set({
        edgeTooltipData: dataToShow,
        edgeTooltipTitle: `از یال ${sourceNode?.data?.label || sourceId} به ${targetNode?.data?.label || targetId}`,
        isEdgeCardVisible: true,
        activeTooltipEdgeId: edgeId,
      });
    } else {
      set({ isEdgeCardVisible: false, activeTooltipEdgeId: null });
    }

    // Deselect all nodes
    const deselectedNodes = layoutedNodes.map((node) => ({ ...node, selected: false }));
    set({ layoutedNodes: deselectedNodes });
  },

  handleNodeClick: (event, node, variants, selectedPathNodes, setSelectedPathNodes, selectedPathEdges, setSelectedPathEdges) => {
    const { isPathFinding, pathStartNodeId, pathEndNodeId, layoutedEdges, layoutedNodes, allNodes, activePath, foundPaths } = get();

    set({ activeTooltipEdgeId: null });

    if (!isPathFinding) {
      // Regular node click - show tooltip
      const nodeLabel = (node.data?.label as string) || node.id;

      const outgoingEdges = layoutedEdges.filter((e) => e.source === node.id);
      const incomingEdges = layoutedEdges.filter((e) => e.target === node.id);

      const outgoingEdgeIds = new Set(outgoingEdges.map((e) => e.id));
      const incomingEdgeIds = new Set(incomingEdges.map((e) => e.id));

      const getNodeLabel = (id: string) => {
        const n = layoutedNodes.find((n) => n.id === id) || allNodes.find((n) => n.id === id);
        return (n?.data?.label as string) || id;
      };

      const getEdgeLabel = (edge: Edge) => {
        if (activePath) {
          const override = calculateEdgeOverride(edge, activePath);
          if (override?.displayLabel) return override.displayLabel;
        }
        if (edge.label && edge.label !== "") return edge.label as string;
        return "N/A";
      };

      const outgoingTooltipData = outgoingEdges.map((edge) => ({
        label: getNodeLabel(edge.target),
        weight: getEdgeLabel(edge),
        edgeId: edge.id,
        direction: "outgoing" as const,
      }));

      const incomingTooltipData = incomingEdges.map((edge) => ({
        label: getNodeLabel(edge.source),
        weight: getEdgeLabel(edge),
        edgeId: edge.id,
        direction: "incoming" as const,
      }));

      // Update node selection
      const updatedNodes = layoutedNodes.map((n) => ({ ...n, selected: n.id === node.id }));

      // Highlight edges
      const updatedEdges = layoutedEdges.map((edge) => {
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
      });

      set({
        isNodeCardVisible: true,
        nodeTooltipData: [...outgoingTooltipData, ...incomingTooltipData],
        nodeTooltipTitle: nodeLabel,
        layoutedNodes: updatedNodes,
        layoutedEdges: updatedEdges,
      });

      return;
    }

    // Pathfinding mode
    set({ activeTooltipEdgeId: null });

    if (!pathStartNodeId) {
      set({ pathStartNodeId: node.id, pathEndNodeId: null, foundPaths: [] });
      setSelectedPathNodes(new Set([node.id]));
      setSelectedPathEdges(new Set());
      return;
    }

    if (pathStartNodeId && !pathEndNodeId && node.id !== pathStartNodeId) {
      const endId = node.id;
      set({ pathEndNodeId: endId });

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

      set({ foundPaths: validPaths });
      setSelectedPathNodes(new Set([pathStartNodeId, endId]));
      setSelectedPathEdges(new Set());
      return;
    }

    // Reset and start new path
    set({ pathStartNodeId: node.id, pathEndNodeId: null, foundPaths: [] });
    setSelectedPathNodes(new Set([node.id]));
    setSelectedPathEdges(new Set());
  },

  handleSelectPath: (path, index, setSelectedPathNodes, setSelectedPathEdges, setSelectedPathIndex) => {
    setSelectedPathNodes(new Set(path.nodes));
    setSelectedPathEdges(new Set(path.edges));
    setSelectedPathIndex(index);

    // Update active path
    const { foundPaths } = get();
    if (foundPaths[index]) {
      set({ activePath: foundPaths[index] });
    }
  },

  handleSelectOutlier: (outlierPath, setSelectedPathNodes, setSelectedPathEdges, setSelectedPathIndex) => {
    setSelectedPathEdges(new Set(outlierPath.edges));
    setSelectedPathNodes(new Set(outlierPath.nodes));
    set({ foundPaths: [outlierPath as ExtendedPath], activePath: outlierPath as ExtendedPath });
    setSelectedPathIndex(0);
  },

  closeNodeTooltip: () => {
    const { layoutedNodes, layoutedEdges } = get();

    const deselectedNodes = layoutedNodes.map((n) => ({ ...n, selected: false }));
    const resetEdges = layoutedEdges.map((e) => ({
      ...e,
      selected: false,
      style: {
        ...e.style,
        stroke: (e.data as any)?.originalStroke || "#3b82f6",
        strokeWidth: (e.data as any)?.originalStrokeWidth || 2,
      },
    }));

    set({
      isNodeCardVisible: false,
      nodeTooltipTitle: null,
      layoutedNodes: deselectedNodes,
      layoutedEdges: resetEdges,
    });

    get().closeEdgeTooltip();
  },

  closeEdgeTooltip: () => {
    const { layoutedEdges } = get();

    const resetEdges = layoutedEdges.map((e) => ({
      ...e,
      selected: false,
      style: {
        ...e.style,
        stroke: (e.data as any)?.originalStroke || "#3b82f6",
        strokeWidth: (e.data as any)?.originalStrokeWidth || 2,
      },
    }));

    set({
      isEdgeCardVisible: false,
      selectedEdgeId: null,
      activeTooltipEdgeId: null,
      layoutedEdges: resetEdges,
    });
  },

  onPaneClick: () => {
    set({ activeTooltipEdgeId: null });
    get().closeNodeTooltip();
  },

  // ============================================================================
  // PATHFINDING ACTIONS
  // ============================================================================

  setIsPathFinding: (value) => set({ isPathFinding: value }),
  setPathStartNodeId: (id) => set({ pathStartNodeId: id }),
  setPathEndNodeId: (id) => set({ pathEndNodeId: id }),
  setFoundPaths: (paths) => set({ foundPaths: paths }),
  setActivePath: (path) => set({ activePath: path }),

  removePath: (indexToRemove, selectedPathIndex, setSelectedPathIndex) => {
    const { foundPaths } = get();
    const newPaths = foundPaths.filter((_, index) => index !== indexToRemove);
    set({ foundPaths: newPaths });

    if (selectedPathIndex === indexToRemove) {
      setSelectedPathIndex(null);
      set({ activePath: null });
    } else if (selectedPathIndex !== null && selectedPathIndex > indexToRemove) {
      setSelectedPathIndex(selectedPathIndex - 1);
    }
  },

  resetPathfinding: (setSelectedPathNodes, setSelectedPathEdges, setSelectedPathIndex) => {
    set({
      isPathFinding: false,
      pathStartNodeId: null,
      pathEndNodeId: null,
      foundPaths: [],
      activePath: null,
    });
    setSelectedPathNodes(new Set());
    setSelectedPathEdges(new Set());
    setSelectedPathIndex(null);
  },

  calculatePathDuration: (path) => {
    const extPath = path as ExtendedPath;
    if (typeof extPath._variantDuration === "number") {
      return {
        totalDuration: extPath._variantDuration,
        averageDuration: path.edges.length > 0 ? extPath._variantDuration : 0,
      };
    }
    return { totalDuration: 0, averageDuration: 0 };
  },

  // ============================================================================
  // VISIBILITY ACTIONS
  // ============================================================================

  setIsNodeCardVisible: (visible) => set({ isNodeCardVisible: visible }),
  setIsEdgeCardVisible: (visible) => set({ isEdgeCardVisible: visible }),
}));

// Selector hooks for optimized subscriptions
export const useGraphLayoutState = () => useGraphStore((state) => ({
  allNodes: state.allNodes,
  allEdges: state.allEdges,
  layoutedNodes: state.layoutedNodes,
  layoutedEdges: state.layoutedEdges,
  isLoading: state.isLayoutLoading,
  loadingMessage: state.loadingMessage,
}));

export const useGraphInteractionState = () => useGraphStore((state) => ({
  activeTooltipEdgeId: state.activeTooltipEdgeId,
  isNodeCardVisible: state.isNodeCardVisible,
  isEdgeCardVisible: state.isEdgeCardVisible,
  nodeTooltipTitle: state.nodeTooltipTitle,
  nodeTooltipData: state.nodeTooltipData,
  edgeTooltipTitle: state.edgeTooltipTitle,
  edgeTooltipData: state.edgeTooltipData,
  isPathFinding: state.isPathFinding,
  pathStartNodeId: state.pathStartNodeId,
  pathEndNodeId: state.pathEndNodeId,
  foundPaths: state.foundPaths,
  selectedEdgeId: state.selectedEdgeId,
}));
