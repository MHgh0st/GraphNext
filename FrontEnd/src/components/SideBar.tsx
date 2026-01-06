'use client'

/**
 * @component SideBar
 * @module components/SideBar
 */

import { memo, useState } from "react";
import { Tooltip } from "@heroui/tooltip";
import { Button } from "@heroui/button";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";

import type { SidebarTab } from "../types/types";
import { TAB_THEMES } from "../constants/tabThemes";
import { usePathname } from 'next/navigation';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface SideBarProps {
  className?: string;
  onToggle: (path: string)=> void
  isCollapsed: boolean;
  setIsCollapsed: (isCollapsed: boolean) => void;
}

interface SideBarButtonProps {
  title: string;
  Icon: LucideIcon;
  name: SidebarTab;
  isActive: boolean;
  isCollapsed: boolean;
  activeClass: string;
  indicatorClass: string;
  iconActiveClass: string;
  onClick: (path: string) => void;
  path: string
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const SideBarButton = memo(function SideBarButton({
  title,
  Icon,
  name,
  isActive,
  isCollapsed,
  activeClass,
  indicatorClass,
  iconActiveClass,
  path,
  onClick,
}: SideBarButtonProps): React.ReactElement {

  const buttonContent = (
    <div className="relative w-full">
      {/* Background Animation Layer */}
      {isActive && (
        <motion.div
          layoutId="activeTabBackground"
          className={`absolute inset-0 rounded-xl ${activeClass.split(" ")[0]} ${activeClass.split(" ")[2] || ""}`} // فقط bg و shadow رو برمی‌داریم
          initial={false}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}

      <Button
        onPress={()=>onClick(path)}
        variant="light"
        radius="lg"
        size="lg"
        disableAnimation={true} // انیمیشن دکمه معمولی رو غیرفعال می‌کنیم تا با موشن تداخل نکنه
        className={`
          group relative w-full flex items-center gap-3 px-3 z-10
          hover:bg-transparent data-[hover=true]:bg-transparent
          ${isCollapsed ? "justify-center min-w-0 px-0" : "justify-start"}
          ${!isActive && "text-slate-500 hover:text-slate-700"}
          ${isActive ? activeClass.split(" ").filter(c => c.startsWith("text-")).join(" ") : ""} 
        `}
      >
        {/* Active Indicator (Bar or Dot) */}
        {isActive && (
          <motion.span
            layoutId="activeTabIndicator"
            className={`absolute rounded-full shadow-sm z-20 ${indicatorClass}
              ${
                isCollapsed
                  ? "right-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5"
                  : "right-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-l-full"
              }
            `}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        )}

        {/* Icon */}
        <div className={`relative shrink-0 z-20 transition-colors duration-200`}>
          <Icon
            size={22}
            strokeWidth={isActive ? 2.5 : 1.5}
            className={`${isActive ? "" : "group-hover:scale-110 transition-transform duration-200"}`}
          />
        </div>

        {/* Label with AnimatePresence */}
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.span
              initial={{ opacity: 0, x: -10, width: 0 }}
              animate={{ opacity: 1, x: 0, width: "auto" }}
              exit={{ opacity: 0, x: -10, width: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className={`text-[11px] font-vazir tracking-wide whitespace-nowrap z-20 overflow-hidden ${isActive ? "font-bold" : "font-medium"}`}
            >
              {title}
            </motion.span>
          )}
        </AnimatePresence>
      </Button>
    </div>
  );

  if (isCollapsed) {
    return (
      <Tooltip
        content={title}
        placement="left"
        className="text-xs font-vazir text-slate-700 font-bold px-3 py-1.5"
        closeDelay={0}
        radius="md"
        showArrow
        offset={15}
      >
        <div className="w-full flex justify-center">{buttonContent}</div>
      </Tooltip>
    );
  }

  return buttonContent;
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function SideBar({
  className = "",
  onToggle,
  isCollapsed,
  setIsCollapsed
}: SideBarProps): React.ReactElement {
  const pathname = usePathname();
  const tabsList = Object.entries(TAB_THEMES).map(([key, theme]) => ({
    name: key as SidebarTab,
    ...theme,
  }));  

  // متغیرهای انیمیشن کانتینر اصلی
  const sidebarVariants = {
    expanded: { width: "16rem" }, // w-64
    collapsed: { width: "5rem" },  // w-20
  };

  return (
    <motion.aside
      className={`
        ${className}
        h-full flex flex-col gap-y-2 px-2 py-4
        bg-white/80 backdrop-blur-xl border-l border-slate-200/80
        shadow-[-4px_0_20px_-10px_rgba(0,0,0,0.05)]
        overflow-hidden z-50
      `}
      initial={false}
      animate={isCollapsed ? "collapsed" : "expanded"}
      variants={sidebarVariants}
      transition={{ type: "spring", stiffness: 300, damping: 30, mass: 0.8 }}
    >
      {/* Header */}
      <div className={`flex mb-2 items-center transition-all duration-300 ${isCollapsed ? "justify-center" : "justify-between px-1"}`}>
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2 overflow-hidden"
            >
              
              <p className="font-extrabold text-sm text-slate-800 text-nowrap tracking-tight">
                سامانه فرآیندکاوی
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <Button
          isIconOnly
          variant="light"
          radius="lg"
          size="sm"
          onPress={() => setIsCollapsed(!isCollapsed)}
          className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 min-w-8 w-8 h-8 shrink-0"
        >
          {isCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </Button>
      </div>

      {/* Divider */}
      <motion.div
        className="mb-2 mx-auto bg-slate-200 rounded-full h-[1px]"
        animate={{ width: isCollapsed ? "1rem" : "100%" }}
        transition={{ duration: 0.3 }}
      />

      {/* Navigation tabs */}
      <nav className="flex flex-col gap-1.5 w-full">
        <LayoutGroup>
          {tabsList.map((tab) => (
              <SideBarButton
              path={tab.path}
              key={tab.name}
              name={tab.name}
              title={tab.title}
              Icon={tab.icon}
              activeClass={tab.activeClass}
              indicatorClass={tab.indicatorClass}
              iconActiveClass={tab.iconActiveClass}
              isActive={pathname === tab.path}
              isCollapsed={isCollapsed}
              onClick={onToggle}
            />
          ))}
        </LayoutGroup>
      </nav>
    </motion.aside>
  );
}

export default memo(SideBar);