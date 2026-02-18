/**
 * Health check API.
 */

import { fetcher } from "../core";
import { showToast } from "@/components/Toast";

export const healthApi = async (): Promise<{ status: string }> => {
  try {
    const { data } = await fetcher<{ status: string }>("/health");
    showToast({
      type: "success",
      title: "سرور در دسترس است",
      message: `وضعیت سرور: ${data.status}`,
    });
    return data;
  } catch (error) {
    showToast({
      type: "error",
      title: "خطا در اتصال به سرور",
      message: "بررسی وضعیت سرور با خطا مواجه شد. لطفاً دوباره تلاش کنید.",
    });
    throw error;
  }
};
