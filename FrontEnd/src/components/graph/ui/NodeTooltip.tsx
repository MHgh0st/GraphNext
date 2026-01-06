import { useMemo } from "react";
import { CardHeader, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Tooltip } from "@heroui/tooltip";
import { Chip } from "@heroui/chip";
import { Accordion, AccordionItem } from "@heroui/accordion";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { 
  X, 
  Monitor, 
  ArrowRightFromLine, 
  ArrowLeftToLine, 
  Activity,
  Network,
  Hash,
  CheckCircle2 // آیکون برای حالت انتخاب شده
} from "lucide-react"; 
import type { NodeTooltipType } from "src/types/types";

// --- کامپوننت نمایش دهنده هر ردیف یال ---
interface EdgeRowProps {
  item: NodeTooltipType;
  isSelected: boolean; // پراپرتی جدید برای تشخیص انتخاب
  onEdgeSelect: (edgeId: string) => void;
}

const EdgeRow = ({ item, isSelected, onEdgeSelect }: EdgeRowProps) => {
  const isIncoming = item.direction === "incoming";
  
  return (
    <div 
      className={`
        group relative flex items-center justify-between p-3 mb-2 rounded-2xl border transition-all duration-300 cursor-pointer
        ${isSelected 
            ? "bg-blue-50/90 border-blue-400 shadow-md shadow-blue-500/10 ring-1 ring-blue-400/20" // استایل حالت انتخاب شده
            : "bg-white/60 border-slate-100 hover:border-blue-300 hover:bg-white/90 hover:shadow-sm" // استایل حالت عادی
        }
      `}
      onClick={() => onEdgeSelect(item.edgeId)}
    >
      {/* نوار رنگی سمت راست برای تاکید روی آیتم انتخاب شده */}
      {isSelected && (
        <div className="absolute right-0 top-3 bottom-3 w-1 bg-blue-500 rounded-l-full" />
      )}

      <div className="flex items-center gap-3 overflow-hidden">
        {/* آیکون جهت دار */}
        <div className={`
            p-2.5 rounded-xl shrink-0 transition-all duration-300
            ${isSelected
                ? "bg-white shadow-sm ring-1 ring-black/5" // در حالت انتخاب، آیکون برجسته‌تر می‌شود
                : isIncoming 
                    ? "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100" 
                    : "bg-rose-50 text-rose-600 group-hover:bg-rose-100"
            }
        `}>
           {isSelected ? (
               // اگر انتخاب شده باشد، رنگ آیکون با تم انتخاب ست می‌شود
               isIncoming ? <ArrowLeftToLine size={16} className="text-emerald-600" /> : <ArrowRightFromLine size={16} className="text-rose-600" />
           ) : (
               isIncoming ? <ArrowLeftToLine size={16} /> : <ArrowRightFromLine size={16} />
           )}
        </div>

        <div className="flex flex-col min-w-0 pr-1">
          <div className="flex items-center gap-2">
              <span className={`text-[10px] font-medium transition-colors ${isSelected ? "text-blue-600" : "text-slate-400"}`}>
                {isIncoming ? "دریافت از:" : "ارسال به:"}
              </span>
              {isSelected && <CheckCircle2 size={10} className="text-blue-500" />}
          </div>
          <span className={`text-xs font-bold truncate font-vazir transition-colors ${isSelected ? "text-slate-900" : "text-slate-700"}`} title={item.label}>
            {item.label} 
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 pl-1">
        {/* نمایش وزن یا تعداد */}
        {item.weight !== "N/A" && (
          <Chip 
            size="sm" 
            variant="flat" 
            classNames={{
                base: `h-6 px-1 border transition-colors ${isSelected ? "bg-white border-blue-200" : "bg-slate-100 border-slate-200"}`,
                content: "text-[10px] font-mono font-bold text-slate-600 flex items-center gap-1"
            }}
          >
            <Hash size={10} className={isSelected ? "text-blue-400" : "text-slate-400"} />
            {item.weight}
          </Chip>
        )}

        <div>
            <Tooltip content={isSelected ? "در حال نمایش" : "انتخاب یال"} showArrow color="primary" className="text-xs font-vazir">
            <Button
                isIconOnly
                size="sm"
                variant={isSelected ? "solid" : "light"}
                color={isSelected ? "primary" : "default"}
                onPress={() => onEdgeSelect(item.edgeId)}
                className={`
                    min-w-8 w-8 h-8 rounded-lg transition-all
                    ${isSelected 
                        ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30" 
                        : "text-slate-300 hover:text-blue-500 hover:bg-blue-50"
                    }
                `}
            >
                <Monitor size={16} />
            </Button>
            </Tooltip>
        </div>
      </div>
    </div>
  );
};

// --- کامپوننت اصلی ---
interface NodeTooltipProps {
  nodeTooltipTitle: string | null;
  nodeTooltipData: Array<NodeTooltipType>;
  selectedEdgeId: string | null;
  onClose: () => void;
  onEdgeSelect: (edgeId: string) => void;
}

export const NodeTooltip = ({
  nodeTooltipTitle,
  nodeTooltipData,
  selectedEdgeId,
  onClose,
  onEdgeSelect
}: NodeTooltipProps) => {

  const incomingEdges = useMemo(() => {
    return nodeTooltipData.filter((item) => item.direction === "incoming");
  }, [nodeTooltipData]);

  const outgoingEdges = useMemo(() => {
    return nodeTooltipData.filter((item) => item.direction === "outgoing");
  }, [nodeTooltipData]);

  return (
    <>
      <CardHeader className="flex justify-between items-center px-4 py-3 border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center gap-3 overflow-hidden">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl shadow-lg shadow-blue-500/20">
                <Activity size={18} />
            </div>
            <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-bold mb-0.5">فعالیت انتخاب شده</span>
                <span className="font-extrabold text-sm text-slate-800 text-nowrap truncate max-w-[180px]" title={nodeTooltipTitle || ""}>
                    {nodeTooltipTitle}
                </span>
            </div>
        </div>
        <Button
          isIconOnly
          size="sm"
          variant="light"
          onPress={onClose}
          className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all w-9 h-9"
        >
          <X size={20} />
        </Button>
      </CardHeader>

      <CardBody className="p-0 overflow-hidden bg-slate-50/50">
        {nodeTooltipData.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3 opacity-60">
            <div className="p-4 bg-slate-100 rounded-full">
                <Network size={32} />
            </div>
            <p className="text-xs font-medium">هیچ یالی متصل نیست.</p>
          </div>
        ) : (
          <ScrollShadow className="h-full max-h-[400px] p-3 scrollbar-hide">
            <Accordion 
                selectionMode="multiple" 
                defaultExpandedKeys={["incoming", "outgoing"]}
                className="flex flex-col gap-3"
                itemClasses={{
                    base: "group bg-transparent shadow-none border-none p-0",
                    trigger: "px-3 py-2 rounded-xl hover:bg-white/60 transition-colors data-[hover=true]:bg-slate-200/50",
                    title: "text-xs font-bold text-slate-600 group-data-[open=true]:text-blue-600",
                    content: "pt-2 pb-1 px-1",
                    indicator: "text-slate-400 group-data-[open=true]:text-blue-500"
                }}
            >
                {/* لیست ورودی‌ها */}
                {incomingEdges.length > 0 && (
                    <AccordionItem 
                        key="incoming" 
                        aria-label="Incoming Edges"
                        title={
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
                                <span>ورودی‌ها <span className="text-slate-400 font-normal ml-1">({incomingEdges.length})</span></span>
                            </div>
                        }
                    >
                        {incomingEdges.map((item) => (
                        <EdgeRow 
                            key={item.edgeId} 
                            item={item} 
                            isSelected={item.edgeId === selectedEdgeId} 
                            onEdgeSelect={onEdgeSelect} 
                        />
                        ))}
                    </AccordionItem>
                )}

                {/* لیست خروجی‌ها */}
                {outgoingEdges.length > 0 && (
                    <AccordionItem 
                        key="outgoing" 
                        aria-label="Outgoing Edges"
                        title={
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]" />
                                <span>خروجی‌ها <span className="text-slate-400 font-normal ml-1">({outgoingEdges.length})</span></span>
                            </div>
                        }
                    >
                        {outgoingEdges.map((item) => (
                        <EdgeRow 
                            key={item.edgeId} 
                            item={item} 
                            isSelected={item.edgeId === selectedEdgeId} 
                            onEdgeSelect={onEdgeSelect} 
                        />
                        ))}
                    </AccordionItem>
                )}
            </Accordion>
          </ScrollShadow>
        )}
      </CardBody>
    </>
  );
};