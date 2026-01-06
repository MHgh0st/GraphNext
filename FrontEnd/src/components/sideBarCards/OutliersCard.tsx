/**
 * @component OutliersCard
 * @module components/sideBarCards/OutliersCard
 *
 * @description
 * Sidebar card for outlier analysis.
 * Displays statistically detected outlier paths (unusual process variants)
 * filtered by the currently selected nodes.
 *
 * @example
 * ```tsx
 * <OutliersCard
 *   outliers={outlierVariants}
 *   allNodes={nodes}
 *   selectedNodeIds={selectedIds}
 *   onSelectOutlier={handleOutlierSelect}
 * />
 * ```
 */

import { useMemo, useCallback, memo } from "react";
import { Node } from "@xyflow/react";
import { Chip } from "@heroui/chip";
import { ScrollShadow } from "@heroui/scroll-shadow";
import {
  RouteOff,
  AlertOctagon,
  Filter,
  MousePointerClick,
  Activity,
} from "lucide-react";

import type { Variant, Path, ExtendedPath } from "../../types/types";
import { PathList } from "./PathList";


interface OutliersCardProps {
  outliers: Variant[] | null;
  allNodes: Node[];
  selectedNodeIds: Set<string>;
  selectedIndex: number | null;
  onSelectOutlier: (outlierPath: Path, index: number) => void;
}

export default function OutliersCard({
  outliers,
  allNodes,
  selectedNodeIds,
  selectedIndex,
  onSelectOutlier,
}: OutliersCardProps) {

  // --- 1. منطق محاسباتی (مستقل از فیلترها) ---
  // تب تحلیل ناهنجاری‌ها کاملاً مستقل از گره‌های انتخاب شده در فیلترها کار می‌کند
  const convertedPaths = useMemo<Path[]>(() => {
    if (!outliers) return [];

    // نمایش تمام ناهنجاری‌ها بدون فیلتر selectedNodeIds
    const filteredOutliers = outliers;

    // گام دوم: تبدیل به Path
    const mappedPaths = filteredOutliers.map((variant) => {
      const edges: string[] = [];
      const nodes = variant.Variant_Path;

      // محاسبه _specificEdgeDurations برای نمایش لیبل روی یال‌های ghost
      const specificEdgeDurations: Record<string, number> = {};

      for (let i = 0; i < nodes.length - 1; i++) {
        const source = nodes[i];
        const target = nodes[i + 1];
        const edgeId = `${source}->${target}`;
        edges.push(edgeId);

        // محاسبه duration هر یال از تفاوت تایمینگ‌ها
        if (variant.Avg_Timings.length > i + 1) {
          const duration = variant.Avg_Timings[i + 1] - variant.Avg_Timings[i];
          specificEdgeDurations[edgeId] = duration;
        }
      }

      const meanPathDuration =
        variant.Avg_Timings.length > 0
          ? variant.Avg_Timings[variant.Avg_Timings.length - 1] -
            variant.Avg_Timings[0]
          : 0;

      const pathData: ExtendedPath = {
        nodes: nodes,
        edges: edges,
        averageDuration: meanPathDuration,
        _startIndex: 0,
        _endIndex: nodes.length - 1,
        _fullPathNodes: nodes,
        _frequency: variant.Frequency,
        _variantTimings: variant.Avg_Timings,
        _pathType: "absolute",
        _specificEdgeDurations: specificEdgeDurations, // اضافه کردن duration هر یال
      };

      return pathData;
    });


    // گام سوم: مرتب‌سازی
    return mappedPaths.sort((a, b) => {
      const pathA = a as ExtendedPath;
      const pathB = b as ExtendedPath;

      const freqA = pathA._frequency || 0;
      const freqB = pathB._frequency || 0;

      if (freqB !== freqA) {
        return freqB - freqA;
      }

      const durA = pathA.averageDuration || 0;
      const durB = pathB.averageDuration || 0;
      return durB - durA;
    });
  }, [outliers, selectedNodeIds]);

  const handleSelectPathWrapper = (path: Path, index: number) => {
    onSelectOutlier(path, index);
  };

  return (
    <div className="flex flex-col h-full gap-4">
      {/* --- Header --- */}
      {/* <div className="flex items-center justify-between px-1 shrink-0">
        <div className="flex items-center gap-2 text-slate-700">
            <div className="p-1.5 bg-rose-50 text-rose-500 rounded-lg">
                <RouteOff size={18} />
            </div>
            <div>
                <h3 className="font-bold text-sm text-slate-800">تحلیل ناهنجاری‌ها</h3>
                <span className="text-[10px] text-slate-400 block">مسیرهای پرت (Outliers)</span>
            </div>
        </div>
        
        {outliers && (
            <Chip size="sm" variant="flat" className="bg-slate-100 text-slate-500 text-[10px] h-6">
                کل موارد: {outliers.length}
            </Chip>
        )}
      </div> */}

      {/* --- Status Bar / Info --- */}
      {/* نمایش تعداد ناهنجاری‌ها */}
      <div className="flex items-center justify-between p-3 bg-rose-50/50 border border-rose-100 rounded-xl shrink-0">
          <div className="flex items-center gap-2">
              <Filter size={14} className="text-rose-400" />
              <span className="text-xs font-bold text-rose-700">
                  {convertedPaths.length} مورد یافت شد
              </span>
          </div>
      </div>

      {/* --- Content Area --- */}
      <div className="flex-1 min-h-0 relative overflow-hidden bg-white rounded-xl border border-slate-100">
        {convertedPaths.length > 0 ? (
            <ScrollShadow className="h-full p-2">
                <PathList
                    paths={convertedPaths}
                    allNodes={allNodes}
                    selectedIndex={selectedIndex}
                    onSelectPath={handleSelectPathWrapper}
                    emptyMessage="" 
                    groupByType={false}
                />
            </ScrollShadow>
        ) : (
            // حالت: ناهنجاری پیدا نشد
            <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
                <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-1">
                    <Activity size={32} className="text-emerald-400" />
                </div>
                <h4 className="text-slate-700 font-bold text-sm">همه چیز طبیعی است!</h4>
                <p className="text-slate-400 text-xs max-w-[200px] leading-5">
                    هیچ مسیر پرت یا ناهنجاری (Outlier) یافت نشد.
                </p>
            </div>
        )}
      </div>
    </div>
  );
}