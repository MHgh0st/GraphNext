import { PaletteOption } from "../../../types/types";
import { CheckCircle2 } from "lucide-react";

interface ColorPaletteCardProps {
  options: PaletteOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export default function ColorPaletteCard({
  options,
  value,
  onChange,
  className,
}: ColorPaletteCardProps) {
  return (
    <div role="radiogroup" className={`w-full flex flex-col gap-3 ${className || ""}`}>
      {options.map((option) => {
        const isSelected = option.key === value;
        
        return (
          <div
            key={option.key}
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(option.key)}
            className={`
              group relative flex items-center justify-between p-3 rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden
              ${
                isSelected
                  ? "border-blue-500 bg-blue-50/50 shadow-sm ring-1 ring-blue-500/20"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
              }
            `}
          >
            <div className="flex flex-col gap-1.5 flex-1 z-10">
                <div className="flex items-center gap-2">
                    {/* آیکون تیک برای حالت انتخاب شده */}
                    <div className={`
                        transition-all duration-300 ease-out
                        ${isSelected ? "opacity-100 scale-100 text-blue-600" : "opacity-0 scale-50 w-0"}
                    `}>
                        <CheckCircle2 size={18} fill="currentColor" className="text-white" />
                    </div>
                    
                    <span className={`text-sm font-bold transition-colors ${isSelected ? "text-blue-700" : "text-slate-700"}`}>
                        {option.label}
                    </span>
                </div>

                {/* نوار نمایش گرادیان */}
                <div 
                    className="h-4 w-full rounded-md border border-black/5 shadow-inner" 
                    style={{ background: option.gradient }} 
                />
            </div>

            {/* افکت نوری پس‌زمینه هنگام هاور */}
            {!isSelected && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-slate-100/50 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 pointer-events-none" />
            )}
          </div>
        );
      })}
    </div>
  );
}