/**
 * Type-Safe API Fetcher Utility
 * 
 * A comprehensive fetcher utility for making type-safe API requests to the backend.
 * Supports all HTTP methods, error handling, request/response transformations,
 * and special handling for binary data (Arrow/MsgPack).
 * 
 * @module utils/fetcher
 */

import * as msgpack from "@msgpack/msgpack";
import type {
  FilterTypes,
  ProcessMiningData,
  SearchCaseIdsData,
  GraphData,
  Variant,
  HistogramData,
} from "../types/types";

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * API base URL - handles both Docker (server-side) and browser (client-side) environments
 * - Server-side (SSR in Docker): uses Docker internal network hostname
 * - Client-side (Browser): uses localhost with exposed port
 */
const API_BASE_URL = typeof window === "undefined"
  ? (process.env.INTERNAL_API_URL || "http://backend:8000")  // Server-side: Docker internal
  : (process.env.NEXT_PUBLIC_API_URL || "http://localhost:9000"); // Client-side: Browser

/**
 * Default request timeout in milliseconds
 */
const DEFAULT_TIMEOUT = 60000; // 60 seconds

// ============================================================================
// TYPES
// ============================================================================

/**
 * HTTP methods supported by the fetcher
 */
type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Response type for different content types
 */
type ResponseType = "json" | "msgpack" | "blob" | "text" | "arraybuffer";

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public statusText: string,
    public data?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Options for fetch requests
 */
interface FetchOptions<TBody = unknown> {
  /** HTTP method */
  method?: HttpMethod;
  /** Request body (will be JSON stringified) */
  body?: TBody;
  /** Query parameters */
  params?: Record<string, string | number | boolean | null | undefined>;
  /** Custom headers */
  headers?: Record<string, string>;
  /** Request timeout in ms */
  timeout?: number;
  /** Expected response type */
  responseType?: ResponseType;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

/**
 * Wrapper for successful API response
 */
interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Headers;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build URL with query parameters
 */
function buildUrl(
  endpoint: string,
  params?: Record<string, string | number | boolean | null | undefined>
): string {
  const url = new URL(endpoint, API_BASE_URL);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });
  }
  
  return url.toString();
}

/**
 * Create an AbortController with timeout
 */
function createTimeoutController(timeout: number, signal?: AbortSignal): AbortController {
  const controller = new AbortController();
  
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`Request timeout after ${timeout}ms`));
  }, timeout);
  
  // If an external signal is provided, abort when it aborts
  if (signal) {
    signal.addEventListener("abort", () => {
      clearTimeout(timeoutId);
      controller.abort(signal.reason);
    });
  }
  
  // Clean up timeout when aborted
  controller.signal.addEventListener("abort", () => {
    clearTimeout(timeoutId);
  });
  
  return controller;
}

/**
 * Parse response based on content type
 */
async function parseResponse<T>(
  response: Response,
  responseType: ResponseType
): Promise<T> {
  switch (responseType) {
    case "json":
      return response.json() as Promise<T>;
    case "msgpack": {
      const buffer = await response.arrayBuffer();
      return msgpack.decode(new Uint8Array(buffer)) as T;
    }
    case "blob":
      return response.blob() as unknown as Promise<T>;
    case "text":
      return response.text() as unknown as Promise<T>;
    case "arraybuffer":
      return response.arrayBuffer() as unknown as Promise<T>;
    default:
      return response.json() as Promise<T>;
  }
}

// ============================================================================
// CORE FETCHER
// ============================================================================

/**
 * Core fetch function with type safety
 * 
 * @template TResponse - Expected response type
 * @template TBody - Request body type
 * @param endpoint - API endpoint (relative to base URL)
 * @param options - Fetch options
 * @returns Promise with typed response
 * 
 * @example
 * ```ts
 * const { data } = await fetcher<UserData>("/api/users/1");
 * console.log(data.name); // Type-safe access
 * ```
 */
export async function fetcher<TResponse, TBody = unknown>(
  endpoint: string,
  options: FetchOptions<TBody> = {}
): Promise<ApiResponse<TResponse>> {
  const {
    method = "GET",
    body,
    params,
    headers = {},
    timeout = DEFAULT_TIMEOUT,
    responseType = "json",
    signal,
  } = options;

  const url = buildUrl(endpoint, params);
  const controller = createTimeoutController(timeout, signal);

  const requestHeaders: Record<string, string> = {
    ...headers,
  };

  // Set Content-Type for JSON body
  if (body && !requestHeaders["Content-Type"]) {
    requestHeaders["Content-Type"] = "application/json";
  }

  try {
    const response = await fetch(url, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (!response.ok) {
      let errorData: unknown;
      try {
        errorData = await response.json();
      } catch {
        errorData = await response.text();
      }

      throw new ApiError(
        `API Error: ${response.status} ${response.statusText}`,
        response.status,
        response.statusText,
        errorData
      );
    }

    const data = await parseResponse<TResponse>(response, responseType);

    return {
      data,
      status: response.status,
      headers: response.headers,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new ApiError("Request was aborted", 0, "Aborted");
      }
      throw new ApiError(error.message, 0, "NetworkError");
    }

    throw new ApiError("Unknown error occurred", 0, "Unknown");
  }
}

// ============================================================================
// TYPED API METHODS
// ============================================================================

/**
 * API namespace with typed methods for each endpoint
 */
export const api = {
  /**
   * Health check endpoint
   */
  health: async (): Promise<{ status: string }> => {
    const { data } = await fetcher<{ status: string }>("/health");
    return data;
  },

  graph: {
    /**
     * Fetch graph data with filters
     * Returns zstd-compressed MsgPack container with Arrow IPC tables
     */
    getData: async (filters: Partial<FilterTypes>): Promise<ProcessMiningData> => {
      // Calculate target_coverage from outlierPrecentage
      const outlierPct = filters.outlierPrecentage ?? 5;
      const targetCoverage = 1 - (outlierPct / 100);
      
      const params: Record<string, string | number | boolean | null | undefined> = {
        start_date: filters.dateRange?.start,
        end_date: filters.dateRange?.end,
        weight_metric: filters.weightFilter,
        time_unit: filters.timeUnitFilter,
        min_cases: filters.minCaseCount,
        max_cases: filters.maxCaseCount,
        min_mean_time: filters.meanTimeRange?.min,
        max_mean_time: filters.meanTimeRange?.max,
        target_coverage: targetCoverage,
      };

      console.log("=== DEBUG: API Request ===");
      console.log("Filters received:", filters);
      const requestUrl = buildUrl("/api/graph/data", params);

      // Fetch compressed data
      const response = await fetch(requestUrl, { method: "POST" });
      
      if (!response.ok) {
        throw new ApiError(
          `API Error: ${response.status}`,
          response.status,
          response.statusText
        );
      }
      
      // Get raw bytes and decompress
      const compressedData = new Uint8Array(await response.arrayBuffer());
      const fzstd = await import("fzstd");
      const decompressedData = fzstd.decompress(compressedData);
      
      // Decode msgpack container
      const container = msgpack.decode(decompressedData) as {
        graphData: Uint8Array;      // Arrow IPC bytes
        allVariants: Uint8Array;    // Arrow IPC bytes
        startActivities: string[];
        endActivities: string[];
        targetCoverage: number;
      };
      
      // Import apache-arrow and parse Arrow IPC tables
      const { tableFromIPC } = await import("apache-arrow");
      
      console.log("=== DEBUG: Parsing Arrow IPC ===");
      const startTime = performance.now();
      
      // Parse Arrow tables
      const graphTable = tableFromIPC(container.graphData);
      const variantsTable = tableFromIPC(container.allVariants);
      
      console.log(`Arrow parsing took: ${(performance.now() - startTime).toFixed(2)}ms`);
      console.log("graphData rows:", graphTable.numRows);
      console.log("allVariants rows:", variantsTable.numRows);
      
      // Convert Arrow table to array of objects for graphData
      const graphData: GraphData[] = [];
      for (let i = 0; i < graphTable.numRows; i++) {
        graphData.push({
          Source_Activity: graphTable.getChild("Source_Activity")?.get(i) as string,
          Target_Activity: graphTable.getChild("Target_Activity")?.get(i) as string,
          Mean_Duration_Seconds: graphTable.getChild("Mean_Duration_Seconds")?.get(i) as number,
          Tooltip_Total_Time: graphTable.getChild("Tooltip_Total_Time")?.get(i) as string,
          Tooltip_Mean_Time: graphTable.getChild("Tooltip_Mean_Time")?.get(i) as string,
          Weight_Value: graphTable.getChild("Weight_Value")?.get(i) as number,
          Edge_Label: graphTable.getChild("Edge_Label")?.get(i) as string,
          Case_Count: graphTable.getChild("Case_Count")?.get(i) as number,
        });
      }
      
      // Convert Arrow table to variants/outliers
      const variants: Variant[] = [];
      const outliers: Variant[] = [];
      
      for (let i = 0; i < variantsTable.numRows; i++) {
        // Get list columns - Arrow stores them as Vector
        const variantPathCol = variantsTable.getChild("Variant_Path")?.get(i);
        const avgTimingsCol = variantsTable.getChild("Avg_Timings")?.get(i);
        const totalTimingsCol = variantsTable.getChild("Total_Timings")?.get(i);
        
        // Convert Arrow list to JS array
        const Variant_Path: string[] = variantPathCol ? Array.from(variantPathCol) : [];
        const Avg_Timings: number[] = avgTimingsCol ? Array.from(avgTimingsCol) : [];
        const Total_Timings: number[] = totalTimingsCol ? Array.from(totalTimingsCol) : [];
        
        const variant: Variant = {
          Variant_Path,
          Frequency: variantsTable.getChild("Frequency")?.get(i) as number,
          Percentage: variantsTable.getChild("Percentage")?.get(i) as number,
          Avg_Timings,
          Total_Timings,
        };
        
        const cumCoverage = variantsTable.getChild("cum_coverage")?.get(i) as number;
        if (cumCoverage <= container.targetCoverage) {
          variants.push(variant);
        } else {
          outliers.push(variant);
        }
      }

      return {
        graphData,
        variants,
        outliers,
        startActivities: container.startActivities,
        endActivities: container.endActivities,
      };
    },
  },

  search: {
    /**
     * Search for a case by ID
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
        const { data } = await fetcher<{
          nodes: string[];
          edge_durations: number[];
          total_duration: number;
          case_id: number;
          position_stats: {
            duration_percentile: number;
            is_slower_than_average: boolean;
          };
        }>("/api/search/search", {
          params: {
            case_id: caseId,
            start_date: options?.startDate,
            end_date: options?.endDate,
            include_global_stats: options?.includeGlobalStats ?? true,
          },
        });

        return {
          found: true,
          data,
        };
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return { found: false };
        }
        throw error;
      }
    },
  },

  stats: {
    /**
     * Get edge statistics for a specific transition
     */
    getEdgeStats: async (
      source: string,
      target: string,
      options?: {
        startDate?: string;
        endDate?: string;
      }
    ): Promise<HistogramData> => {
      const { data } = await fetcher<HistogramData>("/api/stats/edge", {
        params: {
          source,
          target,
          start_date: options?.startDate,
          end_date: options?.endDate,
        },
      });
      return data;
    },

    /**
     * Get global process statistics
     */
    getGlobalStats: async (options?: {
      startDate?: string;
      endDate?: string;
    }): Promise<{
      total_time: HistogramData;
      steps: HistogramData;
    }> => {
      const { data } = await fetcher<{
        total_time: HistogramData;
        steps: HistogramData;
      }>("/api/stats/global", {
        params: {
          start_date: options?.startDate,
          end_date: options?.endDate,
        },
      });
      return data;
    },
  },
};

// ============================================================================
// CONVENIENCE EXPORTS
// ============================================================================

/**
 * Shorthand for GET requests
 */
export const get = <T>(
  endpoint: string,
  params?: Record<string, string | number | boolean | null | undefined>
) => fetcher<T>(endpoint, { method: "GET", params });

/**
 * Shorthand for POST requests
 */
export const post = <T, B = unknown>(endpoint: string, body?: B) =>
  fetcher<T, B>(endpoint, { method: "POST", body });

/**
 * Shorthand for PUT requests
 */
export const put = <T, B = unknown>(endpoint: string, body?: B) =>
  fetcher<T, B>(endpoint, { method: "PUT", body });

/**
 * Shorthand for PATCH requests
 */
export const patch = <T, B = unknown>(endpoint: string, body?: B) =>
  fetcher<T, B>(endpoint, { method: "PATCH", body });

/**
 * Shorthand for DELETE requests
 */
export const del = <T>(endpoint: string) =>
  fetcher<T>(endpoint, { method: "DELETE" });

export default api;
