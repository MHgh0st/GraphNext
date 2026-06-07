// فایل FrontEnd/src/hooks/useAppStore.ts را باز کن و با این کد کامل بازنویسی کن:

/**
 * Application State Store (Zustand)
 * Centralized state management for the Process Mining Graph application.
 */

import { create } from "zustand";
import type {
  FilterTypes,
  GraphData,
  Variant,
  SidebarTab,
} from "../types/types";

interface StartEndNodes {
  start: string[];
  end: string[];
}

interface AppState {
  // ============ FILE & DATA STATE ============
  dataFilePath: string | null;
  graphData: GraphData[] | null;
  filteredGraphData: GraphData[] | null; // 🟢 ستون دیتای فیلتر شده کلاینت‌ساید
  variants: Variant[] | null;
  outliers: Variant[] | null;
  startEndNodes: StartEndNodes | null;
  filters: FilterTypes | null;

  // ============ UI STATE ============
  step: number;
  isLoading: boolean;
  sidebarActiveTab: SidebarTab;
  isSideCardVisible: boolean;
  isSidebarCollapsed: boolean;
  filtersApplied: boolean;

  // ============ GRAPH SELECTION STATE ============
  selectedNodeIds: Set<string>;
  selectedPathNodes: Set<string>;
  selectedPathEdges: Set<string>;
  selectedPathIndex: number | null;
  selectedColorPalette: string;

  // ============ ACTIONS ============
  setDataFilePath: (path: string) => void;
  setProcessedData: (data: {
    graphData: GraphData[];
    variants: Variant[];
    outliers: Variant[];
    startActivities: string[];
    endActivities: string[];
  }) => void;
  setFilteredGraphData: (data: GraphData[] | null) => void; // 🟢 اکشن به‌روزرسانی گراف فیلترشده
  setFilters: (filters: FilterTypes) => void;
  setIsLoading: (loading: boolean) => void;
  setSidebarActiveTab: (tab: SidebarTab) => void;
  toggleSideCard: () => void;
  toggleSidebarCollapsed: () => void;
  setSelectedNodeIds: (nodes: Set<string>) => void;
  setSelectedPathNodes: (nodes: Set<string>) => void;
  setSelectedPathEdges: (edges: Set<string>) => void;
  setSelectedPathIndex: (index: number | null) => void;
  setSelectedColorPalette: (palette: string) => void;
  setFiltersApplied: (applied: boolean) => void;
  resetPathSelection: () => void;
  handleSidebarTabClick: (tab: SidebarTab) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  dataFilePath: null,
  graphData: null,
  filteredGraphData: null, // 🟢 مقدار اولیه
  variants: null,
  outliers: null,
  startEndNodes: null,
  filters: {
  dateRange: { start: "", end: "" },
  dimensionFilters: {},
  courtKinds: [],
  minCaseCount: null,
  maxCaseCount: null,
  meanTimeRange: { min: null, max: null },
  weightFilter: "mean_time", 
  timeUnitFilter: "d",
  outlierPrecentage: 5,
  unitId: null
},
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

  setDataFilePath: (path) =>
    set({
      dataFilePath: path,
      step: 2,
    }),

  setProcessedData: (data) =>
    set({
      graphData: data.graphData,
      filteredGraphData: data.graphData, // 🟢 در ابتدا فیلتر کلاینت وجود ندارد و برابر دیتای اصلی است
      variants: data.variants,
      outliers: data.outliers,
      startEndNodes: {
        start: data.startActivities,
        end: data.endActivities,
      },
      filtersApplied: true,
      isLoading: false,
      selectedNodeIds: new Set(),
      selectedPathNodes: new Set(),
      selectedPathEdges: new Set(),
      selectedPathIndex: null,
    }),

  setFilteredGraphData: (data) => set({ filteredGraphData: data }), // 🟢 تنظیم دیتای فیلتر شده

  setFilters: (filters) => set({ filters }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setSidebarActiveTab: (tab) => set({ sidebarActiveTab: tab }),
  toggleSideCard: () => set((state) => ({ isSideCardVisible: !state.isSideCardVisible })),
  toggleSidebarCollapsed: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

  setSelectedNodeIds: (nodes) => {
    const current = get();
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

export const useDataFilePath = () => useAppStore((s) => s.dataFilePath);
export const useGraphData = () => useAppStore((s) => s.filteredGraphData ?? s.graphData); // 🟢 لایه مصرف‌کننده گراف را هوشمند کردیم تا تداخل ایجاد نشود
export const useIsLoading = () => useAppStore((s) => s.isLoading);
export const useSidebarState = () =>
  useAppStore((s) => ({
    activeTab: s.sidebarActiveTab,
    isVisible: s.isSideCardVisible,
    isCollapsed: s.isSidebarCollapsed,
  }));
export const useFilters = () => useAppStore((s) => s.filters);