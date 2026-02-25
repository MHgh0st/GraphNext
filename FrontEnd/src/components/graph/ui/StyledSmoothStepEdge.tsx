import {
  getSmoothStepPath,
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
} from "@xyflow/react";
import type { CSSProperties } from "react";

// CSS keyframe for highlighted path flow animation
const HIGHLIGHT_ANIMATION_STYLE = `
  @keyframes pathEdgeFlow {
    to { stroke-dashoffset: -24; }
  }
`;

if (typeof document !== 'undefined') {
  const styleId = 'path-edge-highlight-styles';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = HIGHLIGHT_ANIMATION_STYLE;
    document.head.appendChild(styleEl);
  }
}

// کامپوننت لیبل (بدون تغییر)
const CustomEdgeLabel = ({
  text,
  style,
}: {
  text: string;
  style?: CSSProperties;
}) => (
  <div
    style={{
      ...style,
      pointerEvents: "all",
      position: "absolute",
    }}
    className="nodrag nopan flex items-center justify-center hover:z-50 z-10 hover:z-[1000]"
  >
    <div 
      className="
        px-2 py-1 
        bg-zinc-900/90 backdrop-blur-sm 
        border border-zinc-700/50 
        text-zinc-300 text-[10px] 
        rounded-lg shadow-lg 
          tracking-tighter 
        cursor-pointer 
        transition-transform duration-200 ease-out
        hover:scale-125 hover:bg-zinc-800 hover:text-white hover:border-zinc-500
      "
    >
      {text}
    </div>
  </div>
);

export const StyledSmoothStepEdge = (props: EdgeProps) => {
  const {
    id,
    data,
    label,
    style,
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    markerEnd,
    animated, // <--- دریافت پراپرتی انیمیشن
  } = props;

  const { onEdgeSelect } = data || {};
  // تشخیص یال موقت
  const isGhost = data?.isGhost === true;
  const isSelfLoop = source === target;

  let edgePath: string;
  let labelX: number;
  let labelY: number;

  if (isSelfLoop) {
    // --- 🔄 منطق رسم حلقه (Self Loop) ---
    const loopHeight = 60;
    const loopWidthOffset = 30;
    const cornerRadius = 10;

    const sX = sourceX;
    const sY = sourceY;
    const tX = targetX;
    const tY = targetY;

    const topY = Math.min(sY, tY) - loopHeight;

    edgePath = `
      M ${sX} ${sY}
      L ${sX + loopWidthOffset} ${sY}
      Q ${sX + loopWidthOffset + cornerRadius} ${sY} ${sX + loopWidthOffset + cornerRadius} ${sY - cornerRadius}
      L ${sX + loopWidthOffset + cornerRadius} ${topY + cornerRadius}
      Q ${sX + loopWidthOffset + cornerRadius} ${topY} ${sX + loopWidthOffset} ${topY}
      L ${tX - loopWidthOffset} ${topY}
      Q ${tX - loopWidthOffset - cornerRadius} ${topY} ${tX - loopWidthOffset - cornerRadius} ${topY + cornerRadius}
      L ${tX - loopWidthOffset - cornerRadius} ${tY - cornerRadius}
      Q ${tX - loopWidthOffset - cornerRadius} ${tY} ${tX - loopWidthOffset} ${tY}
      L ${tX} ${tY}
    `;

    labelX = (sX + tX) / 2;
    labelY = topY;
    
  } else {
    // --- ➡️ منطق یال‌های معمولی ---
    const [path, lx, ly] = getSmoothStepPath(props);
    edgePath = path;
    labelX = lx;
    labelY = ly;
  }

  const handleClick = () => {
    if (onEdgeSelect && typeof onEdgeSelect === "function") {
      onEdgeSelect(id);
    }
  };

  // تنظیمات نهایی استایل
  const isHighlighted = data?._highlighted === true;
  const edgeStyle: CSSProperties = {
    ...style,
    // برای ghost ها، اگر stroke از والد پاس داده شده (مثلا رنگ انتخاب) استفاده کن، وگرنه خاکستری
    stroke: isGhost 
      ? (style?.stroke || "#949494ff") 
      : (style?.stroke || "#52525b"),
    strokeWidth: style?.strokeWidth || 1.5,
    fill: "none",
    // اگر گوست است، حتما خط‌چین باشد، وگرنه از استایل والد بگیرد
    strokeDasharray: isGhost ? "5, 5" : (isHighlighted ? "8 4" : style?.strokeDasharray),
    ...(isHighlighted ? {
      animation: 'pathEdgeFlow 0.5s linear infinite',
      strokeDashoffset: 0,
    } : {}),
  };

  return (
    <>
      {/* ناحیه نامرئی برای کلیک راحت‌تر (Hit Area) */}
      <BaseEdge
        path={edgePath}
        style={{ strokeWidth: 20, stroke: "transparent", cursor: "pointer", fill: "none" }}
        onClick={handleClick}
      />
      
      {/* خط اصلی */}
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={edgeStyle}
        // اگر animated true باشد، کلاس استاندارد react-flow را اضافه می‌کنیم
        // این کلاس مسئول حرکت دادن خط‌چین‌هاست
        className={animated ? "react-flow__edge-path" : ""}
      />
      
      {/* لیبل */}
      {label && (
        <EdgeLabelRenderer>
          <CustomEdgeLabel
            text={label as string}
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          />
        </EdgeLabelRenderer>
      )}
    </>
  );
};