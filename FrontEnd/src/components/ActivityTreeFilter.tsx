import { useState, useEffect, useCallback } from "react";
import { Checkbox } from "@heroui/checkbox";
import { Button } from "@heroui/button";
import { Plus, Minus, Filter } from "lucide-react";
import { useAppStore } from "@/hooks/useAppStore";

interface TreeNode {
  id: string;
  label: string;
  children?: Record<string, TreeNode>;
}

export default function ActivityTreeFilter() {
  const { graphData, setFilteredGraphData, setSelectedNodeIds, startEndNodes } = useAppStore(); // 🔧 اضافه کردن startEndNodes
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [checkedNodes, setCheckedNodes] = useState<Record<string, boolean>>({});
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  // تولید پویای ساختار درختی ۳ سطحی از تایتل متنی فعالیت‌های لود شده کلاینت
  useEffect(() => {
    if (!graphData) return;

    const root: Record<string, TreeNode> = {};
    const initialChecked: Record<string, boolean> = {};
    const allNodeIds = new Set<string>();

    graphData.forEach((edge) => {
      const srcActivity = edge.Source_Activity;
      const tgtActivity = edge.Target_Activity;
      const parts = srcActivity.split(" در ");
      const action = parts[0];
      const courtType = parts[1] || "سایر واحدها";
      
      // تشخیص سطح ۱: نوع عمومی بر اساس تایتل
      let publicCourtType = "دادگاه‌های عمومی و تخصصی";
      if (courtType.includes("اجراي احكام")) publicCourtType = "اجرای احکام";
      if (courtType.includes("تجديد نظر")) publicCourtType = "دادگاه تجدیدنظر";

      initialChecked[publicCourtType] = true;
      initialChecked[`${publicCourtType}|${courtType}`] = true;
      initialChecked[srcActivity] = true;
      initialChecked[tgtActivity] = true; // 🔧 افزودن Target_Activity
      
      // 🔧 اضافه کردن تمام node IDs
      allNodeIds.add(srcActivity);
      allNodeIds.add(tgtActivity);

      if (!root[publicCourtType]) {
        root[publicCourtType] = { id: publicCourtType, label: publicCourtType, children: {} };
      }
      if (!root[publicCourtType].children![courtType]) {
        root[publicCourtType].children![courtType] = { id: `${publicCourtType}|${courtType}`, label: courtType, children: {} };
      }
      if (!root[publicCourtType].children![courtType].children![srcActivity]) {
        root[publicCourtType].children![courtType].children![srcActivity] = { id: srcActivity, label: action };
      }
    });

    setTreeData(Object.values(root));
    setCheckedNodes(initialChecked);
    
    // 🔧 در ابتدا تمام nodes انتخاب‌شده‌اند (شامل START/END nodes چون حداقل یک edge وجود دارد)
    const allNodeIdsWithStartEnd = new Set(allNodeIds);
    if (startEndNodes?.start) {
      startEndNodes.start.forEach(id => allNodeIdsWithStartEnd.add(id));
    }
    if (startEndNodes?.end) {
      startEndNodes.end.forEach(id => allNodeIdsWithStartEnd.add(id));
    }
    setSelectedNodeIds(allNodeIdsWithStartEnd);
  }, [graphData, startEndNodes, setSelectedNodeIds]);

  // فیلتر کردن آنی و بلادرنگ فرانت‌اند بدون نیاز به دکمه اعمال یا لودینگ سرور
  const applyClientFilter = useCallback((currentChecked: Record<string, boolean>) => {
    if (!graphData) return;

    // 🟢 استفاده از requestAnimationFrame برای جلوگیری از ارور "update during render"
    requestAnimationFrame(() => {
      // فیلتر کردن edges
      const filteredEdges = graphData.filter((edge) => {
        return currentChecked[edge.Source_Activity] === true && currentChecked[edge.Target_Activity] === true;
      });
      
      // استخراج node IDs از فیلتر شده edges
      const nodeIds = new Set<string>();
      filteredEdges.forEach((edge) => {
        nodeIds.add(edge.Source_Activity);
        nodeIds.add(edge.Target_Activity);
      });
      
      // 🔧 اضافه کردن START/END nodes **فقط اگر حداقل یک edge وجود داشته باشد**
      if (filteredEdges.length > 0) {
        if (startEndNodes?.start) {
          startEndNodes.start.forEach(id => nodeIds.add(id));
        }
        if (startEndNodes?.end) {
          startEndNodes.end.forEach(id => nodeIds.add(id));
        }
      }
      
      // 🔧 اپدیت هم filtered data و هم selected nodes
      setFilteredGraphData(filteredEdges);
      setSelectedNodeIds(nodeIds);
    });
  }, [graphData, startEndNodes, setFilteredGraphData, setSelectedNodeIds]);

  const toggleNode = useCallback((node: TreeNode, isChecked: boolean) => {
    // استفاده از functional state update
    setCheckedNodes((prev) => {
      const nextChecked = { ...prev };

      // تابع برای اعمال تغییر به تمام فرزندان (پایین‌رو)
      const cascadeDown = (n: TreeNode) => {
        nextChecked[n.id] = isChecked;
        if (n.children) {
          Object.values(n.children).forEach(child => cascadeDown(child));
        }
      };

      cascadeDown(node);
      
      // فراخوانی فیلتر اصلاح شده
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
                  />
                  <span className="text-xs font-semibold text-slate-700 select-none truncate max-w-[200px]">{node.label}</span>
                </div>
                {hasChildren && (
                  <Button
                    isIconOnly size="sm" variant="light" className="w-7 h-7 min-w-7 rounded-lg text-slate-500"
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
        <span className="text-[11px] font-bold">فیلتر درختی فرآیندها (کلاینت‌ساید)</span>
      </div>
      <div className="max-h-64 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
        {renderTree(treeData)}
      </div>
    </div>
  );
}