/**
 * @component SettingsCard
 * @module components/sideBarCards/SettingsCard
 *
 * @description
 * Settings card for the sidebar.
 * Provides graph visualization settings including color palette selection.
 *
 * @example
 * ```tsx
 * <SettingsCard
 *   ColorPaletteProps={{
 *     options: paletteOptions,
 *     value: selectedPalette,
 *     onChange: handlePaletteChange,
 *   }}
 * />
 * ```
 */

import { memo } from "react";
import { Divider } from "@heroui/divider";
import { PaintBucket } from "lucide-react";

import type { PaletteOption } from "../../types/types";
import ColorPaletteCard from "./ColorPaletteCard";

interface Props {
  ColorPaletteProps: {
    options: PaletteOption[];
    value: string;
    onChange: (value: string) => void;
    className?: string;
  };
  className?: string;
}

export default function SettingsCard({ ColorPaletteProps, className }: Props) {
  return (
    <div className={`flex flex-col gap-y-6 h-full ${className}`}>
        
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
          options={ColorPaletteProps.options}
          value={ColorPaletteProps.value}
          onChange={ColorPaletteProps.onChange}
          className={ColorPaletteProps.className}
        />
      </section>

      <Divider className="bg-slate-100" />

      {/* اینجا می‌توانید تنظیمات آینده را اضافه کنید */}
      {/* <section className="space-y-4 opacity-50 grayscale select-none pointer-events-none">
         <div className="flex items-center gap-2 px-1">
            <div className="p-2 bg-orange-50 text-orange-600 rounded-lg">
                <Sliders size={20} />
            </div>
            <div>
                <h3 className="text-sm font-bold text-slate-800">تنظیمات پیشرفته</h3>
                <p className="text-xs text-slate-500">ضخامت خطوط و اندازه فونت‌ها</p>
            </div>
         </div>
      </section> */}

    </div>
  );
}