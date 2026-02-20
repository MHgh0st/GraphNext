/**
 * Route Builder Store (Zustand)
 *
 * Shared state for the route-builder feature.
 * Both the sidebar page.tsx and the main-panel SankeyFlow component
 * read / write here so they stay in sync.
 */

import { create } from "zustand";

interface RouteBuilderState {
  /** The path being built, as an ordered array of node IDs */
  selectedPath: string[];
  /** Append a node to the end of the path */
  addNode: (nodeId: string) => void;
  /** Remove the last node from the path */
  removeLastNode: () => void;
  /** Reset path to empty */
  reset: () => void;
}

export const useRouteBuilderStore = create<RouteBuilderState>((set) => ({
  selectedPath: [],

  addNode: (nodeId) =>
    set((state) => ({
      selectedPath: [...state.selectedPath, nodeId],
    })),

  removeLastNode: () =>
    set((state) => ({
      selectedPath: state.selectedPath.slice(0, -1),
    })),

  reset: () => set({ selectedPath: [] }),
}));
