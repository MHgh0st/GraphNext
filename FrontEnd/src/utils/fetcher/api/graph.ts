/**
 * Graph API — fetches and parses the main process-mining graph data.
 * 
 * Now supports dynamic dimension levels via schema detection.
 */

import type { FilterTypes, ProcessMiningData, DimensionSchema } from "../../../types/types";
import { ApiError, buildUrl, get } from "../core";
import { parseGraphResponse } from "../parsers";
import { showToast } from "@/components/Toast";

type DimensionOptions = Record<string, string[]>;

type DimensionQueryParams = Record<string, string[]>;

export const graphApi = {
  /**
   * Fetch database schema - returns available dimension levels dynamically
   */
  getSchema: async (): Promise<DimensionSchema> => {
    try {
      const response = await get<DimensionSchema>("/api/graph/schema");
      console.log("✅ [SCHEMA] Retrieved schema:", response.data);
      return response.data;
    } catch (error) {
      console.error("❌ [SCHEMA] Error fetching schema:", error);
      // Fallback to 8 levels if schema endpoint fails
      return {
        totalLevels: 8,
        levels: Array.from({ length: 8 }, (_, i) => ({
          index: i,
          key: `lev${i + 1}_names`,
          columnName: `LEV${i + 1}_NAME`,
          label: `سطح ${i + 1}`,
        })),
      };
    }
  },

  /**
   * Fetch graph data with filters.
   *
   * The backend returns a zstd-compressed MsgPack container holding Arrow IPC tables.
   * This function handles the full pipeline:
   *   build params → POST → decompress → decode → parse Arrow → return domain objects
   */
  getData: async (filters: Partial<FilterTypes>): Promise<ProcessMiningData> => {
    try {
      const params = buildQueryParams(filters);
      const requestUrl = buildUrl("/api/graph/data", params);

      const response = await fetch(requestUrl, { method: "POST" });
      if (!response.ok) {
        throw new ApiError(`API Error: ${response.status}`, response.status, response.statusText);
      }

      const compressedBytes = new Uint8Array(await response.arrayBuffer());
      const result = await parseGraphResponse(compressedBytes);

      showToast({
        type: "success",
        title: "داده‌های گراف بارگذاری شد",
        message: `${result.graphData.length} یال و ${result.variants.length} مسیر دریافت شد.`,
      });

      return result;
    } catch (error) {
      showToast({
        type: "error",
        title: "خطا در بارگذاری گراف",
        message:
          error instanceof ApiError
            ? `خطای سرور: ${error.status} — ${error.statusText}`
            : "دریافت داده‌های گراف با خطا مواجه شد. لطفاً دوباره تلاش کنید.",
      });
      throw error;
    }
  },

  /**
   * Fetch available dimensions based on current filters (supports dynamic levels)
   */
  getDimensions: async (filters?: DimensionQueryParams): Promise<DimensionOptions> => {
    const response = await get<DimensionOptions>("/api/graph/filters", filters || {});
    return response.data;
  },
};

// ============================================================================
// HELPERS
// ============================================================================

/** Convert `FilterTypes` into the query-param shape expected by the backend. */
function buildQueryParams(
  filters: Partial<FilterTypes>
): Record<string, string | number | boolean | null | undefined | Array<string>> {
  const outlierPct = filters.outlierPrecentage ?? 5;
  const targetCoverage = 1 - outlierPct / 100;

  const params: Record<string, string | number | boolean | null | undefined | Array<string>> = {
    start_date:      filters.dateRange?.start,
    end_date:        filters.dateRange?.end,
    unit_id:         filters.unitId,
    weight_metric:   filters.weightFilter,
    time_unit:       filters.timeUnitFilter,
    min_cases:       filters.minCaseCount,
    max_cases:       filters.maxCaseCount,
    min_mean_time:   filters.meanTimeRange?.min,
    max_mean_time:   filters.meanTimeRange?.max,
    target_coverage: targetCoverage,
  };

  // Add dimension filters dynamically
  if (filters.dimensionFilters) {
    Object.entries(filters.dimensionFilters).forEach(([key, values]) => {
      if (values && values.length > 0) {
        params[key] = values;
      }
    });
  }

  return params;
}
