/**
 * Graph API — fetches and parses the main process-mining graph data.
 */

import type { FilterTypes, ProcessMiningData } from "../../../types/types";
import { ApiError, buildUrl, get } from "../core";
import { parseGraphResponse } from "../parsers";
import { showToast } from "@/components/Toast";

export const graphApi = {
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

  getDimensions: async (): Promise<{ lev2_names: string[]; lev3_names: string[] }> => {
    const response = await get<{ lev2_names: string[]; lev3_names: string[] }>("/api/graph/filters");
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

  return {
    start_date:      filters.dateRange?.start,
    end_date:        filters.dateRange?.end,
    unit_id:         filters.unitId,
    lev2_names:      filters.lev2Names?.length ? filters.lev2Names : undefined,
    lev3_names:      filters.lev3Names?.length ? filters.lev3Names : undefined,
    weight_metric:   filters.weightFilter,
    time_unit:       filters.timeUnitFilter,
    min_cases:       filters.minCaseCount,
    max_cases:       filters.maxCaseCount,
    min_mean_time:   filters.meanTimeRange?.min,
    max_mean_time:   filters.meanTimeRange?.max,
    target_coverage: targetCoverage,
  };
}
