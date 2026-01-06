/**
 * ProcessData Utility
 * 
 * Helper function for processing data files via the Electron IPC bridge.
 * Determines file format from extension and calls appropriate API method.
 * 
 * @module utils/ProcessData
 */

import { type FilterTypes } from "../types/types";

/**
 * Supported file format types
 */
type FormatType = "csv" | "pkl" | "parquet";

/**
 * ProcessData
 * 
 * Processes a data file through the Python backend.
 * Handles both full data processing and single case search operations.
 * 
 * @param filePath - Absolute path to the data file
 * @param filters - Filter configuration for processing
 * @param caseID - Optional case ID for single case search
 * @returns Processed data from Python backend
 * @throws Error if file format is invalid or IPC call fails
 * 
 * @example
 * ```ts
 * const data = await ProcessData("/path/to/data.csv", filters);
 * ```
 */
export default async function ProcessData(
  filePath: string,
  filters: FilterTypes,
  caseID?: number
) {
  const fileExtension = filePath.split(".").pop()?.toLowerCase() || "";
  
  const formatType: FormatType | "" =
    fileExtension === "csv"
      ? "csv"
      : fileExtension === "pkl"
        ? "pkl"
        : fileExtension === "parquet"
          ? "parquet"
          : "";

  try {
    if (formatType === "csv" || formatType === "pkl" || formatType === "parquet") {
      if (caseID) {
        return await window.electronAPI.searchCase(
          caseID,
          filePath,
          formatType,
          filters.dateRange.start,
          filters.dateRange.end
        );
      }
      
      return await window.electronAPI.processData(formatType, filePath, filters);
    }
    
    throw new Error("فرمت فایل نا معتبر است");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to process data via IPC: ${message}`);
  }
}
