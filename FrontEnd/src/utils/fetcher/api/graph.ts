
// فایل FrontEnd/src/utils/fetcher/api/graph.ts را با این محتوا کاملاً به‌روزرسانی کن:

import type { FilterTypes, ProcessMiningData, DimensionSchema } from "../../../types/types";
import { ApiError, buildUrl, get } from "../core";
import { parseGraphResponse } from "../parsers";
import { showToast } from "@/components/Toast";

type DimensionOptions = Record<string, string[]>;
type DimensionQueryParams = Record<string, string[]>;

export const graphApi = {
  /** Fetch database schema - returns available dimension levels dynamically */
  getSchema: async (): Promise<DimensionSchema> => {
    try {
      const response = await get<DimensionSchema>("/api/graph/schema");
      return response.data;
    } catch (error) {
      console.error("❌ [SCHEMA] Error fetching schema:", error);
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

  /** Fetch graph data with filters */
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
        message: error instanceof ApiError ? `خطای سرور: ${error.status}` : "خطا در دریافت داده‌های گراف.",
      });
      throw error;
    }
  },

  /** Fetch available dimensions based on current filters */
  getDimensions: async (filters?: DimensionQueryParams): Promise<DimensionOptions> => {
    const response = await get<DimensionOptions>("/api/graph/filters", filters || {});
    return response.data;
  },

  /** 🟢 دریافت لیست تمام صلاحیت‌های شعبه موجود در دیتابیس */
  getCourtKinds: async (): Promise<string[]> => {
    try {
      const response = await get<string[]>("/api/graph/court-kinds");
      return response.data;
    } catch (error) {
      console.error("❌ Error fetching court kinds:", error);
      return [];
    }
  },
};

function buildQueryParams(filters: Partial<FilterTypes>): Record<string, any> {
  const outlierPct = filters.outlierPrecentage ?? 5;
  const targetCoverage = 1 - outlierPct / 100;

  const params: Record<string, any> = {
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

  if (filters.dimensionFilters) {
    Object.entries(filters.dimensionFilters).forEach(([key, values]) => {
      if (values && values.length > 0) params[key] = values;
    });
  }

  // 🟢 افزودن داینامیک صلاحیت‌های انتخاب شده به کوئری بادی پارامترها
  if (filters.courtKinds && filters.courtKinds.length > 0) {
    params["court_kinds"] = filters.courtKinds;
  }

  return params;
}