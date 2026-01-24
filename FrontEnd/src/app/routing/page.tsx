'use client'

/**
 * @component PathfindingPage
 * @description
 * Next.js route page for pathfinding functionality.
 * Gets all state from Zustand stores (useAppStore and useGraphStore).
 * Uses allVariants list to find paths between nodes.
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { Node } from "@xyflow/react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
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

import type { Path, Variant, ExtendedPath } from "@/types/types";
import { PathList } from "@/components/sideBarCards/PathList";
import { useAppStore } from "@/hooks/useAppStore";
import { useGraphStore } from "@/store/useGraphStore";

// ============================================================================
// COMPONENT
// ============================================================================

export default function PathfindingPage() {
  // --- Get state from stores ---
  const { 
    variants, 
    isLoading: appLoading, 
    selectedNodeIds,
    setSelectedPathNodes,
    setSelectedPathEdges,
    setSelectedPathIndex: setAppSelectedPathIndex,
    graphData,
    startEndNodes,
    selectedColorPalette,
  } = useAppStore();
  const { 
    allNodes, 
    pathStartNodeId, 
    pathEndNodeId, 
    foundPaths, 
    setPathStartNodeId, 
    setPathEndNodeId, 
    setFoundPaths,
    setActivePath,
    computeLayout,
  } = useGraphStore();

  // --- Local States ---
  const [processedPaths, setProcessedPaths] = useState<Path[]>([]);
  const [sortedPaths, setSortedPaths] = useState<Path[]>([]);
  const [isSorted, setIsSorted] = useState(false);
  const [isSorting, setIsSorting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchedNodes, setSearchedNodes] = useState<Node[]>([]);
  const [activeTab, setActiveTab] = useState<"Nodes" | "Paths">("Nodes");
  const [searchValue, setSearchValue] = useState("");
  const [selectedPathIndex, setSelectedPathIndex] = useState<number | null>(null);

  // --- Get all nodes (excluding START_NODE and END_NODE) ---
  const baseNodes = useMemo(() => {
    return allNodes;
  }, [allNodes]);

  // --- Initialize search with base nodes ---
  useEffect(() => {
    setSearchedNodes(baseNodes);
  }, [baseNodes]);

  // --- Find paths between nodes using variants ---
  const findPathsBetweenNodes = useCallback((startId: string, endId: string, variantList: Variant[]): ExtendedPath[] => {
    if (!variantList || variantList.length === 0) return [];
    
    const paths: ExtendedPath[] = [];
    
    for (const variant of variantList) {
      const variantPath = variant.Variant_Path;
      let startIndex = variantPath.indexOf(startId);
      if(startId === "START_NODE") startIndex = 0;
      
      if (startIndex === -1) continue;
      
      // Find the LAST occurrence of endId to correctly handle duplicate labels
      let endIndex = variantPath.lastIndexOf(endId);
      if(endId === "END_NODE") endIndex = variantPath.length - 1;
      
      // Validate: endIndex must exist and be after startIndex
      if (endIndex === -1 || endIndex <= startIndex) continue;
      
      // Extract the subpath from start to end
      const subPath = variantPath.slice(startIndex, endIndex + 1);
      
      // Determine path type:
      // - "absolute": starts at index 0 of variant AND ends at last index
      // - "relative": starts somewhere in the middle
      const isAbsolute = startIndex === 0 && endIndex === variantPath.length - 1;
      
      // Create ExtendedPath object with proper typing
      const path: ExtendedPath = {
        nodes: subPath,
        edges: [],
        frequency: variant.Frequency,
        totalDuration: 0,
        averageDuration: 0,
        _pathType: isAbsolute ? "absolute" : "relative",
        _frequency: variant.Frequency,
        _fullPathNodes: variantPath,
        _startIndex: startIndex,
        _endIndex: endIndex,
      };
      
      // Calculate edge durations from variant timings
      // IMPORTANT: Avg_Timings contains CUMULATIVE timestamps (Seconds_From_Start at each activity)
      // To get edge duration, we need: Avg_Timings[i+1] - Avg_Timings[i]
      if (variant.Avg_Timings && variant.Avg_Timings.length > 0) {
        const startTimingIndex = startIndex;
        const endTimingIndex = endIndex;
        
        // Sum up durations for this subpath
        let totalDuration = 0;
        const edgeDurations: Record<string, number> = {};
        const edgeTotalDurations: Record<string, number> = {};
        
        // Loop through activities and calculate edge durations as differences
        for (let i = startTimingIndex; i < endTimingIndex && (i + 1) < variant.Avg_Timings.length; i++) {
          // Edge duration = time at next activity - time at current activity
          const currentTime = variant.Avg_Timings[i] ?? 0;
          const nextTime = variant.Avg_Timings[i + 1] ?? 0;
          const avgDuration = Math.max(0, nextTime - currentTime);
          
          // Same for total timings
          const currentTotal = variant.Total_Timings?.[i] ?? 0;
          const nextTotal = variant.Total_Timings?.[i + 1] ?? 0;
          const totalTimingDuration = Math.max(0, nextTotal - currentTotal);
          
          totalDuration += avgDuration;
          
          // Build edge ID for this transition
          const edgeSource = variantPath[i];
          const edgeTarget = variantPath[i + 1];
          const edgeId = `${edgeSource}->${edgeTarget}`;
          edgeDurations[edgeId] = avgDuration;
          edgeTotalDurations[edgeId] = totalTimingDuration;
        }
        
        path.totalDuration = totalDuration;
        path.averageDuration = subPath.length > 1 ? totalDuration / (subPath.length - 1) : 0;
        path._variantDuration = totalDuration;
        path._variantTimings = variant.Avg_Timings.slice(startTimingIndex, endTimingIndex + 1); // Include end timestamp
        path._specificEdgeDurations = edgeDurations;
        path._specificTotalDurations = edgeTotalDurations;
      }
      
      paths.push(path);
    }
    
    // Group similar paths and accumulate frequencies + calculate average durations
    // Group similar paths and accumulate frequencies + calculate weighted average durations
    const pathMap = new Map<string, { 
      path: ExtendedPath; 
      totalFrequency: number;
      weightedTotalDuration: number;
      weightedEdgeDurations: Record<string, number>;
      summedEdgeTotalDurations: Record<string, number>;
    }>();

    for (const path of paths) {
      const key = path.nodes.join("->");
      const frequency = path.frequency || 1;
      const pathTotalDuration = path.totalDuration || 0;
      
      const existing = pathMap.get(key);
      if (existing) {
        // Accumulate frequency
        existing.totalFrequency += frequency;
        
        // Accumulate weighted total duration
        existing.weightedTotalDuration += pathTotalDuration * frequency;
        
        // Accumulate weighted edge durations (for averages)
        if (path._specificEdgeDurations) {
          for (const [edgeId, duration] of Object.entries(path._specificEdgeDurations)) {
            existing.weightedEdgeDurations[edgeId] = (existing.weightedEdgeDurations[edgeId] || 0) + (duration * frequency);
          }
        }
        // Accumulate total edge durations (sum of all totals)
        if (path._specificTotalDurations) {
          for (const [edgeId, totalDur] of Object.entries(path._specificTotalDurations)) {
            existing.summedEdgeTotalDurations[edgeId] = (existing.summedEdgeTotalDurations[edgeId] || 0) + totalDur;
          }
        }
      } else {
        // Initialize with first path's data (weighted)
        const weightedEdgeDurations: Record<string, number> = {};
        if (path._specificEdgeDurations) {
          for (const [edgeId, duration] of Object.entries(path._specificEdgeDurations)) {
            weightedEdgeDurations[edgeId] = duration * frequency;
          }
        }
        const summedEdgeTotalDurations: Record<string, number> = {};
        if (path._specificTotalDurations) {
          for (const [edgeId, totalDur] of Object.entries(path._specificTotalDurations)) {
            summedEdgeTotalDurations[edgeId] = totalDur;
          }
        }

        pathMap.set(key, { 
          path: { ...path }, // Keep other props from first occurrence
          totalFrequency: frequency,
          weightedTotalDuration: pathTotalDuration * frequency,
          weightedEdgeDurations,
          summedEdgeTotalDurations
        });
      }
    }
    
    // Calculate final averages and prepare merged paths
    const mergedPaths = Array.from(pathMap.values()).map(({ path, totalFrequency, weightedTotalDuration, weightedEdgeDurations, summedEdgeTotalDurations }) => {
      // Calculate average edge durations (Weighted Total / Total Frequency)
      const avgEdgeDurations: Record<string, number> = {};
      for (const [edgeId, weightedTotal] of Object.entries(weightedEdgeDurations)) {
        avgEdgeDurations[edgeId] = weightedTotal / totalFrequency;
      }
      
      // Update path properties
      path.frequency = totalFrequency;
      path._frequency = totalFrequency;
      path._specificEdgeDurations = avgEdgeDurations;
      path._specificTotalDurations = summedEdgeTotalDurations; // Keep the summed totals
      
      // Calculate average total duration
      path.totalDuration = weightedTotalDuration / totalFrequency;
      path.averageDuration = path.nodes.length > 1 ? path.totalDuration / (path.nodes.length - 1) : 0;
      
      // Update variant duration/frequency to match merged data
      path._variantDuration = path.totalDuration;
      
      return path;
    });
    
    // Sort by frequency descending
    return mergedPaths.sort((a, b) => (b.frequency || 0) - (a.frequency || 0));
  }, []);

  // --- Effect: Search paths when both nodes are selected ---
  useEffect(() => {
    if (pathStartNodeId && pathEndNodeId && variants) {
      setIsSearching(true);
      // Use setTimeout to not block UI
      setTimeout(() => {
        const paths = findPathsBetweenNodes(pathStartNodeId, pathEndNodeId, variants);
        setFoundPaths(paths);
        setProcessedPaths(paths);
        setSortedPaths(paths);
        setIsSearching(false);
        setIsSorted(false);
        
        // Switch to paths tab if paths found
        if (paths.length > 0) {
          setActiveTab("Paths");
        }
      }, 10);
    }
  }, [pathStartNodeId, pathEndNodeId, variants, findPathsBetweenNodes, setFoundPaths]);

  // --- Cleanup effect: Reset graph when leaving pathfinding page ---
  useEffect(() => {
    return () => {
      // Clear path highlighting when component unmounts
      setSelectedPathNodes(new Set());
      setSelectedPathEdges(new Set());
      setAppSelectedPathIndex(null);
      setActivePath(null);
      
      // Restore original layout with filter nodes
      computeLayout({
        graphData,
        colorPaletteKey: selectedColorPalette,
        startEndNodes: startEndNodes || { start: [], end: [] },
        filteredNodeIds: selectedNodeIds,
        filteredEdgeIds: null,
        activePathInfo: undefined,
        searchCasePathInfo: undefined,
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run cleanup on unmount

  // --- Handle node click for start/end selection ---
  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    // Clear search results helper
    const clearPaths = () => {
      setFoundPaths([]);
      setProcessedPaths([]);
      setSortedPaths([]);
      setSelectedPathIndex(null);
    };

    if (!pathStartNodeId) {
      // No start node - set this as start
      setPathStartNodeId(node.id);
    } else if (!pathEndNodeId && node.id !== pathStartNodeId) {
      // Have start, no end - set this as end
      setPathEndNodeId(node.id);
    } else if (node.id === pathStartNodeId) {
      // Clicked on start node - clear everything
      setPathStartNodeId(null);
      setPathEndNodeId(null);
      clearPaths();
    } else if (node.id === pathEndNodeId) {
      // Clicked on end node - clear just end
      setPathEndNodeId(null);
      clearPaths();
    } else {
      // Both are selected and user clicked a NEW node - restart with this as new start
      setPathStartNodeId(node.id);
      setPathEndNodeId(null);
      clearPaths();
    }
  }, [pathStartNodeId, pathEndNodeId, setPathStartNodeId, setPathEndNodeId, setFoundPaths]);

  // --- Handle sort paths ---
  const handleSortPaths = useCallback(() => {
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
  }, [isSorted, processedPaths]);

  // --- Handle search filter ---
  const handleSearchChange = useCallback((value: string) => {
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
  }, [baseNodes]);

  // --- Handle select path ---
  const handleSelectPath = useCallback((path: Path, index: number) => {
    setSelectedPathIndex(index);
    setAppSelectedPathIndex(index);
    
    // Set the selected path nodes (only path nodes, no START_NODE/END_NODE)
    const pathNodeIds = new Set(path.nodes);
    setSelectedPathNodes(pathNodeIds);
    
    // Generate edge IDs from consecutive node pairs (format: "source->target")
    const edgeIds = new Set<string>();
    
    // Add edges within the path only
    for (let i = 0; i < path.nodes.length - 1; i++) {
      const source = path.nodes[i];
      const target = path.nodes[i + 1];
      edgeIds.add(`${source}->${target}`);
    }
    
    setSelectedPathEdges(edgeIds);
    
    // Cast to ExtendedPath to access edge durations
    const extPath = path as import("@/types/types").ExtendedPath;
    
    // Set the active path in store so calculateEdgeOverride can access it
    setActivePath(extPath);
    
    // Re-layout the graph with only the path nodes
    const activePathInfoData = {
      nodes: path.nodes,
      edges: Array.from(edgeIds),
      edgeDurations: extPath._specificEdgeDurations || {},
      edgeTotalDurations: extPath._specificTotalDurations || {},
      frequency: extPath._frequency || extPath.frequency,
    };
    
    computeLayout({
      graphData,
      colorPaletteKey: selectedColorPalette,
      startEndNodes: startEndNodes || { start: [], end: [] },
      filteredNodeIds: pathNodeIds,
      filteredEdgeIds: edgeIds,
      activePathInfo: activePathInfoData,
      searchCasePathInfo: undefined,
    });
  }, [setSelectedPathNodes, setSelectedPathEdges, setAppSelectedPathIndex, setActivePath, computeLayout, graphData, selectedColorPalette, startEndNodes]);

  // --- Handle reset ---
  const resetPathfinding = useCallback(() => {
    setPathStartNodeId(null);
    setPathEndNodeId(null);
    setFoundPaths([]);
    setProcessedPaths([]);
    setSortedPaths([]);
    setSelectedPathIndex(null);
    setIsSorted(false);
    setActiveTab("Nodes");
    // Clear path highlighting in the app store
    setSelectedPathNodes(new Set());
    setSelectedPathEdges(new Set());
    setAppSelectedPathIndex(null);
    // Clear active path in graph store
    setActivePath(null);
    
    // Restore original layout (with all selected nodes from filters)
    computeLayout({
      graphData,
      colorPaletteKey: selectedColorPalette,
      startEndNodes: startEndNodes || { start: [], end: [] },
      filteredNodeIds: selectedNodeIds,
      filteredEdgeIds: null,
      activePathInfo: undefined,
      searchCasePathInfo: undefined,
    });
  }, [setPathStartNodeId, setPathEndNodeId, setFoundPaths, setSelectedPathNodes, setSelectedPathEdges, setAppSelectedPathIndex, setActivePath, computeLayout, graphData, selectedColorPalette, startEndNodes, selectedNodeIds]);

  // --- Handle remove path ---
  const removePath = useCallback((index: number) => {
    // Remove the path from all path lists
    setProcessedPaths((prev) => prev.filter((_, i) => i !== index));
    setSortedPaths((prev) => prev.filter((_, i) => i !== index));
    
    // If the removed path was selected, clear selection and restore layout
    if (selectedPathIndex === index) {
      setSelectedPathIndex(null);
      setSelectedPathNodes(new Set());
      setSelectedPathEdges(new Set());
      setAppSelectedPathIndex(null);
      
      // Restore original layout
      computeLayout({
        graphData,
        colorPaletteKey: selectedColorPalette,
        startEndNodes: startEndNodes || { start: [], end: [] },
        filteredNodeIds: selectedNodeIds,
        filteredEdgeIds: null,
        activePathInfo: undefined,
        searchCasePathInfo: undefined,
      });
    } else if (selectedPathIndex !== null && selectedPathIndex > index) {
      // Adjust selected index if it was after the removed item
      setSelectedPathIndex(selectedPathIndex - 1);
    }
  }, [selectedPathIndex, setSelectedPathNodes, setSelectedPathEdges, setAppSelectedPathIndex, computeLayout, graphData, selectedColorPalette, startEndNodes, selectedNodeIds]);

  // --- Helper: Get Node Label ---
  const getNodeLabel = useCallback((id: string) =>
    allNodes.find((n) => n.id === id)?.data?.label || id, [allNodes]);
    
  const startNodeLabel = pathStartNodeId ? getNodeLabel(pathStartNodeId) : null;
  const endNodeLabel = pathEndNodeId ? getNodeLabel(pathEndNodeId) : null;

  const paths = foundPaths as Path[];
  const isLoading = appLoading || isSearching;

  return (
    <div className="flex flex-col h-full gap-3">
      
      {/* --- Visualizer (Start -> End) --- */}
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex flex-col gap-2 relative overflow-hidden shrink-0">
        <div className="absolute top-1/2 right-8 left-8 h-0.5 bg-slate-200 -z-10" />

        {/* Start Node */}
        <div className={`
            relative z-0 flex items-center justify-between p-2 rounded-xl border transition-all duration-300
            ${pathStartNodeId 
                ? "bg-white border-emerald-200 shadow-sm" 
                : "bg-slate-100/50 border-dashed border-slate-300 opacity-70"
            }
        `}>
            <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded-lg ${pathStartNodeId ? "bg-emerald-100 text-emerald-600" : "bg-slate-200 text-slate-400"}`}>
                    <PlayCircle size={18} />
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 font-bold">مبدا</span>
                    <span className={`text-xs font-medium truncate max-w-[150px] ${pathStartNodeId ? "text-slate-800" : "text-slate-400"}`}>
                        {pathStartNodeId ? startNodeLabel : "انتخاب نشده"}
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
            ${pathEndNodeId 
                ? "bg-white border-rose-200 shadow-sm" 
                : "bg-slate-100/50 border-dashed border-slate-300 opacity-70"
            }
        `}>
            <div className="flex items-center gap-3">
                <div className={`p-1.5 rounded-lg ${pathEndNodeId ? "bg-rose-100 text-rose-600" : "bg-slate-200 text-slate-400"}`}>
                    <StopCircle size={18} />
                </div>
                <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 font-bold">مقصد</span>
                    <span className={`text-xs font-medium truncate max-w-[150px] ${pathEndNodeId ? "text-slate-800" : "text-slate-400"}`}>
                        {pathEndNodeId ? endNodeLabel : "انتخاب نشده"}
                    </span>
                </div>
            </div>
        </div>
      </div>

      {/* --- Custom Tabs --- */}
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
          disabled={!pathStartNodeId || !pathEndNodeId}
          className={`
            flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all
            ${activeTab === "Paths" 
                ? "bg-white text-slate-800 shadow-sm" 
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
            }
            ${(!pathStartNodeId || !pathEndNodeId) ? "opacity-50 cursor-not-allowed" : ""}
          `}
        >
          <List size={14} />
          لیست مسیرها
          {paths.length > 0 && <span className="bg-blue-100 text-blue-600 px-1.5 rounded-md text-[10px]">{paths.length}</span>}
        </button>
      </div>

      {/* --- Tab Content Area --- */}
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
                                placeholder="جستجو در گره‌ها..."
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
                                        const isStart = pathStartNodeId === node.id;
                                        const isEnd = pathEndNodeId === node.id;
                                        
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
                                                    {node.data.label as string}
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
                        <p className="text-slate-500 text-sm font-bold">هیچ گره‌ای وجود ندارد</p>
                        <p className="text-slate-400 text-xs max-w-[200px]">
                            لطفا ابتدا از نوار بالا فیلتر تاریخ را اعمال کنید.
                        </p>
                    </div>
                )}
            </div>
        )}

        {/* === TAB 2: PATHS === */}
        {activeTab === "Paths" && (
            <div className="h-full flex flex-col relative">
                {/* Loading State */}
                {isLoading && (
                     <div className="absolute inset-0 z-20 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-bold text-slate-600">در حال جستجوی مسیرها...</span>
                    </div>
                )}

                {/* Sorting State */}
                {isSorting && (
                     <div className="absolute inset-0 z-20 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                        <RefreshCcw className="animate-spin text-blue-500" />
                        <span className="text-xs font-bold text-slate-600">
                             {isSorted ? "در حال مرتب‌سازی..." : "در حال پردازش..."}
                        </span>
                    </div>
                )}

                {/* Empty State */}
                {!isLoading && !isSorting && paths.length === 0 && (
                     <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center opacity-70">
                        <MapPin size={32} className="text-slate-300" />
                        <p className="text-slate-500 text-sm font-bold">مسیر مستقیمی یافت نشد</p>
                        <p className="text-slate-400 text-xs">
                            بین دو گره انتخاب شده، هیچ ارتباط مستقیمی در داده‌ها وجود ندارد.
                        </p>
                    </div>
                )}

                {/* Path List Content */}
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
                                selectedIndex={selectedPathIndex}
                                onSelectPath={handleSelectPath}
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

      {/* --- Footer Actions --- */}
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
}