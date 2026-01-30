'use client';

/**
 * @page OutliersPage
 * @module app/outliers/page
 *
 * @description
 * Page for viewing variants sorted by frequency (lowest to highest).
 * Shows all process variants for outlier analysis.
 */

import { useMemo, useEffect, useCallback } from "react";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { Chip } from "@heroui/chip";
import { TrendingDown, Activity, BarChart3 } from "lucide-react";

import type { Path, ExtendedPath } from "@/types/types";
import { PathList } from "@/components/sideBarCards/PathList";
import { useAppStore } from "@/hooks/useAppStore";
import { useGraphStore } from "@/store/useGraphStore";

export default function OutliersPage() {
  // --- Global Stores ---
  const {
    outliers,
    graphData,
    startEndNodes,
    selectedColorPalette,
    selectedNodeIds,
    selectedPathNodes,
    selectedPathEdges,
    selectedPathIndex,
    setSelectedPathNodes,
    setSelectedPathEdges,
    setSelectedPathIndex,
  } = useAppStore();

  const graphStore = useGraphStore();
  const allNodes = graphStore.layoutedNodes;

  // --- Cleanup on unmount ---
  useEffect(() => {
    return () => {
      resetGraphState();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetGraphState = () => {
    setSelectedPathNodes(new Set());
    setSelectedPathEdges(new Set());
    setSelectedPathIndex(null);
    graphStore.setActivePath(null);

    if (graphData && startEndNodes) {
      graphStore.computeLayout({
        graphData,
        colorPaletteKey: selectedColorPalette,
        startEndNodes: startEndNodes,
        filteredNodeIds: selectedNodeIds,
        filteredEdgeIds: null,
        activePathInfo: undefined,
        searchCasePathInfo: undefined,
      });
    }
  };

  // --- Convert outliers to paths and sort by frequency (lowest to highest) ---
  const sortedPaths = useMemo<ExtendedPath[]>(() => {
    if (!outliers || outliers.length === 0) return [];

    const mappedPaths = outliers.map((variant) => {
      const nodes = variant.Variant_Path;
      
      // Calculate edge stats (sum and count for each edge)
      const edgeStats: Record<string, { sum: number; count: number }> = {};
      
      for (let i = 0; i < nodes.length - 1; i++) {
        const source = nodes[i];
        const target = nodes[i + 1];
        const edgeId = `${source}->${target}`;
        
        // Calculate duration from timings (difference between consecutive timestamps)
        if (variant.Avg_Timings && variant.Avg_Timings.length > i + 1) {
          const duration = variant.Avg_Timings[i + 1] - variant.Avg_Timings[i];
          
          if (!edgeStats[edgeId]) {
            edgeStats[edgeId] = { sum: 0, count: 0 };
          }
          edgeStats[edgeId].sum += duration;
          edgeStats[edgeId].count += 1;
        }
      }
      
      // Calculate specific durations (average per edge)
      const specificEdgeDurations: Record<string, number> = {};
      Object.keys(edgeStats).forEach((edgeId) => {
        const stat = edgeStats[edgeId];
        specificEdgeDurations[edgeId] = stat.sum / stat.count;
      });
      
      // Calculate total durations (sum per edge)
      const specificTotalDurations: Record<string, number> = {};
      Object.keys(edgeStats).forEach((edgeId) => {
        specificTotalDurations[edgeId] = edgeStats[edgeId].sum;
      });
      
      // Calculate edge counts
      const specificEdgeCounts: Record<string, number> = {};
      Object.keys(edgeStats).forEach((edgeId) => {
        specificEdgeCounts[edgeId] = edgeStats[edgeId].count;
      });
      
      const edges = Object.keys(specificEdgeDurations);

      const totalPathDuration =
        variant.Avg_Timings && variant.Avg_Timings.length > 0
          ? variant.Avg_Timings[variant.Avg_Timings.length - 1] - variant.Avg_Timings[0]
          : 0;

      const pathData: ExtendedPath = {
        nodes: nodes,
        edges: edges,
        totalDuration: totalPathDuration,
        _startIndex: 0,
        _endIndex: nodes.length - 1,
        _fullPathNodes: nodes,
        _frequency: variant.Frequency,
        _variantTimings: variant.Avg_Timings,
        _pathType: "absolute",
        _specificEdgeDurations: specificEdgeDurations,
        _specificTotalDurations: specificTotalDurations,
        _specificEdgeCounts: specificEdgeCounts,
      };

      return pathData;
    });

    // Sort by frequency: lowest to highest (outliers have low frequency)
    return mappedPaths.sort((a, b) => {
      const freqA = a._frequency || 0;
      const freqB = b._frequency || 0;
      return freqA - freqB; // Ascending order
    });
  }, [outliers]);

  // --- Handle path selection ---
  const handleSelectPath = useCallback(
    (path: Path, index: number) => {
      const extPath = path as ExtendedPath;
      
      graphStore.setActivePath(extPath);
      setSelectedPathNodes(new Set(extPath.nodes));
      setSelectedPathEdges(new Set(extPath.edges));
      setSelectedPathIndex(index);

      const activePathInfo = {
        nodes: extPath.nodes,
        edges: extPath.edges,
        edgeDurations: extPath._specificEdgeDurations || {},
        edgeTotalDurations: extPath._specificTotalDurations || {},
        edgeCounts: extPath._specificEdgeCounts || {},
        frequency: extPath._frequency || 1,
      };

      if (graphData && startEndNodes) {
        graphStore.computeLayout({
          graphData: graphData,
          colorPaletteKey: selectedColorPalette,
          startEndNodes: startEndNodes,
          filteredNodeIds: new Set(extPath.nodes),
          filteredEdgeIds: new Set(extPath.edges),
          activePathInfo,
          searchCasePathInfo: undefined,
        });
      }
    },
    [graphStore, setSelectedPathNodes, setSelectedPathEdges, setSelectedPathIndex, graphData, startEndNodes, selectedColorPalette]
  );

  return (
    <div className="flex flex-col h-full gap-3 p-1">
      {/* --- Header Stats --- */}
      {/* <div className="bg-gradient-to-l from-amber-50 to-orange-50 border border-amber-100 rounded-2xl p-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600">
              <TrendingDown size={18} />
            </div>
          </div>
          <Chip 
            size="sm" 
            variant="flat" 
            className="bg-amber-100/80 text-amber-700 font-bold"
            startContent={<BarChart3 size={12} />}
          >
            {sortedPaths.length} مسیر پرت
          </Chip>
        </div>
      </div> */}

      {/* --- Content Area --- */}
      <div className="flex-1 min-h-0 relative overflow-hidden bg-white rounded-xl border border-slate-100">
        {sortedPaths.length > 0 ? (
          <ScrollShadow className="h-full p-2">
            <PathList
              paths={sortedPaths}
              allNodes={allNodes}
              selectedIndex={selectedPathIndex}
              onSelectPath={handleSelectPath}
              emptyMessage=""
              groupByType={false}
            />
          </ScrollShadow>
        ) : (
          // Empty state
          <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-1 border border-slate-100">
              <Activity size={32} className="text-slate-300" />
            </div>
            <h4 className="text-slate-700 font-bold text-sm">واریانتی یافت نشد</h4>
            <p className="text-slate-400 text-xs max-w-[200px] leading-5">
              برای مشاهده واریانت‌ها ابتدا فیلترها را اعمال کنید.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}