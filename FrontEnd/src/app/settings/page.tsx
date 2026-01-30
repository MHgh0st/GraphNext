'use client';

/**
 * @page SettingsPage
 * @module app/settings/page
 *
 * @description
 * Settings page for graph visualization customization.
 * Provides color palette selection and other graph settings.
 */

import { useCallback } from "react";
import { Divider } from "@heroui/divider";
import { PaintBucket } from "lucide-react";

import ColorPaletteCard from "@/components/sideBarCards/ColorPaletteCard";
import { paletteOptions } from "@/constants/colorPalettes";
import { useAppStore } from "@/hooks/useAppStore";
import { useGraphStore } from "@/store/useGraphStore";

export default function SettingsPage() {
  // --- Global Stores ---
  const {
    selectedColorPalette,
    setSelectedColorPalette,
    graphData,
    startEndNodes,
    selectedNodeIds,
  } = useAppStore();

  const graphStore = useGraphStore();

  // --- Handle palette change ---
  const handlePaletteChange = useCallback(
    (newPalette: string) => {
      setSelectedColorPalette(newPalette);

      // Recompute layout with new color palette
      if (graphData && startEndNodes) {
        graphStore.computeLayout({
          graphData: graphData,
          colorPaletteKey: newPalette,
          startEndNodes: startEndNodes,
          filteredNodeIds: selectedNodeIds,
          filteredEdgeIds: null,
          activePathInfo: undefined,
          searchCasePathInfo: undefined,
        });
      }
    },
    [setSelectedColorPalette, graphStore, graphData, startEndNodes, selectedNodeIds]
  );

  return (
    <div className="flex flex-col gap-y-6 h-full p-1">
      {/* بخش انتخاب رنگ */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <div className="p-2 bg-purple-50 text-purple-600 rounded-lg">
            <PaintBucket size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800">طیف رنگی نمودار</h3>
            <p className="text-xs text-slate-500">رنگ‌بندی یال‌ها و گره‌ها را تغییر دهید</p>
          </div>
        </div>

        <ColorPaletteCard
          options={paletteOptions}
          value={selectedColorPalette}
          onChange={handlePaletteChange}
        />
      </section>

      <Divider className="bg-slate-100" />

      {/* تنظیمات آینده می‌توانند اینجا اضافه شوند */}
    </div>
  );
}