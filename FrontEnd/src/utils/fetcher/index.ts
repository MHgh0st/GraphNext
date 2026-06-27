
/**
 * @module utils/fetcher
 *
 * Public entry point — assembles the `api` object and re-exports everything
 * from the sub-modules so existing imports continue to work unchanged:
 *
 *   import api from "@/utils/fetcher";
 *   import { api, fetcher, ApiError } from "@/utils/fetcher";
 */

// Core primitives
export {
  API_BASE_URL,
  DEFAULT_TIMEOUT,
  ApiError,
  fetcher,
  buildUrl,
  get,
  post,
  put,
  patch,
  del,
} from "./core";
export type { HttpMethod, ResponseType, FetchOptions, ApiResponse } from "./core";

// Domain API modules
import { healthApi } from "./api/health";
import { graphApi }  from "./api/graph";
import { searchApi } from "./api/search";
import { statsApi }  from "./api/stats";

/**
 * Typed API namespace — use this for all backend calls.
 *
 * @example
 * ```ts
 * import api from "@/utils/fetcher";
 *
 * const data = await api.graph.getData(filters);
 * const result = await api.search.byId(42);
 * const stats = await api.stats.getEdgeStats("A", "B");
 * ```
 */
export const api = {
  health: healthApi,
  graph:  graphApi,
  search: searchApi,
  stats:  statsApi,
};

export default api;
