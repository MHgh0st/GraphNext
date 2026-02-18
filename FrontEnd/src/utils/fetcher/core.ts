/**
 * Core fetcher: configuration, types, helpers, and the base `fetcher()` function.
 */

import * as msgpack from "@msgpack/msgpack";

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * API base URL — handles both Docker (SSR) and browser (client-side) environments.
 */
export const API_BASE_URL =
  typeof window === "undefined"
    ? process.env.INTERNAL_API_URL ?? "http://backend:8000"   // Server-side: Docker internal
    : process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"; // Client-side: Browser

/** Default request timeout in milliseconds. */
export const DEFAULT_TIMEOUT = 60_000;

// ============================================================================
// TYPES
// ============================================================================

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type ResponseType = "json" | "msgpack" | "blob" | "text" | "arraybuffer";

/** Custom error class for API errors. */
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

/** Options for fetch requests. */
export interface FetchOptions<TBody = unknown> {
  method?: HttpMethod;
  body?: TBody;
  params?: Record<string, string | number | boolean | null | undefined>;
  headers?: Record<string, string>;
  timeout?: number;
  responseType?: ResponseType;
  signal?: AbortSignal;
}

/** Wrapper for a successful API response. */
export interface ApiResponse<T> {
  data: T;
  status: number;
  headers: Headers;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Build a full URL with optional query parameters. */
export function buildUrl(
  endpoint: string,
  params?: Record<string, string | number | boolean | null | undefined>
): string {
  const url = new URL(endpoint, API_BASE_URL);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    }
  }
  return url.toString();
}

/** Create an AbortController that times out after `timeout` ms. */
function createTimeoutController(timeout: number, signal?: AbortSignal): AbortController {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`Request timeout after ${timeout}ms`));
  }, timeout);

  if (signal) {
    signal.addEventListener("abort", () => {
      clearTimeout(timeoutId);
      controller.abort(signal.reason);
    });
  }

  controller.signal.addEventListener("abort", () => clearTimeout(timeoutId));
  return controller;
}

/** Parse a fetch Response into the expected type based on `responseType`. */
async function parseResponse<T>(response: Response, responseType: ResponseType): Promise<T> {
  switch (responseType) {
    case "json":        return response.json() as Promise<T>;
    case "msgpack": {
      const buffer = await response.arrayBuffer();
      return msgpack.decode(new Uint8Array(buffer)) as T;
    }
    case "blob":        return response.blob() as unknown as Promise<T>;
    case "text":        return response.text() as unknown as Promise<T>;
    case "arraybuffer": return response.arrayBuffer() as unknown as Promise<T>;
    default:            return response.json() as Promise<T>;
  }
}

// ============================================================================
// CORE FETCHER
// ============================================================================

/**
 * Type-safe core fetch function.
 *
 * @example
 * ```ts
 * const { data } = await fetcher<UserData>("/api/users/1");
 * console.log(data.name); // type-safe
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

  const requestHeaders: Record<string, string> = { ...headers };
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
      try { errorData = await response.json(); }
      catch { errorData = await response.text(); }
      throw new ApiError(
        `API Error: ${response.status} ${response.statusText}`,
        response.status,
        response.statusText,
        errorData
      );
    }

    const data = await parseResponse<TResponse>(response, responseType);
    return { data, status: response.status, headers: response.headers };

  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error) {
      if (error.name === "AbortError") throw new ApiError("Request was aborted", 0, "Aborted");
      throw new ApiError(error.message, 0, "NetworkError");
    }
    throw new ApiError("Unknown error occurred", 0, "Unknown");
  }
}

// ============================================================================
// CONVENIENCE SHORTHANDS
// ============================================================================

export const get = <T>(
  endpoint: string,
  params?: Record<string, string | number | boolean | null | undefined>
) => fetcher<T>(endpoint, { method: "GET", params });

export const post = <T, B = unknown>(endpoint: string, body?: B) =>
  fetcher<T, B>(endpoint, { method: "POST", body });

export const put = <T, B = unknown>(endpoint: string, body?: B) =>
  fetcher<T, B>(endpoint, { method: "PUT", body });

export const patch = <T, B = unknown>(endpoint: string, body?: B) =>
  fetcher<T, B>(endpoint, { method: "PATCH", body });

export const del = <T>(endpoint: string) =>
  fetcher<T>(endpoint, { method: "DELETE" });
