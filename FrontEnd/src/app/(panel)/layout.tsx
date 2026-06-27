'use client'

import { useState, useEffect, useCallback, useMemo } from "react";
import SideBar from "@/components/SideBar";
import { usePathname, useRouter } from "next/navigation";
import { Card, CardHeader, CardBody } from "@heroui/card";
import { TAB_THEMES } from "@/constants/tabThemes";
import { SidebarTab, FilterTypes } from "@/types/types";
import {
    LineSquiggle,
    Settings,
    RouteOff,
    FolderSearch,
    Monitor,
    GitFork,
    HelpCircle,
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
    Guide: "راهنمای سامانه",
};


const TAB_ICONS: Record<SidebarTab, React.ReactNode> = {
    Filter: <Monitor className={TAB_THEMES.Filter.iconActiveClass} />,
    Routing: <LineSquiggle className={TAB_THEMES.Routing.iconActiveClass} />,
    RouteBuilder: <GitFork className={TAB_THEMES.RouteBuilder.iconActiveClass} />,
    Settings: <Settings className={TAB_THEMES.Settings.iconActiveClass} />,
    Outliers: <RouteOff className={TAB_THEMES.Outliers.iconActiveClass} />,
    SearchCaseIds: <FolderSearch className={TAB_THEMES.SearchCaseIds.iconActiveClass} />,
    Guide: <HelpCircle className={TAB_THEMES.Guide.iconActiveClass} />,
};


const TAB_ICON_COLORS: Record<SidebarTab, string> = {
    Filter: TAB_THEMES.Filter.activeClass,
    Routing: TAB_THEMES.Routing.activeClass,
    RouteBuilder: TAB_THEMES.RouteBuilder.activeClass,
    Settings: TAB_THEMES.Settings.activeClass,
    Outliers: TAB_THEMES.Outliers.activeClass,
    SearchCaseIds: TAB_THEMES.SearchCaseIds.activeClass,
    Guide: TAB_THEMES.Guide.activeClass,
};

const TAB_TITLE_COLORS: Record<SidebarTab, string> = {
    Filter: TAB_THEMES.Filter.iconActiveClass,
    Routing: TAB_THEMES.Routing.iconActiveClass,
    RouteBuilder: TAB_THEMES.RouteBuilder.iconActiveClass,
    Settings: TAB_THEMES.Settings.iconActiveClass,
    Outliers: TAB_THEMES.Outliers.iconActiveClass,
    SearchCaseIds: TAB_THEMES.SearchCaseIds.iconActiveClass,
    Guide: TAB_THEMES.Guide.iconActiveClass,
};


// Inner component that uses hooks (must be inside Providers)
// Inner component that uses hooks (must be inside Providers)
function LayoutContent({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()
    const router = useRouter()
    const [isSidebarCollapsed, setIsSidebarCollapsed]= useState<boolean>(false)
    const [isSideCardVisible, setIsSideCardVisible]= useState<boolean>(true)

    // --- استیت‌های مربوط به تغییر عرض (Resizing) ---
    const [cardWidth, setCardWidth] = useState<number>(380); // عرض پیش‌فرض ۳۸۰ پیکسل
    const [isResizing, setIsResizing] = useState<boolean>(false);

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

    const handleFilterSubmit = useCallback((newFilters: FilterTypes) => {
        setFilters(newFilters);
    }, [setFilters]);

    useEffect(()=>{
        Object.entries(TAB_THEMES).forEach(([key, value]) => {
            if(value.path === pathname) {
                setSidebarActiveTab(key as SidebarTab)
                if (key !== "RouteBuilder") resetRouteBuilder();
            }
        })
    },[pathname, setSidebarActiveTab, resetRouteBuilder])

    useEffect(() => {
        if (allNodes.length === 0) return;
        computeLayout({
            graphData,
            colorPaletteKey: selectedColorPalette,
            startEndNodes: startEndNodes || { start: [], end: [] },
            filteredNodeIds: selectedNodeIds,
            filteredEdgeIds: null,
            activePathInfo: undefined,
            searchCasePathInfo: undefined,
        });
    }, [allNodes, allEdges, selectedNodeIds, selectedColorPalette, startEndNodes, computeLayout, graphData]);

    // --- منطق تغییر سایز (Drag to Resize) ---
    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsResizing(true);
        const startX = e.clientX;
        const startWidth = cardWidth;

        const handleMouseMove = (moveEvent: MouseEvent) => {
            // در حالت RTL وقتی ماوس به سمت چپ میره (X کمتر میشه)، عرض باید زیاد بشه
            const deltaX = startX - moveEvent.clientX;
            // تنظیم محدودیت حداقل ۲۸۰ و حداکثر ۶۰۰ پیکسل
            const newWidth = Math.min(Math.max(startWidth + deltaX, 280), 600);
            setCardWidth(newWidth);
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
    };

    // تعیین عرض نوار کناری (آیکون‌ها) به صورت ثابت
    const sidebarWidth = "max-content";
    const actualCardWidth = isSideCardVisible ? `${cardWidth}px` : "0px";

    return (
        <div
            className={`grid h-screen p-3 gap-3 bg-slate-50 overflow-hidden ${isResizing ? 'select-none cursor-col-resize' : ''}`}
            style={{
                // استفاده از مقادیر دقیق پیکسل به جای fr
                gridTemplateColumns: `${sidebarWidth} ${actualCardWidth} 1fr`,
                // در زمان کشیدن ماوس انیمیشن خاموش می‌شود تا پرش نداشته باشیم
                transition: isResizing ? "none" : "grid-template-columns 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)",
            }}
        >
            <SideBar className="rounded-3xl h-full overflow-hidden shrink-0" onToggle={onTabChange} isCollapsed={isSidebarCollapsed} setIsCollapsed={setIsSidebarCollapsed}/>

            {/* Card Panel Wrapper with Resizer */}
            <div className="relative h-full min-w-0 overflow-hidden flex">
                <Card className="flex-1 h-[calc(100vh-24px)] bg-white/80 backdrop-blur-xl border border-slate-200/60 shadow-sm rounded-3xl" shadow="none">
                    <CardHeader className="flex gap-x-3 items-center border-b border-slate-100 py-4 px-5 shrink-0">
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

                {/* --- دستگیره تغییر سایز (Resizer Handle) --- */}
                {isSideCardVisible && (
                    <div
                        onMouseDown={handleMouseDown}
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-24 cursor-col-resize group flex items-center justify-center z-10"
                    >
                        <div className={`w-1 h-full rounded-full transition-colors duration-200 ${isResizing ? 'bg-blue-500' : 'bg-slate-200 group-hover:bg-blue-300'}`} />
                    </div>
                )}
            </div>

            <main className="flex flex-col gap-y-4 items-center justify-center relative min-w-0 overflow-hidden">
                <Navbar
                    onFilterUpdate={handleFilterSubmit}
                    currentFilters={filters}
                    isLoading={isAnyLoading}
                />
                <div className="w-full h-[calc(100vh-24px)] bg-white rounded-3xl border border-slate-200/60 shadow-sm overflow-hidden relative">
                    {/* ... بقیه کدهای مربوط به گراف دقیقا مثل قبل ... */}
                    {isAnyLoading && <GraphLoadingState />}

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

                    {!isAnyLoading &&
                        graphData &&
                        selectedPathNodes.size === 0 &&
                        (sidebarActiveTab === "Routing" ||
                            sidebarActiveTab === "Outliers" ||
                            sidebarActiveTab === "SearchCaseIds") && (
                            <GraphDataReadyState activeTab={sidebarActiveTab} />
                        )}

                    {!isAnyLoading &&
                        graphData &&
                        sidebarActiveTab !== "RouteBuilder" &&
                        (selectedNodeIds.size > 0 ||
                            selectedPathNodes.size > 0) && (
                            <Graph
                                className="w-full h-full bg-slate-50"
                            />
                        )}

                    {sidebarActiveTab === "RouteBuilder" && graphData && (
                        <SankeyFlow
                            allVariants={allVariants}
                            allNodes={allNodes}
                        />
                    )}

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

            <LayoutContent>{children}</LayoutContent>

    );
}

