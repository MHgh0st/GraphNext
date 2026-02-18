/**
 * Search API — look up cases by ID.
 */

import type { SearchCaseIdsData } from "../../../types/types";
import { ApiError, fetcher } from "../core";
import { showToast } from "@/components/Toast";

/** Raw shape returned by the backend search endpoint. */
interface SearchApiResponse {
  nodes: string[];
  edge_durations: number[];
  total_duration: number;
  case_id: number;
  position_stats: {
    duration_percentile: number;
    is_slower_than_average: boolean;
  };
}

export const searchApi = {
  /**
   * Search for a case by ID.
   * Returns `{ found: false }` when the backend responds with 404.
   */
  byId: async (
    caseId: number,
    options?: {
      startDate?: string;
      endDate?: string;
      includeGlobalStats?: boolean;
    }
  ): Promise<SearchCaseIdsData> => {
    try {
      const { data } = await fetcher<SearchApiResponse>("/api/search", {
        params: {
          case_id:              caseId,
          start_date:           options?.startDate,
          end_date:             options?.endDate,
          include_global_stats: options?.includeGlobalStats ?? true,
        },
      });

      showToast({
        type: "success",
        title: "کیس پیدا شد",
        message: `کیس شماره ${caseId} با ${data.nodes.length} فعالیت یافت شد.`,
      });

      return { found: true, data };
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        showToast({
          type: "error",
          title: "کیس یافت نشد",
          message: `کیس با شناسه ${caseId} در سیستم وجود ندارد.`,
        });
        return { found: false };
      }

      showToast({
        type: "error",
        title: "خطا در جستجو",
        message: `جستجوی کیس ${caseId} با خطا مواجه شد. لطفاً دوباره تلاش کنید.`,
      });
      throw error;
    }
  },
};
