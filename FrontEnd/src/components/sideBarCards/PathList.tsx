import { Node } from "@xyflow/react";
import { Button } from "@heroui/button";
import { Accordion, AccordionItem } from "@heroui/accordion";
import { Tooltip } from "@heroui/tooltip";
import { Monitor, X, ChevronDown, Activity, Clock } from "lucide-react";
import { Chip } from "@heroui/chip";
import { useMemo, useState, memo } from "react";
import type { Path, ExtendedPath } from "../../types/types";

// --- 1. کامپوننت محتوای داخلی (Memo شده) ---
// با استایل Timeline مدرن
interface PathNodesListProps {
  path: Path;
  allNodes: Node[];
}

const PathNodesList = memo(({ path, allNodes }: PathNodesListProps) => {
  const getNodeLabel = (id: string) => allNodes.find((n) => n.id === id)?.data?.label || id;
  const extPath = path as ExtendedPath;
  const nodesToShow = extPath._fullPathNodes || path.nodes;
  const startIdx = extPath._startIndex ?? 0;
  const endIdx = extPath._endIndex ?? nodesToShow.length - 1;

  return (
    <div className="relative flex flex-col gap-0 pt-2 pb-1 pr-4">
      {/* خط راهنما (Timeline Line) */}
      <div className="absolute top-4 bottom-4 right-[1.65rem] w-0.5 bg-slate-200" />

      {nodesToShow.map((id, i) => {
        const isStart = i === startIdx;
        const isEnd = i === endIdx;
        const isInPath = i > startIdx && i < endIdx;
        const isOutside = i < startIdx || i > endIdx;

        return (
          <div 
            key={i} 
            className={`
                relative flex items-center gap-3 py-1.5 transition-opacity
                ${isOutside ? "opacity-40 grayscale" : "opacity-100"}
            `}
          >
            {/* دایره شماره گذاری */}
            <div className={`
                relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2
                ${isStart 
                    ? "bg-emerald-50 border-emerald-500 text-emerald-600" 
                    : isEnd 
                        ? "bg-rose-50 border-rose-500 text-rose-600" 
                        : isInPath 
                            ? "bg-blue-50 border-blue-400 text-blue-600" 
                            : "bg-slate-50 border-slate-300 text-slate-400"
                }
            `}>
                {i + 1}
            </div>

            <div className="flex items-center gap-2 flex-1">
                <span
                className={`
                    text-xs font-vazir
                    ${isStart ? "font-bold text-emerald-700" : ""}
                    ${isEnd ? "font-bold text-rose-700" : ""}
                    ${isInPath ? "text-slate-700 font-medium" : ""}
                    ${isOutside ? "text-slate-400" : ""}
                    `}
                >
                {getNodeLabel(id)}
                </span>

                {isStart && (
                <Chip size="sm" color="success" variant="flat" className="h-5 text-[10px] px-1 bg-emerald-100 text-emerald-700 border border-emerald-200">
                    شروع
                </Chip>
                )}
                {isEnd && (
                <Chip size="sm" color="danger" variant="flat" className="h-5 text-[10px] px-1 bg-rose-100 text-rose-700 border border-rose-200">
                    پایان
                </Chip>
                )}
            </div>
          </div>
        );
      })}
    </div>
  );
});

// --- 2. کامپوننت اصلی ---

interface PathListComponentProps {
  paths: Path[];
  allNodes: Node[];
  selectedIndex: number | null;
  onSelectPath: (path: Path, index: number) => void;
  onRemovePath?: (index: number) => void;
  className?: string;
  emptyMessage?: string;
  groupByType?: boolean;
}

export const PathList = ({
  paths,
  allNodes,
  selectedIndex,
  onSelectPath,
  onRemovePath,
  className = "",
  emptyMessage = "هیچ مسیری یافت نشد.",
  groupByType = false,
}: PathListComponentProps) => {
  
  // استیت برای Load More
  const [itemsToShow, setItemsToShow] = useState<Record<string, number>>({
    absolute: 20,
    relative: 20,
    others: 20,
    all: 20,
  });

  const handleLoadMore = (key: string) => {
    setItemsToShow((prev) => ({ ...prev, [key]: prev[key] + 50 }));
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds.toFixed(0)} ثانیه`;
    if (seconds < 3600) return `${(seconds / 60).toFixed(1)} دقیقه`;
    if (seconds < 86400) return `${(seconds / 3600).toFixed(1)} ساعت`;
    return `${(seconds / 86400).toFixed(2)} روز`;
  };

  const { absolutePaths, relativePaths, otherPaths } = useMemo(() => {
    if (!groupByType) return { absolutePaths: [], relativePaths: [], otherPaths: paths };

    const absolute: Path[] = [];
    const relative: Path[] = [];
    const others: Path[] = [];

    paths.forEach((path) => {
      const extPath = path as ExtendedPath;
      if (extPath._pathType === "absolute") absolute.push(path);
      else if (extPath._pathType === "relative") relative.push(path);
      else others.push(path);
    });

    return { absolutePaths: absolute, relativePaths: relative, otherPaths: others };
  }, [paths, groupByType]);

  // تابع رندر
  const renderPathItems = (pathList: Path[], listKey: string) => {
    if (pathList.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-6 text-slate-400 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <span className="text-xs">{emptyMessage}</span>
        </div>
      );
    }

    const visibleCount = itemsToShow[listKey] || 20;
    const visibleItems = pathList.slice(0, visibleCount);
    const hasMore = pathList.length > visibleCount;

    return (
      <div className="flex flex-col gap-2">
        <Accordion 
            className="p-0 flex flex-col gap-2" 
            itemClasses={{
                base: "group rounded-xl border border-transparent data-[open=true]:border-slate-200 bg-white transition-all shadow-sm hover:shadow-md",
                trigger: "py-3 px-3",
                title: "text-right text-sm font-bold text-slate-700",
                subtitle: "text-right text-xs text-slate-400",
                content: "pb-3 pt-0 px-2",
                indicator: "text-slate-400"
            }}
        >
          {visibleItems.map((path) => {
            const globalIndex = paths.indexOf(path);
            const extPath = path as ExtendedPath;
            const isSelected = selectedIndex === globalIndex;

            return (
              <AccordionItem
                key={globalIndex}
                aria-label={`path-${globalIndex}`}
                title={
                    <div className="flex items-center gap-2">
                         <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-blue-500 animate-pulse" : "bg-slate-300"}`} />
                         <span>مسیر {globalIndex + 1}</span>
                         {extPath._frequency && (
                             <Chip size="sm" variant="flat" className="bg-slate-100 text-slate-500 border border-slate-200 h-5 text-[10px] px-1">
                                {extPath._frequency} تکرار
                             </Chip>
                         )}
                    </div>
                }
                subtitle={
                    <div className="flex items-center gap-1 mt-1 text-[10px]">
                        <Clock size={10} />
                        <span>{formatDuration(path.totalDuration || 0)}</span>
                    </div>
                }
                startContent={
                  <div className="flex items-center gap-1 pl-2 border-r border-slate-100 mr-2 pr-2">
                     <div onClick={(e) => e.stopPropagation()}>
                      <Tooltip content={isSelected ? "مسیر فعلی" : "مشاهده روی گراف"} showArrow color="primary" className="text-xs">
                        <Button
                          isIconOnly
                          size="sm"
                          // اگر انتخاب شده است، رنگ آبی وگرنه طوسی
                          className={`min-w-7 w-7 h-7 rounded-lg transition-colors ${
                              isSelected 
                              ? "bg-blue-100 text-blue-600 shadow-[0_0_10px_-3px_rgba(59,130,246,0.5)]" 
                              : "bg-slate-100 text-slate-400 hover:bg-blue-50 hover:text-blue-500"
                          }`}
                          onPress={() => onSelectPath(path, globalIndex)}
                        >
                          {isSelected ? <Activity size={16} /> : <Monitor size={16} />}
                        </Button>
                      </Tooltip>
                    </div>

                    {onRemovePath && (
                      <Tooltip content="حذف" showArrow color="danger" className="text-xs">
                        <Button
                          isIconOnly
                          variant="light"
                          color="danger"
                          size="sm"
                          className="min-w-7 w-7 h-7 rounded-lg text-slate-300 hover:bg-rose-50 hover:text-rose-500"
                          onPress={() => onRemovePath(globalIndex)}
                        >
                          <X size={16} />
                        </Button>
                      </Tooltip>
                    )}
                  </div>
                }
                // استایل‌دهی شرطی برای آیتم انتخاب شده
                className={`
                    ${isSelected 
                        ? "ring-1 ring-blue-500/30 bg-blue-50/30 border-blue-200" 
                        : "bg-white border-slate-200"
                    }
                `}
              >
                <div className="bg-slate-50/50 rounded-lg border border-slate-100 mt-2">
                    {/* استفاده از کامپوننت Memo شده */}
                    <PathNodesList path={path} allNodes={allNodes} />
                </div>
              </AccordionItem>
            );
          })}
        </Accordion>

        {hasMore && (
          <Button
            variant="flat"
            size="sm"
            className="self-center mt-2 w-full max-w-[200px] bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-xl"
            onPress={() => handleLoadMore(listKey)}
            endContent={<ChevronDown size={16} />}
          >
            نمایش {Math.min(50, pathList.length - visibleCount)} مورد بیشتر
          </Button>
        )}
      </div>
    );
  };

  return (
    <div className={`w-full ${className}`}>
      {groupByType ? (
        <Accordion 
            selectionMode="multiple" 
            defaultExpandedKeys={["absolute"]}
            itemClasses={{
                base: "mb-2", // فاصله بین گروه‌ها
                trigger: "px-0 py-2",
                title: "text-sm font-bold text-slate-800",
                indicator: "text-slate-400",
                content: "py-2"
            }}
        >
          <AccordionItem 
            key="absolute" 
            title={
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    مسیرهای کامل ({absolutePaths.length.toLocaleString()})
                </div>
            }
          >
            {renderPathItems(absolutePaths, "absolute")}
          </AccordionItem>

          <AccordionItem 
            key="relative" 
            title={
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    مسیرهای نسبی ({relativePaths.length.toLocaleString()})
                </div>
            }
          >
            {renderPathItems(relativePaths, "relative")}
          </AccordionItem>

          {otherPaths.length > 0 && (
            <AccordionItem 
                key="others" 
                title={
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-slate-400" />
                        سایر مسیرها ({otherPaths.length.toLocaleString()})
                    </div>
                }
            >
              {renderPathItems(otherPaths, "others")}
            </AccordionItem>
          )}
        </Accordion>
      ) : (
        renderPathItems(paths, "all")
      )}
    </div>
  );
};