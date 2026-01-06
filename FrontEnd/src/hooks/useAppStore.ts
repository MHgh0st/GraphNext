/**
 * Application State Store (Zustand)
 * 
 * Centralized state management for the Process Mining Graph application.
 * Replaces prop drilling and scattered useState calls with a single source of truth.
 * 
 * State Categories:
 * - File/Data: Path to data file, processed graph data, variants
 * - UI: App step, sidebar state, loading states
 * - Graph: Selected nodes, path selection, color palette
 * - Filters: Current filter configuration
 * 
 * @module hooks/useAppStore
 */

import { create } from "zustand";
import { Node } from "@xyflow/react";
import type {
  FilterTypes,
  GraphData,
  Variant,
  SidebarTab,
} from "../types/types";

/**
 * Start/End nodes for the graph layout
 */
interface StartEndNodes {
  start: string[];
  end: string[];
}

/**
 * Application State Interface
 * 
 * Defines all state properties and actions for the app store.
 */
interface AppState {
  // ============ FILE & DATA STATE ============
  /** Path to the currently loaded data file */
  dataFilePath: string | null;
  /** Processed graph data from Python backend */
  graphData: GraphData[] | null;
  /** Process variants (paths through the graph) */
  variants: Variant[] | null;
  /** Outlier variants */
  outliers: Variant[] | null;
  /** Start and end activity nodes */
  startEndNodes: StartEndNodes | null;
  /** Current filter configuration */
  filters: FilterTypes | null;

  // ============ UI STATE ============
  /** Current step in the app flow (1: file upload, 2: dashboard) */
  step: number;
  /** Whether data is being processed */
  isLoading: boolean;
  /** Active sidebar tab */
  sidebarActiveTab: SidebarTab;
  /** Whether the sidebar card panel is visible */
  isSideCardVisible: boolean;
  /** Whether the sidebar is collapsed */
  isSidebarCollapsed: boolean;
  /** Whether filters have been applied (for node selection logic) */
  filtersApplied: boolean;

  // ============ GRAPH SELECTION STATE ============
  /** Currently selected node IDs for filtering */
  selectedNodeIds: Set<string>;
  /** Selected path node IDs (for pathfinding visualization) */
  selectedPathNodes: Set<string>;
  /** Selected path edge IDs (for pathfinding visualization) */
  selectedPathEdges: Set<string>;
  /** Index of the currently selected path */
  selectedPathIndex: number | null;
  /** Selected color palette key */
  selectedColorPalette: string;

  // ============ ACTIONS ============
  /** Sets the data file path and advances to step 2 */
  setDataFilePath: (path: string) => void;
  /** Sets the processed data from Python backend */
  setProcessedData: (data: {
    graphData: GraphData[];
    variants: Variant[];
    outliers: Variant[];
    startActivities: string[];
    endActivities: string[];
  }) => void;
  /** Updates the current filter configuration */
  setFilters: (filters: FilterTypes) => void;
  /** Sets the loading state */
  setIsLoading: (loading: boolean) => void;
  /** Sets the active sidebar tab */
  setSidebarActiveTab: (tab: SidebarTab) => void;
  /** Toggles sidebar card visibility */
  toggleSideCard: () => void;
  /** Toggles sidebar collapsed state */
  toggleSidebarCollapsed: () => void;
  /** Sets selected node IDs */
  setSelectedNodeIds: (nodes: Set<string>) => void;
  /** Sets selected path nodes */
  setSelectedPathNodes: (nodes: Set<string>) => void;
  /** Sets selected path edges */
  setSelectedPathEdges: (edges: Set<string>) => void;
  /** Sets selected path index */
  setSelectedPathIndex: (index: number | null) => void;
  /** Sets color palette */
  setSelectedColorPalette: (palette: string) => void;
  /** Sets filters applied flag */
  setFiltersApplied: (applied: boolean) => void;
  /** Resets path selection state */
  resetPathSelection: () => void;
  /** Handles sidebar tab click with visibility logic */
  handleSidebarTabClick: (tab: SidebarTab) => void;
}

/**
 * useAppStore
 * 
 * Zustand store hook for accessing and modifying application state.
 * 
 * @example
 * ```tsx
 * // Access state
 * const { dataFilePath, graphData, isLoading } = useAppStore();
 * 
 * // Access actions
 * const { setDataFilePath, setProcessedData } = useAppStore();
 * 
 * // Or with selector for performance
 * const graphData = useAppStore(state => state.graphData);
 * ```
 */
export const useAppStore = create<AppState>((set, get) => ({
  // Initial state values
  dataFilePath: null,
  graphData: null,
  variants: null,
  outliers: null,
  startEndNodes: null,
  filters: null,
  step: 1,
  isLoading: false,
  sidebarActiveTab: "Filter",
  isSideCardVisible: true,
  isSidebarCollapsed: false,
  filtersApplied: false,
  selectedNodeIds: new Set(),
  selectedPathNodes: new Set(),
  selectedPathEdges: new Set(),
  selectedPathIndex: null,
  selectedColorPalette: "default",

  // Actions
  setDataFilePath: (path) =>
    set({
      dataFilePath: path,
      step: 2,
    }),

  setProcessedData: (data) =>
    set({
      graphData: data.graphData,
      variants: data.variants,
      outliers: data.outliers,
      startEndNodes: {
        start: data.startActivities,
        end: data.endActivities,
      },
      filtersApplied: true,
      isLoading: false,
      // Reset node selection when new data is loaded
      selectedNodeIds: new Set(),
      selectedPathNodes: new Set(),
      selectedPathEdges: new Set(),
      selectedPathIndex: null,
    }),

  setFilters: (filters) => set({ filters }),

  setIsLoading: (loading) => set({ isLoading: loading }),

  setSidebarActiveTab: (tab) => set({ sidebarActiveTab: tab }),

  toggleSideCard: () =>
    set((state) => ({ isSideCardVisible: !state.isSideCardVisible })),

  toggleSidebarCollapsed: () =>
    set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

  setSelectedNodeIds: (nodes) => {
    const current = get();
    // Reset filtersApplied when nodes change after initial filter
    if (nodes.size > 0 && current.filtersApplied) {
      set({ selectedNodeIds: nodes, filtersApplied: false });
    } else {
      set({ selectedNodeIds: nodes });
    }
  },

  setSelectedPathNodes: (nodes) => set({ selectedPathNodes: nodes }),

  setSelectedPathEdges: (edges) => set({ selectedPathEdges: edges }),

  setSelectedPathIndex: (index) => set({ selectedPathIndex: index }),

  setSelectedColorPalette: (palette) => set({ selectedColorPalette: palette }),

  setFiltersApplied: (applied) => set({ filtersApplied: applied }),

  resetPathSelection: () =>
    set({
      selectedPathNodes: new Set(),
      selectedPathEdges: new Set(),
      selectedPathIndex: null,
    }),

  handleSidebarTabClick: (tab) => {
    const current = get();
    if (tab === current.sidebarActiveTab && current.isSideCardVisible) {
      set({ isSideCardVisible: false });
    } else {
      set({ sidebarActiveTab: tab, isSideCardVisible: true });
    }
  },
}));

/**
 * Selector hooks for common state slices (performance optimization)
 */
export const useDataFilePath = () => useAppStore((s) => s.dataFilePath);
export const useGraphData = () => useAppStore((s) => s.graphData);
export const useIsLoading = () => useAppStore((s) => s.isLoading);
export const useSidebarState = () =>
  useAppStore((s) => ({
    activeTab: s.sidebarActiveTab,
    isVisible: s.isSideCardVisible,
    isCollapsed: s.isSidebarCollapsed,
  }));
export const useFilters = () => useAppStore((s) => s.filters);
