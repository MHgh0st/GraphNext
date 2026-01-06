/**
 * Application Type Definitions
 * 
 * Centralized type definitions for the Process Mining Graph application.
 * All interfaces used across the application are defined here for consistency.
 * 
 * @module types/types
 */

// ============================================================================
// FILTER TYPES
// ============================================================================

/**
 * FilterTypes
 * 
 * Configuration object for data filtering operations.
 * Sent from renderer to main process via IPC for Python processing.
 * 
 * @example
 * ```ts
 * const filters: FilterTypes = {
 *   dateRange: { start: "2024-01-01", end: "2024-12-31" },
 *   minCaseCount: 10,
 *   maxCaseCount: 1000,
 *   meanTimeRange: { min: 0, max: 3600 },
 *   weightFilter: "cases",
 *   timeUnitFilter: "h",
 * };
 * ```
 */
export interface FilterTypes {
  /** Date range for filtering events (ISO date strings) */
  dateRange: { start: string; end: string };
  /** Minimum number of cases for an edge to be included */
  minCaseCount: number | null;
  /** Maximum number of cases for an edge to be included */
  maxCaseCount: number | null;
  /** Mean duration range filter in seconds */
  meanTimeRange: { min: number | null; max: number | null };
  /** Metric to use for edge weights: case count or mean time */
  weightFilter: "cases" | "mean_time";
  /** Time unit for display: seconds, minutes, hours, days, weeks */
  timeUnitFilter: "s" | "m" | "h" | "d" | "w";
  /** Outlier percentage for filtering */
  outlierPrecentage: number | null;
}

// ============================================================================
// PATH TYPES
// ============================================================================

/**
 * Path
 * 
 * Represents a path through the process graph.
 * Used for pathfinding and variant visualization.
 */
export interface Path {
  /** Ordered list of node IDs in the path */
  nodes: string[];
  /** Ordered list of edge IDs connecting the nodes */
  edges: string[];
  /** How often this path occurs (from variants) */
  frequency?: number;
  /** Total duration of traversing this path (seconds) */
  totalDuration?: number;
  /** Average duration of traversing this path (seconds) */
  averageDuration?: number;
}

/**
 * ExtendedPath
 * 
 * Extended path information with additional metadata.
 * Used for variant analysis and outlier detection.
 * 
 * Note: Properties prefixed with underscore are computed/derived values.
 */
export interface ExtendedPath extends Path {
  /** Total duration from variant data */
  _variantDuration?: number;
  /** How often this path occurs */
  _frequency?: number;
  /** Full path including start/end nodes */
  _fullPathNodes?: string[];
  /** Starting index in the full path */
  _startIndex?: number;
  /** Ending index in the full path */
  _endIndex?: number;
  /** Whether path is absolute or relative to selection */
  _pathType?: "absolute" | "relative";
  /** Timing data for each step in the variant */
  _variantTimings?: number[];
  /** Average duration for each edge keyed by edge ID */
  _specificEdgeDurations?: Record<string, number>;
  /** Total duration for each edge keyed by edge ID (from Total_Timings) */
  _specificTotalDurations?: Record<string, number>;
}

// ============================================================================
// UI TYPES
// ============================================================================

/**
 * PaletteOption
 * 
 * Color palette configuration for graph edge visualization.
 */
export interface PaletteOption {
  /** Unique key for the palette */
  key: string;
  /** Display label (Persian) */
  label: string;
  /** CSS gradient string for preview */
  gradient: string;
}

/**
 * SidebarTab
 * 
 * Available tabs in the sidebar navigation.
 */
export type SidebarTab =
  | "Filter"      // Data filtering
  | "Routing"     // Pathfinding
  | "Settings"    // Graph settings
  | "Outliers"    // Outlier analysis
  | "SearchCaseIds"; // Case ID search

// ============================================================================
// GRAPH DATA TYPES
// ============================================================================

/**
 * GraphData
 * 
 * Single edge data from the Python processor.
 * Represents a transition between two activities.
 */
export interface GraphData {
  /** Source activity name */
  Source_Activity: string;
  /** Target activity name */
  Target_Activity: string;
  /** Average duration in seconds */
  Mean_Duration_Seconds: number;
  /** Formatted total time for tooltip display */
  Tooltip_Total_Time: string;
  /** Formatted mean time for tooltip display */
  Tooltip_Mean_Time: string;
  /** Weight value (case count or mean time based on filter) */
  Weight_Value: number;
  /** Label text for the edge */
  Edge_Label: string;
  /** Number of cases traversing this edge */
  Case_Count: number;
}

/**
 * Variant
 * 
 * A unique path variant through the process.
 * Represents a complete trace from start to end.
 */
export interface Variant {
  /** Ordered list of activity names in this variant */
  Variant_Path: string[];
  /** Number of cases following this variant */
  Frequency: number;
  /** Average timing for each transition (seconds) */
  Avg_Timings: number[];
  /** Total timing for each transition (seconds) */
  Total_Timings: number[];
  /** Percentage of total cases this variant represents */
  Percentage: number;
}

/**
 * ProcessMiningData
 * 
 * Complete response from the Python data processor.
 * Contains all data needed for graph visualization.
 */
export interface ProcessMiningData {
  /** Edge data for graph construction */
  graphData: GraphData[];
  /** All process variants */
  variants: Variant[];
  /** Statistically identified outlier variants */
  outliers: Variant[];
  /** Activities that can be start nodes */
  startActivities: string[];
  /** Activities that can be end nodes */
  endActivities: string[];
}

// ============================================================================
// SEARCH & STATISTICS TYPES
// ============================================================================

/**
 * SearchCaseIdsData
 * 
 * Response from case ID search operation.
 * Contains the path taken by a specific case.
 */
export interface SearchCaseIdsData {
  /** Whether the case was found */
  found: boolean;
  /** Case data if found */
  data?: {
    /** Ordered list of activities */
    nodes: string[];
    /** Duration between each activity (seconds) */
    edge_durations: number[];
    /** Total case duration (seconds) */
    total_duration: number;
    /** The case identifier */
    case_id: number;
    /** Statistical position of this case */
    position_stats: {
      /** Percentile rank (0-100) */
      duration_percentile: number;
      /** Whether this case is slower than average */
      is_slower_than_average: boolean;
    };
  };
}

/**
 * HistogramData
 * 
 * Histogram data for statistical visualization.
 * Used for edge duration distribution charts.
 */
export interface HistogramData {
  /** Bin boundaries */
  bins: number[];
  /** Count of items in each bin */
  counts: number[];
}

/**
 * EdgeStatisticsGlobalData
 * 
 * Global statistics for all edges in the graph.
 * Contains histograms for time and step distributions.
 */
export interface EdgeStatisticsGlobalData {
  /** Total time histogram across all edges */
  total_time: HistogramData;
  /** Number of steps histogram */
  steps: HistogramData;
}

/**
 * NodeTooltipType
 * 
 * Data for node tooltip display.
 * Shows connected edges and their weights.
 */
export interface NodeTooltipType {
  /** ID of the connected edge */
  edgeId: string;
  /** Display label for the connection */
  label: string;
  /** Weight value (formatted for display) */
  weight: string | number;
  /** Whether this edge is incoming or outgoing */
  direction: "incoming" | "outgoing";
}