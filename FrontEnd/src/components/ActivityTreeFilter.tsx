import { useState, useEffect, useCallback, memo } from "react";
import { Checkbox } from "@heroui/checkbox";
import { Button } from "@heroui/button";
import { Plus, Minus, Filter } from "lucide-react";
import { useAppStore } from "@/hooks/useAppStore";

interface TreeNode {
  id: string;
  label: string;
  children?: Record<string, TreeNode>;
}

function ActivityTreeFilter() {
  const { graphData, setFilteredGraphData } = useAppStore();
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [checkedNodes, setCheckedNodes] = useState<Record<string, boolean>>({});
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // فیلتر کردن آنی و بلادرنگ فرانت‌اند هم روی یال‌ها و هم روی گره‌ها
  // فیلتر کردن آنی و بلادرنگ فرانت‌اند هم روی یال‌ها و هم روی گره‌ها
  const applyClientFilter = useCallback((currentChecked: Record<string, boolean>) => {
    if (!graphData) return;

    requestAnimationFrame(() => {
      // الف) فیلتر یال‌ها
      const filteredEdges = graphData.filter((edge) => {
        return currentChecked[edge.Source_Activity] !== false && currentChecked[edge.Target_Activity] !== false;
      });

      // ب) استخراج گره‌های فعال به همراه گره‌های سیستمی شروع و پایان
      const activeNodeIds = new Set<string>();
      
      graphData.forEach((edge) => {
        const src = edge.Source_Activity;
        const tgt = edge.Target_Activity;

        // اگر گره عادی تیک داشت، یا اگر گره از نوع شروع/پایان سیستمی بود (مانند START یا END)
        if (currentChecked[src] !== false || src.toLowerCase().includes("start") || src.toLowerCase().includes("end")) {
          activeNodeIds.add(src);
        }
        if (currentChecked[tgt] !== false || tgt.toLowerCase().includes("start") || tgt.toLowerCase().includes("end")) {
          activeNodeIds.add(tgt);
        }
      });

      // ج) اعمال در استور سراسری
      setFilteredGraphData(filteredEdges);
      useAppStore.getState().setSelectedNodeIds(activeNodeIds);
    });
  }, [graphData, setFilteredGraphData]);

  // ساخت درخت ۳ سطحی کاملاً پویا و هوشمند
  useEffect(() => {
    if (!graphData || graphData.length === 0) return;

    const root: Record<string, TreeNode> = {};
    const initialChecked: Record<string, boolean> = {};

    graphData.forEach((edge: any) => {
      const srcActivity = edge.Source_Activity;
      
      // ۱. 🟢 استخراج فوق‌العاده امن مراجع عمومی (سطح ۱) بدون وابستگی به حروف بزرگ و کوچک
      let publicCourtType = (
        edge.Source_PublicCourtType || 
        edge.source_publiccourttype || 
        edge.PUBLICCOURTTYPENAME || 
        edge.publiccourttypename
      );

      // ۲. 🟢 استخراج فوق‌العاده امن انواع شعب تخصصی (سطح ۲)
      let courtType = (
        edge.Source_CourtType || 
        edge.source_courttype || 
        edge.COURTTYPENAME || 
        edge.courttypename
      );

      // ۳. 🔥 مکانیزم فیل‌سیف (Fail-safe): اگر متادیتا به هر دلیلی لود نشد، هوشمندانه از روی نام خود فعالیت تفکیک می‌کند
      if (!publicCourtType || !courtType || publicCourtType === "سایر مراجع عمومی" || courtType === "سایر شعب تخصصی") {
        if (srcActivity.includes(" در ")) {
          const extractedType = srcActivity.split(" در ")[1];
          courtType = extractedType; // نوع شعبه می‌شود بخش دوم متن (مثلاً دادگاه کیفری)
          
          // تعیین هوشمند نوع عمومی بر اساس کلمات کلیدی واحدها
          if (extractedType.includes("اجراي احكام") || extractedType.includes("اجراي احکام")) {
            publicCourtType = "اجرای احکام";
          } else if (extractedType.includes("تجديد نظر") || extractedType.includes("تجدیدنظر")) {
            publicCourtType = "دادگاه تجدیدنظر";
          } else {
            publicCourtType = "دادگاه‌های عمومی و تخصصی";
          }
        } else {
          publicCourtType = "سایر مراجع عمومی";
          courtType = "سایر شعب تخصصی";
        }
      }

      // تمیزکاری نام اکشن فرآیند برای لایه سوم (برگ درخت)
      const actionLabel = srcActivity.includes(" در ") ? srcActivity.split(" در ")[0] : srcActivity;

      const lvl2Key = `${publicCourtType}|${courtType}`;
      const lvl3Key = srcActivity;

      initialChecked[publicCourtType] = true;
      initialChecked[lvl2Key] = true;
      initialChecked[lvl3Key] = true;

      // لایه اول: نوع عمومی شعبه
      if (!root[publicCourtType]) {
        root[publicCourtType] = { id: publicCourtType, label: publicCourtType, children: {} };
      }
      
      // لایه دوم: نوع شعبه (دیگر با متن ثابت قفل نمی‌شود)
      if (!root[publicCourtType].children![courtType]) {
        root[publicCourtType].children![courtType] = { id: lvl2Key, label: courtType, children: {} };
      }
      
      // لایه سوم: فعالیت فرآیند
      if (!root[publicCourtType].children![courtType].children![lvl3Key]) {
        root[publicCourtType].children![courtType].children![lvl3Key] = { id: lvl3Key, label: actionLabel };
      }
    });

    setTreeData(Object.values(root));
    setCheckedNodes(initialChecked);
    applyClientFilter(initialChecked);
  }, [graphData, applyClientFilter]);

  const toggleNode = useCallback((node: TreeNode, isChecked: boolean) => {
    setCheckedNodes((prev) => {
      const nextChecked = { ...prev, [node.id]: isChecked };

      const cascadeDown = (n: TreeNode) => {
        nextChecked[n.id] = isChecked;
        if (n.children) {
          Object.values(n.children).forEach(child => cascadeDown(child));
        }
      };
      cascadeDown(node);
      
      applyClientFilter(nextChecked);
      return nextChecked;
    });
  }, [applyClientFilter]);

  const renderTree = (nodes: TreeNode[], level = 0) => {
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {nodes.map((node) => {
          const isExpanded = expandedNodes[node.id];
          const hasChildren = node.children && Object.keys(node.children).length > 0;
          const isChecked = checkedNodes[node.id] !== false;

          return (
            <div key={node.id} className={`flex flex-col w-full ${level > 0 ? "pr-3 mr-1.5 border-r border-slate-200/40 mt-1" : ""}`}>
              <div className="w-full flex items-center justify-between bg-white/40 backdrop-blur-md border border-white/60 rounded-xl p-2 hover:bg-white/80 transition-all shadow-sm">
                <div className="flex items-center gap-2">
                  <Checkbox
                    isSelected={isChecked} radius="md" size="sm" color="primary"
                    onValueChange={(checked) => toggleNode(node, checked)}
                    classNames={{ wrapper: "before:border-slate-300 mr-1" }}
                  />
                  <span className="text-xs font-semibold text-slate-700 select-none truncate max-w-[200px]">{node.label}</span>
                </div>
                {hasChildren && (
                  <Button
                    isIconOnly size="sm" variant="light" className="w-7 h-7 min-w-7 rounded-lg text-slate-500 hover:bg-blue-50/80 hover:text-blue-600 transition-colors"
                    onPress={() => setExpandedNodes(prev => ({ ...prev, [node.id]: !prev[node.id] }))}
                  >
                    {isExpanded ? <Minus size={12} /> : <Plus size={12} />}
                  </Button>
                )}
              </div>
              {isExpanded && hasChildren && (
                <div className="mt-1.5 w-full">
                  {renderTree(Object.values(node.children!), level + 1)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col gap-2 p-2 bg-slate-50/50 backdrop-blur-md rounded-2xl border border-slate-200/40">
      <div className="flex items-center gap-2 pb-2 border-b border-slate-200/40 text-slate-600 px-1">
        <Filter size={14} className="text-blue-500" />
        <span className="text-[11px] font-bold">فیلتر درختی فرآیندها (مبتنی بر داده)</span>
      </div>
      <div className="max-h-64 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
        {treeData.length > 0 ? (
          renderTree(treeData)
        ) : (
          <div className="text-slate-400 text-[11px] py-4 text-center">در حال ساخت ساختار سلسله‌مراتبی...</div>
        )}
      </div>
    </div>
  );
}

export default memo(ActivityTreeFilter);