import { memo } from "react";
import { Handle, Position, NodeProps } from "@xyflow/react";
import { Play, Flag, Activity, Clock } from "lucide-react"; // آیکون‌های مدرن

const CustomNode = ({ data, selected }: NodeProps) => {
  const type = data.type as string;
  const label = data.label as string;
  // فرض می‌کنیم frequency یا duration هم ممکن است در دیتا باشد (اختیاری)
  const subLabel = data.subLabel as string; 

  // تنظیمات استایل بر اساس نوع گره
  const getNodeStyles = () => {
    switch (type) {
      case "start":
        return {
          wrapper: "from-emerald-500/20 to-emerald-900/10 border-emerald-500/50 shadow-emerald-500/20",
          icon: <Play size={18} className="text-emerald-400 fill-emerald-400/20" />,
          badge: "bg-emerald-500/20 text-emerald-300",
        };
      case "end":
        return {
          wrapper: "from-rose-500/20 to-rose-900/10 border-rose-500/50 shadow-rose-500/20",
          icon: <Flag size={18} className="text-rose-400 fill-rose-400/20" />,
          badge: "bg-rose-500/20 text-rose-300",
        };
      default: // activity
        return {
          wrapper: "from-blue-500/20 to-blue-900/10 border-blue-500/40 shadow-blue-500/10",
          icon: <Activity size={18} className="text-blue-400" />,
          badge: "bg-blue-500/20 text-blue-300",
        };
    }
  };

  const styles = getNodeStyles();
  const isSelectedClass = selected ? "ring-2 ring-offset-2 ring-offset-black ring-white/50 scale-105" : "";

  return (
    <div
      className={`
        relative group px-4 py-3 rounded-xl 
        bg-gradient-to-br backdrop-blur-md border 
        transition-all duration-300 ease-out
        hover:shadow-lg hover:-translate-y-1
        flex flex-col gap-2 
        ${styles.wrapper}
        ${isSelectedClass}
      `}
      style={{ width: 'fit-content' }}
    >
      {/* هندل‌های اتصال (نامرئی اما فعال) */}
      <Handle type="target" position={Position.Left} className="!bg-transparent !border-0" />
      
      {/* هدر نود: آیکون و لیبل */}
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${styles.badge} shadow-inner shrink-0`}>
            {styles.icon}
        </div>
        <div className="flex flex-col text-right">
          <span className="text-sm font-bold text-blue-400 text-right whitespace-nowrap" title={label}>
            {label}
          </span>
          <span className="text-[10px] text-blue-400/60 font-vazir">
            {type === 'start' ? 'شروع فرآیند' : type === 'end' ? 'پایان فرآیند' : 'فعالیت'}
          </span>
        </div>
      </div>

      {/* بخش اطلاعات اضافی (اگر وجود داشته باشد) */}
      {subLabel && (
        <div className="flex items-center gap-1 mt-1 pt-2 border-t border-white/5">
          <Clock size={12} className="text-white/40" />
          <span className="text-[10px] text-white/60 font-mono">{subLabel}</span>
        </div>
      )}

      <Handle type="source" position={Position.Right} className="!bg-transparent !border-0" />
    </div>
  );
};

export default memo(CustomNode);