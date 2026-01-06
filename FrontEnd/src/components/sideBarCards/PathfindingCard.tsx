/**
 * @component PathfindingCard
 * @module components/sideBarCards/PathfindingCard
 *
 * @description
 * Sidebar card for pathfinding functionality.
 * Allows users to select start and end nodes, then displays
 * all possible paths between them with duration statistics.
 *
 * Features:
 * - Two-tab interface (Nodes selection / Paths list)
 * - Start/End node visualization
 * - Path list with frequency and duration sorting
 * - Search filtering for nodes
 *
 * @example
 * ```tsx
 * <PathfindingCard
 *   startNodeId={pathStart}
 *   endNodeId={pathEnd}
 *   paths={foundPaths}
 *   allNodes={nodes}
 *   onSelectPath={handleSelectPath}
 * />
 * ```
 */

import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { Node } from "@xyflow/react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Tooltip } from "@heroui/tooltip";
import { Chip } from "@heroui/chip";
import { ScrollShadow } from "@heroui/scroll-shadow";
import {
  Search,
  List,
  Network,
  MapPin,
  Timer,
  PlayCircle,
  StopCircle,
  ArrowLeft,
  ArrowUpDown,
  RefreshCcw,
} from "lucide-react";

import type { Path } from "../../types/types";
import { PathList } from "./PathList";


interface PathfindingCardProps {
  startNodeId: string | null;
  endNodeId: string | null;
  paths: Path[];
  allNodes: Node[];
  selectedNodeIds: Set<string>;
  isLoading: boolean;
  onSelectPath: (path: Path, index: number) => void;
  selectedIndex: number | null;
  calculatePathDuration: (path: Path) => {
    totalDuration: number;
    averageDuration: number;
  };
  handleNodeClick: (event: React.MouseEvent, node: Node) => void;
  resetPathfinding: () => void;
  removePath: (index: number) => void;
  className?: string;
}

export const PathfindingCard = ({
  startNodeId,
  endNodeId,
  paths,
  allNodes,
  selectedNodeIds,
  isLoading,
  onSelectPath,
  selectedIndex,
  calculatePathDuration,
  handleNodeClick,
  resetPathfinding,
  removePath,
  className,
}: PathfindingCardProps) => {
  // --- States ---
  const [processedPaths, setProcessedPaths] = useState<Path[]>([]);
  const [sortedPaths, setSortedPaths] = useState<Path[]>([]);
  const [isSorted, setIsSorted] = useState(false);
  const [isSorting, setIsSorting] = useState(false);
  const [searchedNodes, setSearchedNodes] = useState<Node[]>([]);
  const [activeTab, setActiveTab] = useState<"Nodes" | "Paths">("Nodes");
  const [searchValue, setSearchValue] = useState("");

  // --- Logic: Base Nodes (نمایش تمام گره‌ها بدون توجه به فیلترها) ---
  // تب مسیریابی مستقل از گره‌های انتخاب شده در تب فیلترها کار می‌کند
  const baseNodes = useMemo(() => {
    // همیشه تمام گره‌ها را برمی‌گردانیم
    return allNodes;
  }, [allNodes]);


  // --- Logic: Process Paths (Calculate Durations) ---
  useEffect(() => {
    if (paths.length === 0) {
      setProcessedPaths([]);
      setSortedPaths([]);
      setIsSorted(false);
      setIsSorting(false);
      return;
    }

    setIsSorting(true);
    const processed: Path[] = [];
    let index = 0;
    const CHUNK_SIZE = 5000;

    function processChunk() {
      try {
        const limit = Math.min(index + CHUNK_SIZE, paths.length);
        for (let i = index; i < limit; i++) {
          const path = paths[i];
          const { totalDuration, averageDuration } = calculatePathDuration(path);
          // افزودن اطلاعات زمان به آبجکت مسیر
          processed.push({ ...path, totalDuration, averageDuration });
        }
        index += CHUNK_SIZE;

        if (index < paths.length) {
          setTimeout(processChunk, 0);
        } else {
          setProcessedPaths(processed);
          setSortedPaths(processed);
          setIsSorting(false);
        }
      } catch (error) {
        console.error("خطا در پردازش مسیرها:", error);
        setIsSorting(false);
      }
    }
    processChunk();
  }, [paths, calculatePathDuration]);

  // --- Logic: Initialize Search ---
  useEffect(() => {
    setSearchedNodes(baseNodes);
  }, [baseNodes]);

  // --- Logic: Sort Paths ---
  const handleSortPaths = () => {
    if (isSorted) return;
    setIsSorting(true);
    setTimeout(() => {
      const sorted = [...processedPaths].sort(
        (a, b) => (a.averageDuration ?? 0) - (b.averageDuration ?? 0)
      );
      setSortedPaths(sorted);
      setIsSorted(true);
      setIsSorting(false);
    }, 10);
  };

  // --- Logic: Search Filter ---
  const handleSearchChange = (value: string) => {
      setSearchValue(value);
      const normalizedValue = value.toLowerCase().replace('ی', 'ي');
      
      if (!normalizedValue.trim()) {
        setSearchedNodes(baseNodes);
        return;
      }
      
      setSearchedNodes(
        baseNodes.filter((node) =>
          (node.data.label as string).toLowerCase().includes(normalizedValue)
        )
      );
  };

  // --- Helper: Get Node Label ---
  const getNodeLabel = (id: string) =>
    allNodes.find((n) => n.id === id)?.data?.label || id;
    
  const startNodeLabel = startNodeId ? getNodeLabel(startNodeId) : null;
  const endNodeLabel = endNodeId ? getNodeLabel(endNodeId) : null;

  return (
    <div className={`flex flex-col h-full gap-3 ${className || ""}`}>
      
      

      {/* --- 2. Visualizer (Start -> End) --- */}
      {/* این بخش همیشه نمایش داده می‌شود تا کاربر وضعیت انتخاب را ببیند */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex flex-col gap-2 relative overflow-hidden shrink-0">
        <div className="absolute top-1/2 right-8 left-8 h-0.5 bg-slate-200 -z-10" />

        {/* Start Node */}
        <div className={`
            relative z-0 flex items-center justify-between p-2 rounded-xl border transition-all duration-300
            ${startNodeId 
                ? "bg-white border-emerald-200 shadow-sm" 
                : "bg-slate-100/50 border-dashed border-slate-300 opacity-70"
            }
        `}>
            <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded-lg ${startNodeId ? "bg-emerald-100 text-emerald-600" : "bg-slate-200 text-slate-400"}`}>
                    <PlayCircle size={18} />
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 font-bold">مبدا</span>
                    <span className={`text-xs font-medium truncate max-w-[150px] ${startNodeId ? "text-slate-800" : "text-slate-400"}`}>
                        {startNodeId ? startNodeLabel : "انتخاب نشده"}
                    </span>
                </div>
            </div>
        </div>

        {/* Arrow */}
        <div className="self-center bg-white border border-slate-200 rounded-full p-1 z-10 text-slate-400 shadow-sm -my-1">
            <ArrowLeft size={12} className="-rotate-90" />
        </div>

        {/* End Node */}
        <div className={`
            relative z-0 flex items-center justify-between p-2 rounded-xl border transition-all duration-300
            ${endNodeId 
                ? "bg-white border-rose-200 shadow-sm" 
                : "bg-slate-100/50 border-dashed border-slate-300 opacity-70"
            }
        `}>
            <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded-lg ${endNodeId ? "bg-rose-100 text-rose-600" : "bg-slate-200 text-slate-400"}`}>
                    <StopCircle size={18} />
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 font-bold">مقصد</span>
                    <span className={`text-xs font-medium truncate max-w-[150px] ${endNodeId ? "text-slate-800" : "text-slate-400"}`}>
                        {endNodeId ? endNodeLabel : "انتخاب نشده"}
                    </span>
                </div>
            </div>
        </div>
      </div>

      {/* --- 3. Custom Tabs --- */}
      <div className="grid grid-cols-2 p-1 bg-slate-100/80 rounded-xl shrink-0 gap-1">
        <button
          onClick={() => setActiveTab("Nodes")}
          className={`
            flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all
            ${activeTab === "Nodes" 
                ? "bg-white text-slate-800 shadow-sm" 
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
            }
          `}
        >
          <Network size={14} />
          انتخاب گره‌ها
        </button>
        <button
          onClick={() => setActiveTab("Paths")}
          disabled={!startNodeId || !endNodeId}
          className={`
            flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all
            ${activeTab === "Paths" 
                ? "bg-white text-slate-800 shadow-sm" 
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
            }
            ${(!startNodeId || !endNodeId) ? "opacity-50 cursor-not-allowed" : ""}
          `}
        >
          <List size={14} />
          لیست مسیرها
          {paths.length > 0 && <span className="bg-blue-100 text-blue-600 px-1.5 rounded-md text-[10px]">{paths.length}</span>}
        </button>
      </div>

      {/* --- 4. Tab Content Area --- */}
      <div className="flex-1 min-h-0 relative overflow-hidden bg-white rounded-xl border border-slate-100">
        
        {/* === TAB 1: NODES === */}
        {activeTab === "Nodes" && (
            <div className="h-full flex flex-col">
                {baseNodes.length > 0 ? (
                    <>
                        {/* Search Bar */}
                        <div className="p-2 border-b border-slate-100">
                            <Input
                                type="text"
                                variant="flat"
                                size="sm"
                                placeholder="جستجو در گره‌های فعال..."
                                startContent={<Search size={16} className="text-slate-400" />}
                                value={searchValue}
                                onValueChange={handleSearchChange}
                                classNames={{
                                    inputWrapper: "bg-slate-50 hover:bg-slate-100 focus-within:bg-white border-slate-200 shadow-none",
                                }}
                            />
                        </div>

                        {/* Nodes List */}
                        <ScrollShadow className="flex-1 p-2">
                            <div className="flex flex-col gap-2">
                                {searchedNodes.length > 0 ? (
                                    searchedNodes.map((node) => {
                                        const isStart = startNodeId === node.id;
                                        const isEnd = endNodeId === node.id;
                                        
                                        return (
                                            <div 
                                                key={node.id}
                                                onClick={(e) => handleNodeClick(e, node)}
                                                className={`
                                                    group flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all duration-200
                                                    ${isStart 
                                                        ? "bg-emerald-50 border-emerald-200 ring-1 ring-emerald-500/20" 
                                                        : isEnd 
                                                            ? "bg-rose-50 border-rose-200 ring-1 ring-rose-500/20"
                                                            : "bg-white border-slate-100 hover:border-blue-300 hover:shadow-md"
                                                    }
                                                `}
                                            >
                                                <span className={`text-sm font-medium ${isStart ? "text-emerald-800" : isEnd ? "text-rose-800" : "text-slate-700"}`}>
                                                    {node.data.label}
                                                </span>
                                                
                                                <div className="flex items-center gap-1">
                                                    {isStart && <Chip size="sm" color="success" variant="flat" className="h-5 text-[10px]">شروع</Chip>}
                                                    {isEnd && <Chip size="sm" color="danger" variant="flat" className="h-5 text-[10px]">پایان</Chip>}
                                                    {!isStart && !isEnd && (
                                                        <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            انتخاب
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="text-center py-8 text-slate-400 text-xs">
                                        گره‌ای یافت نشد.
                                    </div>
                                )}
                            </div>
                        </ScrollShadow>
                        
                        {/* Footer Hint */}
                        <div className="p-2 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 text-center">
                            روی یک گره کلیک کنید تا به عنوان مبدا/مقصد انتخاب شود.
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-3 p-4 text-center">
                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
                            <Network size={24} className="text-slate-400" />
                        </div>
                        <p className="text-slate-500 text-sm font-bold">هیچ گره‌ای انتخاب نشده است</p>
                        <p className="text-slate-400 text-xs max-w-[200px]">
                            لطفا ابتدا از تب "گره‌ها" یا "فیلترها"، گره‌های مورد نظر را به گراف اضافه کنید.
                        </p>
                    </div>
                )}
            </div>
        )}

        {/* === TAB 2: PATHS === */}
        {activeTab === "Paths" && (
            <div className="h-full flex flex-col relative">
                {/* 1. Loading State */}
                {isLoading && (
                     <div className="absolute inset-0 z-20 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-bold text-slate-600">در حال جستجوی مسیرها...</span>
                    </div>
                )}

                {/* 2. Sorting State */}
                {isSorting && (
                     <div className="absolute inset-0 z-20 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                        <RefreshCcw className="animate-spin text-blue-500" />
                        <span className="text-xs font-bold text-slate-600">
                             {isSorted ? "در حال مرتب‌سازی..." : "در حال پردازش..."}
                        </span>
                    </div>
                )}

                {/* 3. Empty State (No paths found) */}
                {!isLoading && !isSorting && paths.length === 0 && (
                     <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center opacity-70">
                        <MapPin size={32} className="text-slate-300" />
                        <p className="text-slate-500 text-sm font-bold">مسیر مستقیمی یافت نشد</p>
                        <p className="text-slate-400 text-xs">
                            بین دو گره انتخاب شده، هیچ ارتباط مستقیمی در داده‌ها وجود ندارد.
                        </p>
                    </div>
                )}

                {/* 4. Path List Content */}
                {!isLoading && paths.length > 0 && (
                    <div className="flex flex-col h-full">
                         {/* Sorting Toolbar */}
                         <div className="flex items-center justify-between p-2 border-b border-slate-100 bg-slate-50/50">
                             <div className="flex items-center gap-1">
                                 <Timer size={14} className="text-slate-400" />
                                 <span className="text-xs text-slate-500">
                                     {isSorted ? "مرتب شده زمانی" : "مرتب شده فرکانسی"}
                                 </span>
                             </div>
                             
                             <Button
                                size="sm"
                                variant="light"
                                color="primary"
                                isDisabled={isSorted}
                                onPress={handleSortPaths}
                                startContent={<ArrowUpDown size={14} />}
                                className="h-7 text-xs font-bold px-2 min-w-0"
                             >
                                 مرتب‌سازی زمانی
                             </Button>
                         </div>

                         {/* List Component */}
                         <ScrollShadow className="flex-1 p-2">
                            <PathList
                                paths={sortedPaths.length > 0 ? sortedPaths : processedPaths.length > 0 ? processedPaths : paths}
                                allNodes={allNodes}
                                selectedIndex={selectedIndex}
                                onSelectPath={onSelectPath}
                                onRemovePath={removePath}
                                groupByType={true}
                                emptyMessage="مسیر معتبری یافت نشد."
                            />
                         </ScrollShadow>
                    </div>
                )}
            </div>
        )}
      </div>

      {/* --- 5. Footer Actions --- */}
      <Button
        fullWidth
        color="danger"
        variant="flat"
        startContent={<RefreshCcw size={16} />}
        onPress={resetPathfinding}
        className="shrink-0 font-bold"
      >
        شروع مجدد مسیریابی
      </Button>

    </div>
  );
};