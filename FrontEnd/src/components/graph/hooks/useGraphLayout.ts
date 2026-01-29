/**
 * @deprecated This hook is deprecated. Use `useGraphStore` from `@/store/useGraphStore` instead.
 * This file is kept for backward compatibility only.
 * 
 * @see {@link useGraphStore} for the new implementation
 */
import { useState, useEffect, useRef } from "react";
import { Node, Edge } from "@xyflow/react";
import ELK from "elkjs/lib/elk.bundled.js";
import LayoutWorker from "../../../utils/layout-worker.ts?worker";
import { colorPalettes } from "../../../constants/colorPalettes";

const elk = new ELK();

const layoutOptions = {
  // الگوریتم اصلی: لایه‌بندی
  algorithm: "layered",
  direction: "RIGHT",

  // --- تنظیمات استراتژی ---
  "layered.layering.strategy": "LONGEST_PATH",
  "layered.nodePlacement.strategy": "BRANDES_KOEPF",

  // --- تنظیمات فواصل ---
  "layered.spacing.layerLayer": "600",
  "layered.spacing.nodeNode": "300",
  "layered.spacing.nodeNodeBetweenLayers": "300",

  // --- تنظیمات یال‌ها ---
  "elk.edgeRouting": "ORTHOGONAL",
  "layered.mergeEdges": "true",
  "spacing.edgeNode": "40",
  "spacing.edgeEdge": "30",

  // --- تنظیمات دیگر ---
  "elk.separateConnectedComponents": "true",
  "layered.crossingMinimization.strategy": "LAYER_SWEEP",
  "layered.crossingMinimization.semiInteractive": "true",
  "org.eclipse.elk.portConstraints": "FIXED_SIDE",
};

interface ActivePathInfo {
  nodes: string[];
  edges: string[];
}

interface SearchCasePathInfo {
  nodes: string[];
  edges: string[];
}

export const useGraphLayout = (
  data: any[] | null,
  colorPaletteKey: string,
  startEndNodes: {
    start: string[];
    end: string[];
  },
  filteredNodeIds: Set<string> = new Set(),
  filteredEdgeIds: Set<string> | null = null,
  activePathInfo?: ActivePathInfo,
  searchCasePathInfo?: SearchCasePathInfo
) => {
  const [allNodes, setAllNodes] = useState<Node[]>([]);
  const [allEdges, setAllEdges] = useState<Edge[]>([]);
  const [layoutedNodes, setLayoutedNodes] = useState<Node[]>([]);
  const [layoutedEdges, setLayoutedEdges] = useState<Edge[]>([]);
  const [isLoading, setIsLoading] = useState(false); // تغییر پیش‌فرض به false
  const [loadingMessage, setLoadingMessage] = useState("در حال بارگذاری داده‌ها...");
  const workerRef = useRef<Worker | null>(null);

  // 1. راه‌اندازی Web Worker
  useEffect(() => {
    const worker = new LayoutWorker();
    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent) => {
      const { type, payload } = event.data;
      if (type === "INITIAL_DATA_PROCESSED") {
        setAllNodes(payload.allNodes);
        setAllEdges(payload.allEdges);
        // نکته: اینجا setIsLoading را فالس نمی‌کنیم چون هنوز Layout مانده
      }
    };

    worker.onerror = (error: ErrorEvent) => {
      console.error("Web Worker error:", error);
      setIsLoading(false);
    };

    return () => {
      worker.terminate();
    };
  }, []);

  // 2. پردازش اولیه داده‌ها (تبدیل دیتای خام به نود و یال)
  useEffect(() => {
    // اگر دیتایی نیست، لیست‌ها را خالی کن اما ریترن نکن (چون شاید بخواهیم Ghost رسم کنیم)
    if (!data || data.length === 0) {
      setAllNodes([]);
      setAllEdges([]);
      // اگر مسیر فعالی هم نداریم، لودینگ را ببند
      if (!activePathInfo) {
          setIsLoading(false);
      }
      return;
    }

    setIsLoading(true);
    setLoadingMessage("در حال پردازش اولیه داده‌ها...");
    workerRef.current?.postMessage({
      type: "PROCESS_INITIAL_DATA",
      payload: {
        graphData: data,
        startActivities: startEndNodes.start,
        endActivities: startEndNodes.end,
      },
    });
  }, [data, startEndNodes, activePathInfo]); // activePathInfo اضافه شد تا در صورت تغییر وضعیت، استیت‌ها مدیریت شوند

  // 3. محاسبه چیدمان (Layout) با ELK
  useEffect(() => {
    // --- تغییر مهم: حذف شرط بازگشت زودهنگام وابسته به allNodes ---
    // ما اول لیست نهایی (شامل Ghostها) را می‌سازیم، بعد اگر خالی بود ریترن می‌کنیم.

    let nodesToLayout = [...allNodes];
    let edgesToLayout = [...allEdges];

    // الف) اعمال فیلترها (فقط اگر نودهای اصلی وجود داشته باشند)
    if (nodesToLayout.length > 0 && filteredNodeIds.size > 0) {
      nodesToLayout = nodesToLayout.filter((node) => filteredNodeIds.has(node.id));
      edgesToLayout = edgesToLayout.filter(
        (edge) =>
          filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target)
      );
    }

    if (edgesToLayout.length > 0 && filteredEdgeIds && filteredEdgeIds.size > 0) {
       edgesToLayout = edgesToLayout.filter(edge => filteredEdgeIds.has(edge.id));
    }

    // ب) اضافه کردن Ghost Nodes (از activePathInfo)
    if (activePathInfo?.nodes && activePathInfo.nodes.length > 0) {
      const existingNodeIds = new Set(nodesToLayout.map(n => n.id));
      const ghostNodeIds = activePathInfo.nodes.filter(id => !existingNodeIds.has(id));
      
      const ghostNodes = ghostNodeIds.map((id: string) => ({
        id: id,
        type: "activity",
        position: { x: 0, y: 0 },
        data: { label: id, isGhost: true },
        style: {
          width: 250,
          border: "2px dashed #f59e0b",
          backgroundColor: "#fffbeb",
          color: "#b45309",
        },
        draggable: true,
      } as Node));
      
      nodesToLayout = [...nodesToLayout, ...ghostNodes];
    }

    // پ) اضافه کردن Ghost Edges
    if (activePathInfo?.edges && activePathInfo.edges.length > 0) {
      const existingEdgeIds = new Set(edgesToLayout.map(e => e.id));
      const ghostEdgeIds = activePathInfo.edges.filter(id => !existingEdgeIds.has(id));
      
      const ghostEdges = ghostEdgeIds.map((edgeId: string) => {
        const [source, target] = edgeId.split('->');
        return {
          id: edgeId,
          source: source,
          target: target,
          type: "default",
          animated: false, // برای مسیر پرونده انیمیشن جذاب است
          label: "",
          style: {
            stroke: "#f59e0b",
            strokeDasharray: "5, 5",
            strokeWidth: 2,
          },
          data: { isGhost: true },
        } as Edge;
      });
      
      edgesToLayout = [...edgesToLayout, ...ghostEdges];
    }

    // ت) اضافه کردن نودها و یال‌های جستجوی پرونده (بدون استایل گوست)
    // برای SearchCaseIds: نودها و یال‌هایی که در گراف اصلی نیستند به صورت عادی اضافه می‌شوند
    if (searchCasePathInfo?.nodes && searchCasePathInfo.nodes.length > 0) {
      const existingNodeIds = new Set(nodesToLayout.map(n => n.id));
      const newNodeIds = searchCasePathInfo.nodes.filter(id => !existingNodeIds.has(id));
      
      const newNodes = newNodeIds.map((id: string) => ({
        id: id,
        type: "activity",
        position: { x: 0, y: 0 },
        data: { label: id, isGhost: false },
        style: {
          width: 250,
          // استایل عادی - بدون کادر خط‌چین و رنگ گوست
        },
        draggable: true,
      } as Node));
      
      nodesToLayout = [...nodesToLayout, ...newNodes];
    }

    // ث) اضافه کردن یال‌های جستجوی پرونده (بدون استایل گوست)
    if (searchCasePathInfo?.edges && searchCasePathInfo.edges.length > 0) {
      const existingEdgeIds = new Set(edgesToLayout.map(e => e.id));
      const newEdgeIds = searchCasePathInfo.edges.filter(id => !existingEdgeIds.has(id));
      
      const newEdges = newEdgeIds.map((edgeId: string) => {
        const [source, target] = edgeId.split('->');
        return {
          id: edgeId,
          source: source,
          target: target,
          type: "default",
          animated: false, // بدون انیمیشن
          label: "",
          style: {
            // استایل پیش‌فرض - رنگ‌بندی بعداً توسط color palette اعمال می‌شود
            strokeWidth: 2,
          },
          data: { isGhost: false },
        } as Edge;
      });
      
      edgesToLayout = [...edgesToLayout, ...newEdges];
    }

    // --- شرط بازگشت جدید: اگر بعد از همه این‌ها باز هم چیزی برای نمایش نبود ---
    if (nodesToLayout.length === 0) {
        setLayoutedNodes([]);
        setLayoutedEdges([]);
        // اگر دیتایی نداریم و مسیری هم نداریم، لودینگ تمام است
        setIsLoading(false);
        return;
    }

    setIsLoading(true);
    setLoadingMessage("در حال محاسبه چیدمان گراف...");

    const nodeHeight = 50;
    const elkNodes = nodesToLayout.map((node: Node) => {
      const elkNode: any = {
        id: node.id,
        width: (node.style?.width as number) || 250,
        height: nodeHeight,
      };

      if (node.id === "START_NODE") {
        elkNode.layoutOptions = {
          "org.eclipse.elk.layered.layering.layerConstraint": "FIRST",
        };
      }

      if (node.id === "END_NODE") {
        elkNode.layoutOptions = {
          "org.eclipse.elk.layered.layering.layerConstraint": "LAST",
        };
      }

      return elkNode;
    });

    const elkEdges = edgesToLayout.map((edge: Edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    }));

    const graphToLayout = {
      id: "root",
      layoutOptions: layoutOptions,
      children: elkNodes,
      edges: elkEdges,
    };

    elk
      .layout(graphToLayout)
      .then((layoutedGraph: any) => {
        const newLayoutedNodes = nodesToLayout.map((node) => {
          const elkNode = layoutedGraph.children.find(
            (n: any) => n.id === node.id
          );
          return {
            ...node,
            position: { x: elkNode?.x || 0, y: elkNode?.y || 0 },
          };
        });

        // محاسبه بازه وزن‌ها برای رنگ‌بندی
        let minWeight = Infinity;
        let maxWeight = -Infinity;
        edgesToLayout.forEach((edge) => {
          // یال‌های گوست وزن ندارند، نادیده می‌گیریم
          if (edge.data?.isGhost) return;
          
          const weight = (edge.data?.Weight_Value as number) || 0;
          if (weight < minWeight) minWeight = weight;
          if (weight > maxWeight) maxWeight = weight;
        });

        if (minWeight === Infinity) { minWeight = 0; maxWeight = 1; } // هندل کردن حالتی که فقط گوست داریم
        if (minWeight === maxWeight) { maxWeight = minWeight + 1; }

        const getEdgeColor = colorPalettes[colorPaletteKey] || colorPalettes.default;

        const coloredEdges = edgesToLayout.map((edge) => {
          // --- تغییر مهم: حفظ استایل یال‌های Ghost ---
          if (edge.data?.isGhost) {
              return edge; // دست به استایل Ghost نزن
          }

          const weight = (edge.data?.Weight_Value as number) || 0;
          const color = getEdgeColor(weight, minWeight, maxWeight);

          return {
            ...edge,
            style: {
              ...edge.style,
              stroke: color,
            },
            data: {
              ...edge.data,
              originalStroke: color,
            },
          };
        });

        setLayoutedNodes(newLayoutedNodes);
        setLayoutedEdges(coloredEdges);
        setIsLoading(false);
      })
      .catch((e) => {
        console.error("Component: ELK layout failed:", e);
        setIsLoading(false);
      });
  }, [allNodes, allEdges, colorPaletteKey, startEndNodes, filteredNodeIds, filteredEdgeIds, activePathInfo, searchCasePathInfo]);

  return {
    allNodes,
    allEdges,
    layoutedNodes,
    layoutedEdges,
    isLoading,
    loadingMessage,
    setLayoutedNodes,
    setLayoutedEdges,
  };
};