/**
 * FileUploader Component
 * 
 * Landing page for file selection. Displays a dropzone-style interface
 * for selecting data files (CSV, Parquet, Pickle).
 * 
 * Uses Zustand store to manage file path and trigger navigation to Dashboard.
 * Uses useElectronAPI hook for IPC communication with main process.
 * 
 * @module components/FileUploader
 */

import { useState, useCallback } from "react";
import { Button } from "@heroui/button";
import {
  UploadCloud,
  FileSpreadsheet,
  FileCode,
  FileType,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  X,
} from "lucide-react";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";

import { useAppStore, useElectronAPI } from "../hooks";

/**
 * Supported file extensions
 */
const SUPPORTED_EXTENSIONS = ["csv", "pkl", "parquet"];

/**
 * FileUploader
 * 
 * Provides a file selection interface for importing process mining data.
 * Upon successful file selection and validation, updates the Zustand store
 * which transitions the app to the Dashboard view.
 */
export default function FileUploader() {
  const { openFileDialog } = useElectronAPI();
  const { setDataFilePath } = useAppStore();

  const [error, setError] = useState("");
  const [filePath, setFilePath] = useState<string | null>(null);

  // Extract file name and extension for display
  const fileName = filePath ? filePath.split(/[\\/]/).pop() : "";
  const fileExt = fileName ? fileName.split(".").pop()?.toLowerCase() : "";

  /**
   * Handles file selection via native dialog.
   * Validates the file extension before accepting.
   */
  const handleFileSelect = useCallback(async () => {
    try {
      const result = await openFileDialog();

      if (!result || result.canceled || result.filePaths.length === 0) {
        return;
      }

      const selectedPath = result.filePaths[0];

      // Validate file extension
      const ext = selectedPath.split(".").pop()?.toLowerCase();
      if (!SUPPORTED_EXTENSIONS.includes(ext || "")) {
        setError("فرمت فایل انتخاب شده پشتیبانی نمی‌شود.");
        setFilePath(null);
        return;
      }

      setFilePath(selectedPath);
      setError("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("File selection error:", err);
      setError(`خطا در انتخاب فایل: ${message}`);
    }
  }, [openFileDialog]);

  /**
   * Handles the process button click.
   * Updates the Zustand store with the file path, which triggers
   * the App to show the Dashboard.
   */
  const handleProcess = useCallback(() => {
    if (!filePath) {
      setError("لطفاً ابتدا یک فایل معتبر انتخاب کنید.");
      return;
    }

    try {
      setDataFilePath(filePath);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("Processing error:", e);
      setError(message || "خطای ناشناخته در شروع پردازش.");
    }
  }, [filePath, setDataFilePath]);

  /**
   * Clears the selected file.
   */
  const clearFile = useCallback(() => {
    setFilePath(null);
    setError("");
  }, []);

  /**
   * Returns the appropriate icon for the file type.
   */
  const getFileIcon = () => {
    switch (fileExt) {
      case "csv":
        return <FileSpreadsheet size={24} />;
      case "pkl":
        return <FileCode size={24} />;
      case "parquet":
        return <FileType size={24} />;
      default:
        return <FileType size={24} />;
    }
  };

  return (
    <div
      className="h-screen w-screen flex flex-col items-center justify-center bg-slate-50 relative overflow-hidden"
      dir="rtl"
    >
      {/* Background Pattern */}
      <div
        className="absolute inset-0 z-0 opacity-[0.03]"
        style={{
          backgroundImage: "radial-gradient(#475569 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <Card className="w-[90%] max-w-lg z-10 shadow-2xl border border-white/50 backdrop-blur-sm bg-white/80 rounded-3xl">
        <CardBody className="p-8 flex flex-col items-center gap-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm border border-blue-100">
              <FileSpreadsheet size={32} />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">
              آپلود داده‌های فرآیند
            </h1>
            <p className="text-slate-500 text-sm">
              برای شروع تحلیل فرآیندکاوی، فایل داده‌های خود را وارد کنید.
            </p>
          </div>

          {/* Upload Area / Selected File View */}
          {!filePath ? (
            <div onClick={handleFileSelect} className="w-full group cursor-pointer">
              <div
                className="
                flex flex-col items-center justify-center gap-4 py-10 px-6
                border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50/50
                transition-all duration-300 ease-out
                group-hover:border-blue-400 group-hover:bg-blue-50/30 group-hover:scale-[1.01]
              "
              >
                <div className="p-4 bg-white rounded-full shadow-sm group-hover:shadow-md transition-shadow">
                  <UploadCloud
                    size={28}
                    className="text-slate-400 group-hover:text-blue-500 transition-colors"
                  />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-bold text-slate-700 group-hover:text-blue-600 transition-colors">
                    برای انتخاب فایل کلیک کنید
                  </p>
                  <p className="text-xs text-slate-400">
                    فرمت‌های پشتیبانی شده: CSV, Parquet, Pickle
                  </p>
                </div>

                {/* Format Chips */}
                <div className="flex gap-2 mt-2">
                  <Chip
                    size="sm"
                    variant="flat"
                    className="bg-slate-200/50 text-slate-500 text-[10px] h-6"
                  >
                    .csv
                  </Chip>
                  <Chip
                    size="sm"
                    variant="flat"
                    className="bg-slate-200/50 text-slate-500 text-[10px] h-6"
                  >
                    .parquet
                  </Chip>
                  <Chip
                    size="sm"
                    variant="flat"
                    className="bg-slate-200/50 text-slate-500 text-[10px] h-6"
                  >
                    .pkl
                  </Chip>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full animate-appearance-in">
              <div className="relative flex items-center gap-4 p-4 border border-blue-200 bg-blue-50/50 rounded-2xl">
                {/* File Icon */}
                <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-blue-600 shadow-sm border border-blue-100 shrink-0">
                  {getFileIcon()}
                </div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-bold text-slate-800 truncate dir-ltr text-right mb-1"
                    title={filePath}
                  >
                    {fileName}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-blue-200 text-blue-800 px-2 py-0.5 rounded text-uppercase font-mono">
                      {fileExt?.toUpperCase()}
                    </span>
                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                      <CheckCircle2 size={12} className="text-emerald-500" />
                      آماده پردازش
                    </span>
                  </div>
                </div>

                {/* Remove Button */}
                <button
                  onClick={clearFile}
                  className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full transition-colors absolute top-2 left-2"
                  title="حذف فایل"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="w-full p-3 rounded-xl bg-rose-50 border border-rose-100 flex items-start gap-3 animate-appearance-in">
              <AlertCircle size={20} className="text-rose-500 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-600 leading-5 font-medium">{error}</p>
            </div>
          )}

          {/* Action Button */}
          <div className="w-full pt-2">
            <Button
              size="lg"
              fullWidth
              color="primary"
              variant="shadow"
              isDisabled={!filePath}
              onPress={handleProcess}
              className={`
                font-bold text-base h-12 rounded-xl shadow-lg transition-all
                ${!filePath ? "opacity-50" : "shadow-blue-500/30 hover:scale-[1.02]"}
              `}
              startContent={
                !filePath ? <UploadCloud size={20} /> : <ArrowLeft size={20} />
              }
            >
              {filePath ? "شروع پردازش و نمایش گراف" : "منتظر انتخاب فایل..."}
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Footer / Version Info */}
      <div className="absolute bottom-4 text-center text-slate-400 text-[10px]">
        Process Mining Graph Visualizer v2.0
      </div>
    </div>
  );
}