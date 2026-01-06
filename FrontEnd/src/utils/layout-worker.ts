import { Node, Edge } from "@xyflow/react";

interface GraphDataItem {
  Source_Activity: string;
  Target_Activity: string;
  // Case_Count: number;
  Mean_Duration_Seconds: number;
  Tooltip_Total_Time: string;
  Tooltip_Mean_Time: string;
  Weight_Value: number;
  Edge_Label: string;
}

self.onmessage = async (event: MessageEvent) => {
  const { type, payload } = event.data;

  switch (type) {
    case "PROCESS_INITIAL_DATA": {
      const {
        graphData,
        startActivities,
        endActivities,
      }: {
        graphData: GraphDataItem[];
        startActivities: string[];
        endActivities: string[];
      } = payload;
      const nodeWidth = 250; // عرض پیش‌فرض

      // ... (تمام کدهای مربوط به scaleEdgeWidth, scaleEdgeColor, ... تا انتها) ...

      const minWeight = Math.min(...graphData.map((d) => d.Weight_Value));
      const maxWeight = Math.max(...graphData.map((d) => d.Weight_Value));

      const scaleEdgeWidth = (weight: number) => {
        const normalized = (weight - minWeight) / (maxWeight - minWeight + 1);
        return 1 + normalized * 5;
      };

      const scaleEdgeColor = (weight: number) => {
        const normalized = (weight - minWeight) / (maxWeight - minWeight || 1);
        const intensity = Math.max(0.3, normalized);
        return `rgba(59, 130, 246, ${intensity})`;
      };

      const validNodeIds = new Set<string>();
      graphData.forEach((item) => {
        validNodeIds.add(item.Source_Activity);
        validNodeIds.add(item.Target_Activity);
      });

      const sourceActivities = new Set(
        graphData.map((item) => item.Source_Activity)
      );
      const targetActivities = new Set(
        graphData.map((item) => item.Target_Activity)
      );

      const allActivityNames = new Set([
        ...sourceActivities,
        ...targetActivities,
      ]);

      let allNodes: Node[] = Array.from(allActivityNames).map(
        (name: string) => ({
          id: name,
          data: {
            label: name,
            type: "activity",
          },
          position: { x: 0, y: 0 },
          style: { width: nodeWidth }, // عرض پیش‌فرض
          draggable: true,
        })
      );

      const startNode: Node = {
        id: "START_NODE",
        data: { label: "شروع", type: "start" },
        position: { x: 0, y: 0 },
        style: { width: 150 }, // عرض خاص
        draggable: true,
      };
      const endNode: Node = {
        id: "END_NODE",
        data: { label: "پایان", type: "end" },
        position: { x: 0, y: 0 },
        style: { width: 150 }, // عرض خاص
        draggable: true,
      };

      allNodes = [startNode, endNode, ...allNodes];

      let allEdges: Edge[] = graphData.map((d, i) => {
        const edgeColor = scaleEdgeColor(d.Weight_Value);
        const edgeWidth = scaleEdgeWidth(d.Weight_Value);
        return {
          id: `${d.Source_Activity}->${d.Target_Activity}`,
          source: d.Source_Activity,
          target: d.Target_Activity,
          label: `${d.Edge_Label}`,
          data: {
            ...d,
            originalStroke: edgeColor,
            originalStrokeWidth: edgeWidth,
          } as any,
          style: { strokeWidth: edgeWidth, stroke: edgeColor },
        };
      });

      const startEdges: Edge[] = startActivities
        .filter((targetId) => validNodeIds.has(targetId))
        .map((targetNodeId) => ({
          id: `start-to-${targetNodeId}`,
          source: startNode.id,
          target: targetNodeId,
          data: { originalStroke: "#a0aec0", originalStrokeWidth: 1.5 },
          style: { stroke: "#a0aec0", strokeDasharray: "5 5" },
        }));

      const endEdges: Edge[] = endActivities
        .filter((sourceId) => validNodeIds.has(sourceId))
        .map((sourceNodeId) => ({
          id: `${sourceNodeId}-to-end`,
          source: sourceNodeId,
          target: endNode.id,
          data: { originalStroke: "#a0aec0", originalStrokeWidth: 1.5 },
          style: { stroke: "#a0aec0", strokeDasharray: "5 5" },
        }));

      allEdges = [...allEdges, ...startEdges, ...endEdges];

      // ... (پایان بخش بدون تغییر) ...

      self.postMessage({
        type: "INITIAL_DATA_PROCESSED",
        payload: {
          allNodes,
          allEdges,
        },
      });

      break;
    }
  }
};
