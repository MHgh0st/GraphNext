
/**
 * Stats API — edge and global process statistics.
 */

import type { HistogramData } from "../../../types/types";
import { fetcher } from "../core";
import { showToast } from "@/components/Toast";

export const statsApi = {
  /**
   * Get duration histogram data for a specific edge (source → target transition).
   */
  getEdgeStats: async (
    source: string,
    target: string,
    options?: { startDate?: string; endDate?: string }
  ): Promise<HistogramData> => {
    try {
      const { data } = await fetcher<HistogramData>("/api/stats/edge", {
        params: {
          source,
          target,
          start_date: options?.startDate,
          end_date:   options?.endDate,
        },
      });

      // showToast({
      //   type: "success",
      //   title: "آمار یال دریافت شد",
      //   message: `آمار مسیر «${source} ← ${target}» با موفقیت بارگذاری شد.`,
      // });

      return data;
    } catch (error) {
      showToast({
        type: "error",
        title: "خطا در دریافت آمار یال",
        message: `دریافت آمار مسیر «${source} ← ${target}» با خطا مواجه شد.`,
      });
      throw error;
    }
  },

  /**
   * Get global process statistics (total time and step-count distributions).
   */
  getGlobalStats: async (
    options?: { startDate?: string; endDate?: string }
  ): Promise<{ total_time: HistogramData; steps: HistogramData }> => {
    try {
      const { data } = await fetcher<{ total_time: HistogramData; steps: HistogramData }>(
        "/api/stats/global",
        {
          params: {
            start_date: options?.startDate,
            end_date:   options?.endDate,
          },
        }
      );

      // showToast({
      //   type: "success",
      //   title: "آمار کلی دریافت شد",
      //   message: "آمار فرآیند با موفقیت بارگذاری شد.",
      // });

      return data;
    } catch (error) {
      showToast({
        type: "error",
        title: "خطا در دریافت آمار کلی",
        message: "دریافت آمار کلی فرآیند با خطا مواجه شد. لطفاً دوباره تلاش کنید.",
      });
      throw error;
    }
  },
};
