
/**
 * Binary data parsers for the graph API response.
 *
 * Handles the full pipeline:
 *   raw bytes → zstd decompress → msgpack decode → Arrow IPC → domain objects
 */

import * as msgpack from "@msgpack/msgpack";
import type { GraphData, Variant } from "../../types/types";

// ============================================================================
// TYPES
// ============================================================================


export interface ActivityCountItem {
  node: string;
  count: number;
}

/** Shape of the msgpack container returned by the backend. */
export interface GraphContainer {
  graphData: Uint8Array;      // Arrow IPC bytes
  allVariants: Uint8Array;    // Arrow IPC bytes
  startActivities: ActivityCountItem[];
  endActivities: ActivityCountItem[];
  targetCoverage: number;
}

/** Parsed result returned to callers. */
export interface ParsedGraphResponse {
  graphData: GraphData[];
  variants: Variant[];
  outliers: Variant[];
  startActivities: ActivityCountItem[];
  endActivities: ActivityCountItem[];
}

// ============================================================================
// STEP 1: Decompress + decode msgpack
// ============================================================================

/**
 * Decompresses a zstd-compressed buffer and decodes the msgpack container.
 */
export async function decompressAndDecode(compressedBytes: Uint8Array): Promise<GraphContainer> {
  const fzstd = await import("fzstd");
  const decompressed = fzstd.decompress(compressedBytes);
  return msgpack.decode(decompressed) as GraphContainer;
}

// ============================================================================
// STEP 2: Parse Arrow IPC tables
// ============================================================================

/**
 * Converts an Arrow IPC `graphData` table into an array of `GraphData` objects.
 */
export function parseGraphTable(table: import("apache-arrow").Table): GraphData[] {
  const rows: GraphData[] = [];
  for (let i = 0; i < table.numRows; i++) {
    rows.push({
      Source_Activity:       table.getChild("Source_Activity")?.get(i) as string,
      Target_Activity:       table.getChild("Target_Activity")?.get(i) as string,
      Mean_Duration_Seconds: table.getChild("Mean_Duration_Seconds")?.get(i) as number,
      Tooltip_Total_Time:    table.getChild("Tooltip_Total_Time")?.get(i) as string,
      Tooltip_Mean_Time:     table.getChild("Tooltip_Mean_Time")?.get(i) as string,
      Weight_Value:          table.getChild("Weight_Value")?.get(i) as number,
      Edge_Label:            table.getChild("Edge_Label")?.get(i) as string,
      Case_Count:            table.getChild("Case_Count")?.get(i) as number,

      Min_Duration_Seconds:    table.getChild("Min_Duration_Seconds")?.get(i) as number,
      Max_Duration_Seconds:    table.getChild("Max_Duration_Seconds")?.get(i) as number,
      Std_Duration_Seconds:    table.getChild("Std_Duration_Seconds")?.get(i) as number,
      Median_Duration_Seconds: table.getChild("Median_Duration_Seconds")?.get(i) as number,
      Branching_Probability:   table.getChild("Branching_Probability")?.get(i) as number,
    });
  }
  return rows;
}

/**
 * Converts an Arrow IPC `allVariants` table into `variants` and `outliers` arrays,
 * split by whether each row's cumulative coverage is within `targetCoverage`.
 */
export function parseVariantsTable(
  table: import("apache-arrow").Table,
  targetCoverage: number
): { variants: Variant[]; outliers: Variant[] } {
  const variants: Variant[] = [];
  const outliers: Variant[] = [];

  for (let i = 0; i < table.numRows; i++) {
    const Variant_Path: string[] = toArray(table.getChild("Variant_Path")?.get(i));
    const Avg_Timings: number[]  = toArray(table.getChild("Avg_Timings")?.get(i));
    const Total_Timings: number[] = toArray(table.getChild("Total_Timings")?.get(i));
    const Min_Timings: number[] = toArray(table.getChild("Min_Timings")?.get(i));
    const Max_Timings: number[] = toArray(table.getChild("Max_Timings")?.get(i));
    const Median_Timings: number[] = toArray(table.getChild("Median_Timings")?.get(i));
    const Std_Timings: number[] = toArray(table.getChild("Std_Timings")?.get(i));

    const variant: Variant = {
      Variant_Path,
      Frequency:  table.getChild("Frequency")?.get(i) as number,
      Percentage: table.getChild("Percentage")?.get(i) as number,
      Avg_Timings,
      Total_Timings,
      Min_Timings,
      Max_Timings,
      Median_Timings,
      Std_Timings,
      UnitID:     table.getChild("UnitID")?.get(i) as number | undefined,
    };

    const cumCoverage = table.getChild("cum_coverage")?.get(i) as number;
    if (cumCoverage <= targetCoverage) {
      variants.push(variant);
    } else {
      outliers.push(variant);
    }
  }

  return { variants, outliers };
}

// ============================================================================
// STEP 3: Full pipeline
// ============================================================================

/**
 * Full pipeline: raw compressed bytes → `ParsedGraphResponse`.
 */
export async function parseGraphResponse(compressedBytes: Uint8Array): Promise<ParsedGraphResponse> {
  const container = await decompressAndDecode(compressedBytes);

  const { tableFromIPC } = await import("apache-arrow");
  const graphTable    = tableFromIPC(container.graphData);
  const variantsTable = tableFromIPC(container.allVariants);

  const graphData = parseGraphTable(graphTable);
  const { variants, outliers } = parseVariantsTable(variantsTable, container.targetCoverage);

  return {
    graphData,
    variants,
    outliers,
    startActivities: container.startActivities,
    endActivities:   container.endActivities,
  };
}

// ============================================================================
// INTERNAL UTILITIES
// ============================================================================

/** Safely converts an Arrow list value to a plain JS array. */
function toArray<T>(value: unknown): T[] {
  return value ? Array.from(value as Iterable<T>) : [];
}
