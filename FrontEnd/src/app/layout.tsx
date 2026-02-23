'use client'

import { useState, useEffect, useCallback, useMemo } from "react";
import Providers from "./Providers";
import SideBar from "@/components/SideBar";
import "./globals.css";
import localFont from 'next/font/local'
import { usePathname, useRouter } from "next/navigation";
import { Card, CardHeader, CardBody } from "@heroui/card";
import { TAB_THEMES } from "@/constants/tabThemes";
import { SidebarTab, FilterTypes } from "@/types/types";
import {
  LineSquiggle,
  Settings,
  Workflow,
  RouteOff,
  FolderSearch,
  Monitor,
  GitFork,
} from "lucide-react";
import Graph from "@/components/Graph";
import SankeyFlow from "@/components/SankeyFlow";
import Navbar from "@/components/Navbar";
import GraphEmptyState from "@/components/GraphEmptyState";
import GraphLoadingState from "@/components/GraphLoadingState";
import GraphDataReadyState from "@/components/GraphDataReadyState";
import { useAppStore } from "@/hooks/useAppStore";
import { useGraphStore } from "@/store/useGraphStore";
import { useRouteBuilderStore } from "@/store/useRouteBuilderStore";

const Vazir = localFont({
  src: "../assets/Fonts/Vazir-FD-WOL.woff2",
  weight: '400'
})


/**
 * Maps sidebar tabs to their icons
 */
const TAB_TITLES: Record<SidebarTab, string> = {
  Filter: "فرآیند نگار",
  Routing: "جریان یاب",
  RouteBuilder: "جریان ساز هوشمند",
  Settings: "تنظیمات نمودار",
  Outliers: "تحلیل مسیر های کم تکرار",
  SearchCaseIds: "پرونده نگار",
};


const TAB_ICONS: Record<SidebarTab, React.ReactNode> = {
  Filter: <Monitor className={TAB_THEMES.Filter.iconActiveClass} />,
  Routing: <LineSquiggle className={TAB_THEMES.Routing.iconActiveClass} />,
  RouteBuilder: <GitFork className={TAB_THEMES.RouteBuilder.iconActiveClass} />,
  Settings: <Settings className={TAB_THEMES.Settings.iconActiveClass} />,
  Outliers: <RouteOff className={TAB_THEMES.Outliers.iconActiveClass} />,
  SearchCaseIds: <FolderSearch className={TAB_THEMES.SearchCaseIds.iconActiveClass} />,
};


const TAB_ICON_COLORS: Record<SidebarTab, string> = {
  Filter: TAB_THEMES.Filter.activeClass,
  Routing: TAB_THEMES.Routing.activeClass,
  RouteBuilder: TAB_THEMES.RouteBuilder.activeClass,
  Settings: TAB_THEMES.Settings.activeClass,
  Outliers: TAB_THEMES.Outliers.activeClass,
  SearchCaseIds: TAB_THEMES.SearchCaseIds.activeClass,
};

const TAB_TITLE_COLORS: Record<SidebarTab, string> = {
  Filter: TAB_THEMES.Filter.iconActiveClass,
  Routing: TAB_THEMES.Routing.iconActiveClass,
  RouteBuilder: TAB_THEMES.RouteBuilder.iconActiveClass,
  Settings: TAB_THEMES.Settings.iconActiveClass,
  Outliers: TAB_THEMES.Outliers.iconActiveClass,
  SearchCaseIds: TAB_THEMES.SearchCaseIds.iconActiveClass,
};


// Inner component that uses hooks (must be inside Providers)
function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [isSidebarCollapsed, setIsSidebarCollapsed]= useState<boolean>(false)
  const [isSideCardVisible, setIsSideCardVisible]= useState<boolean>(true)
  
  // Get state from stores
  const {
    filters,
    setFilters,
    isLoading,
    graphData,
    selectedNodeIds,
    selectedPathNodes,
    sidebarActiveTab,
    setSidebarActiveTab,
    startEndNodes,
    selectedColorPalette,
  } = useAppStore();
  
  const { 
    isLayoutLoading,
    allNodes,
    allEdges,
    computeLayout,
    setIsPathFinding,
  } = useGraphStore();
  
  const { reset: resetRouteBuilder } = useRouteBuilderStore();
  const variants  = useAppStore((s) => s.variants);
  const outliers  = useAppStore((s) => s.outliers);
  const allVariants = useMemo(
    () => [...(variants ?? []), ...(outliers ?? [])],
    [variants, outliers]
  );
  
  // Combined loading state
  const isAnyLoading = isLoading || isLayoutLoading;

  const onTabChange = (path:string)=>{
    if(path === pathname) {
      setIsSideCardVisible(!isSideCardVisible);
    }
    else router.push(path)
  }

  // Handler for filter updates from Navbar
  const handleFilterSubmit = useCallback((newFilters: FilterTypes) => {
    setFilters(newFilters);
  }, [setFilters]);

  useEffect(()=>{
    Object.entries(TAB_THEMES).forEach(([key, value]) => {
      if(value.path === pathname) {
        setSidebarActiveTab(key as SidebarTab)
        // Toggle pathfinding mode based on whether we're on the Routing tab
        setIsPathFinding(key === "Routing")
        // Reset route builder when navigating away
        if (key !== "RouteBuilder") resetRouteBuilder();
      }
    })
  },[pathname, setSidebarActiveTab, setIsPathFinding, resetRouteBuilder])

  // Effect: Compute layout when allNodes is populated or selectedNodeIds changes
  // Note: We watch allNodes/allEdges directly (not just length) to ensure we re-compute
  // when new data is loaded, even if the node count is the same
  useEffect(() => {
    // Don't compute if there are no nodes at all
    if (allNodes.length === 0) {
      return;
    }

    // Compute layout with the current selected nodes
    computeLayout({
      graphData,
      colorPaletteKey: selectedColorPalette,
      startEndNodes: startEndNodes || { start: [], end: [] },
      filteredNodeIds: selectedNodeIds,
      filteredEdgeIds: null,
      activePathInfo: undefined,
      searchCasePathInfo: undefined,
    });
  }, [
    allNodes,  // Watch array reference, not just length
    allEdges,  // Watch array reference, not just length
    selectedNodeIds,
    selectedColorPalette,
    startEndNodes,
    computeLayout,
    graphData,
  ]);

  const sidebarFr = isSidebarCollapsed ? 1 : 3;
  const cardFr = isSideCardVisible ? 6 : 0;
  const mainFr = 24 - sidebarFr - cardFr;
  
  return (
    <div className="grid h-screen p-3 gap-3 bg-slate-50 overflow-hidden" 
    style={{
      gridTemplateColumns: `${sidebarFr}fr ${cardFr}fr ${mainFr}fr`,
      transition: "grid-template-columns 0.5s cubic-bezier(0.25, 0.8, 0.25, 1)",
    }}>
      <SideBar className="rounded-3xl h-full overflow-hidden shrink-0" onToggle={onTabChange} isCollapsed={isSidebarCollapsed} setIsCollapsed={setIsSidebarCollapsed}/>
      {/* Card Panel */}
      <div className="h-full min-w-0 overflow-hidden">
        <Card className="col-span-6 h-[calc(100vh-24px)] bg-white/80 backdrop-blur-xl border border-slate-200/60 shadow-sm rounded-3xl"
      shadow="none">

        <CardHeader className="flex gap-x-3 items-center border-b border-slate-100 py-4 px-5">
        <div className={`${TAB_ICON_COLORS[sidebarActiveTab]} p-2 rounded-xl`}>
          {TAB_ICONS[sidebarActiveTab]}
        </div>
        <p className={`text-lg font-bold ${TAB_TITLE_COLORS[sidebarActiveTab]}`}>
          {TAB_TITLES[sidebarActiveTab]}
        </p>
        
      </CardHeader>
      <CardBody className="text-right p-0 overflow-hidden">
        <div className="h-full w-full overflow-y-auto px-4 py-2 scrollbar-hide">
          {children}
        </div>
      </CardBody>
      </Card>
      </div>
      
      <main className="flex flex-col gap-y-4 items-center justify-center relative min-w-0 overflow-hidden">
        <Navbar 
          onFilterUpdate={handleFilterSubmit} 
          currentFilters={filters}
          isLoading={isAnyLoading}
        />
        <div className="w-full h-[calc(100vh-24px)] bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden relative">
          {/* Loading State */}
          {isAnyLoading && <GraphLoadingState />}

          {/* Node Selection State: Filter tab — data loaded, waiting for node pick */}
          {!isAnyLoading &&
            graphData &&
            selectedNodeIds.size === 0 &&
            selectedPathNodes.size === 0 &&
            sidebarActiveTab !== "SearchCaseIds" &&
            sidebarActiveTab !== "Outliers" &&
            sidebarActiveTab !== "Routing" &&
            sidebarActiveTab !== "RouteBuilder" && (
              <GraphDataReadyState activeTab={sidebarActiveTab} />
            )}

          {/* Data-Ready Waiting States: data loaded but user hasn't made a selection yet */}
          {/* Routing: wait for path selection | Outliers: wait for variant selection | SearchCaseIds: wait for case search */}
          {!isAnyLoading &&
            graphData &&
            selectedPathNodes.size === 0 &&
            (sidebarActiveTab === "Routing" ||
              sidebarActiveTab === "Outliers" ||
              sidebarActiveTab === "SearchCaseIds") && (
              <GraphDataReadyState activeTab={sidebarActiveTab} />
            )}

          {/* Graph Visualization — hidden on RouteBuilder (Sankey takes over) */}
          {!isAnyLoading &&
            graphData &&
            sidebarActiveTab !== "RouteBuilder" &&
            (selectedNodeIds.size > 0 ||
              selectedPathNodes.size > 0) && (
              <Graph
                className="w-full h-full bg-slate-50"
              />
            )}


          {/* ── Route Builder Sankey Flow — only when data is loaded ── */}
          {sidebarActiveTab === "RouteBuilder" && graphData && (
            <SankeyFlow
              allVariants={allVariants}
              allNodes={allNodes}
            />
          )}

          {/* Empty State: No data yet — shown for all tabs including RouteBuilder */}
          {!isAnyLoading && !graphData && (
            <GraphEmptyState activeTab={sidebarActiveTab} />
          )}
        </div>
      </main>
    </div>
  );
}

// Root layout wraps content with Providers
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <body
        className={`antialiased ${Vazir.className} h-screen overflow-hidden`}
      >
        <Providers>
          <LayoutContent>{children}</LayoutContent>
        </Providers>
      </body>
    </html>
  );
}

