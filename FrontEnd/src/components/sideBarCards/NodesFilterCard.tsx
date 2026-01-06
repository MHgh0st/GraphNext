/**
 * @component NodesFilterCard
 * @module components/sideBarCards/NodesFilterCard
 *
 * @description
 * Sidebar card for node selection and filtering.
 * Allows users to search and select specific nodes to include in the graph.
 * Features select all/deselect all and search filtering.
 *
 * @example
 * ```tsx
 * <NodesFilterCard
 *   Nodes={allNodes}
 *   selectedNodeIds={selectedIds}
 *   onSelectionChange={handleSelectionChange}
 *   onFilteredNodesChange={setFilteredNodes}
 * />
 * ```
 */

import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { useReactFlow, Node } from "@xyflow/react";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Checkbox } from "@heroui/checkbox";
import { Chip } from "@heroui/chip";
import { Divider } from "@heroui/divider";
import { Search, CheckSquare, Square, Layers, ListFilter } from "lucide-react";


interface Props {
  Nodes: Node[];
  selectedNodeIds: Set<string>;
  onSelectionChange: (selectedIds: Set<string>) => void;
  onFilteredNodesChange: React.Dispatch<React.SetStateAction<Node[]>>;
  className?: string;
}

export default function NodesFilterCard({
  Nodes,
  selectedNodeIds,
  onSelectionChange,
  onFilteredNodesChange,
  className,
}: Props) {
  const [searchedNodes, setSearchedNodes] = useState<Node[]>(Nodes);
  const [searchValue, setSearchValue] = useState<string>("");
  const { fitView } = useReactFlow();

  // لاجیک جستجو
  useEffect(() => {
    if (!searchValue.trim()) {
      setSearchedNodes(Nodes);
    } else {
      setSearchedNodes(
        Nodes.filter((node) =>
          node.data.label.toLowerCase().includes(searchValue.toLowerCase())
        )
      );
    }
  }, [Nodes, searchValue]);

  // اعمال فیلتر روی گراف اصلی
  useEffect(() => {
    if (selectedNodeIds.size === 0) {
      onFilteredNodesChange([]);
    } else {
      const filtered = Nodes.filter((node) => selectedNodeIds.has(node.id));
      onFilteredNodesChange(filtered);
    }
  }, [selectedNodeIds, Nodes, onFilteredNodesChange]);

  // جداسازی لیست انتخاب شده‌ها از انتخاب نشده‌ها
  const { selectedList, unselectedList } = useMemo(() => {
    const selected: Node[] = [];
    const unselected: Node[] = [];

    searchedNodes.forEach((node) => {
      if (selectedNodeIds.has(node.id)) {
        selected.push(node);
      } else {
        unselected.push(node);
      }
    });

    return { selectedList: selected, unselectedList: unselected };
  }, [searchedNodes, selectedNodeIds]);

  const handleNodeClick = (nodeId: string) => {
    fitView({
      nodes: [{ id: nodeId }],
      duration: 1500,
      padding: 0.2,
      maxZoom: 1.5,
    });
  };

  const handleCheckboxChange = (nodeId: string, isChecked: boolean) => {
    const newSelectedIds = new Set(selectedNodeIds);
    if (isChecked) newSelectedIds.add(nodeId);
    else newSelectedIds.delete(nodeId);
    onSelectionChange(newSelectedIds);
  };

  const handleSelectAll = () => {
    const allIds = new Set(searchedNodes.map((node) => node.id));
    onSelectionChange(new Set([...selectedNodeIds, ...allIds]));
  };

  const handleDeselectAll = () => {
    onSelectionChange(new Set());
  };

  // رندر کردن هر آیتم گره (برای جلوگیری از تکرار کد)
  const renderNodeItem = (node: Node, isSelected: boolean) => (
    <div
      key={node.id}
      className={`
        group flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 cursor-pointer relative overflow-hidden
        ${
          isSelected
            ? "bg-blue-50/80 border-blue-200 shadow-sm"
            : "bg-white border-slate-100 hover:border-slate-300 hover:shadow-sm"
        }
      `}
      onClick={() => handleCheckboxChange(node.id, !isSelected)}
    >
      {/* نوار رنگی کنار آیتم انتخاب شده */}
      {isSelected && (
        <div className="absolute right-0 top-0 bottom-0 w-1 bg-blue-500 rounded-r-full" />
      )}

      <Checkbox
        isSelected={isSelected}
        radius="md"
        color="primary"
        classNames={{ wrapper: "before:border-slate-300" }}
        onValueChange={(isChecked) => handleCheckboxChange(node.id, isChecked)}
      />

      <div
        className="flex-1 flex flex-col items-start gap-0.5 min-w-0"
        onClick={(e) => {
          e.stopPropagation();
          handleNodeClick(node.id);
        }}
      >
        <span
          className={`text-sm font-medium truncate w-full ${
            isSelected ? "text-blue-700" : "text-slate-700"
          }`}
        >
          {node.data.label}
        </span>
        <span className="text-[10px] text-slate-400 group-hover:text-blue-400 transition-colors">
          نمایش روی گراف
        </span>
      </div>
    </div>
  );

  return (
    <div className={`flex flex-col gap-y-4 h-full ${className || ""}`}>
      {/* هدر و جستجو */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md pb-2 space-y-2">
        <Input
          type="text"
          variant="flat"
          placeholder="جستجوی نام فعالیت..."
          startContent={<Search size={18} className="text-slate-400" />}
          value={searchValue}
          classNames={{
            inputWrapper:
              "bg-slate-100 hover:bg-slate-200/70 focus-within:bg-white shadow-none border border-transparent focus-within:border-blue-500/50 transition-all rounded-xl",
          }}
          onChange={(e) => {
            const value = e.target.value.replace("ی", "ي");
            setSearchValue(value);
          }}
        />

        {Nodes.length > 0 && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="flat"
              className="bg-blue-50 text-blue-600 font-medium flex-1 rounded-lg hover:bg-blue-100 transition-colors"
              startContent={<CheckSquare size={14} />}
              onPress={handleSelectAll}
            >
              انتخاب همه
            </Button>
            <Button
              size="sm"
              variant="flat"
              className="bg-rose-50 text-rose-600 font-medium flex-1 rounded-lg hover:bg-rose-100 transition-colors"
              startContent={<Square size={14} />}
              onPress={handleDeselectAll}
            >
              لغو همه
            </Button>
          </div>
        )}
      </div>

      {/* لیست گره‌ها */}
      {Nodes.length > 0 ? (
        <div className="flex flex-col gap-y-2 overflow-y-auto pr-1 pb-10 scrollbar-hide flex-1">
          
          {/* بخش انتخاب شده‌ها */}
          {selectedList.length > 0 && (
            <div className="flex flex-col gap-2 mb-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center justify-between px-1 mt-1">
                <div className="flex items-center gap-2 text-blue-600">
                  <Layers size={14} />
                  <span className="text-xs font-bold">انتخاب شده‌ها</span>
                </div>
                <Chip size="sm" variant="flat" className="bg-blue-100 text-blue-700 h-5 text-[10px]">
                  {selectedList.length}
                </Chip>
              </div>
              <div className="flex flex-col gap-2">
                {selectedList.map((node) => renderNodeItem(node, true))}
              </div>
            </div>
          )}

          {/* خط جداکننده (فقط اگر هر دو لیست آیتم داشته باشند) */}
          {selectedList.length > 0 && unselectedList.length > 0 && (
            <Divider className="my-2 bg-slate-200" />
          )}

          {/* بخش انتخاب نشده‌ها */}
          {unselectedList.length > 0 && (
            <div className="flex flex-col gap-2">
              {selectedList.length > 0 && (
                <div className="flex items-center justify-between px-1 opacity-60">
                  <div className="flex items-center gap-2 text-slate-500">
                    <ListFilter size={14} />
                    <span className="text-xs font-bold">سایر موارد</span>
                  </div>
                  <span className="text-[10px] text-slate-400">{unselectedList.length}</span>
                </div>
              )}
              {unselectedList.map((node) => renderNodeItem(node, false))}
            </div>
          )}

          {/* حالت جستجوی ناموفق */}
          {searchedNodes.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2 opacity-60">
              <Search size={32} />
              <span className="text-sm">فعالیتی با این نام یافت نشد</span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2 opacity-60">
          <Search size={32} />
          <span className="text-sm">لیست فعالیت‌ها خالی است</span>
        </div>
      )}
    </div>
  );
}