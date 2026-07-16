"use client";

import { cn } from "@multica/ui/lib/utils";
import { SidebarTrigger, useSidebar } from "@multica/ui/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@multica/ui/components/ui/tooltip";
import { detectClientType } from "@multica/core/analytics";
import { useTranslation } from "react-i18next";

function useOptionalSidebar() {
  try {
    return useSidebar();
  } catch {
    return undefined;
  }
}

function PageSidebarTrigger() {
  const sidebar = useOptionalSidebar();
  const { t } = useTranslation("ui");

  if (detectClientType() === "desktop" || !sidebar) return null;

  const sidebarOpen = sidebar.isMobile ? sidebar.openMobile : sidebar.state === "expanded";

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <SidebarTrigger
            variant={sidebarOpen ? "secondary" : "ghost"}
            className={cn("mr-2", !sidebarOpen && "text-muted-foreground")}
          />
        }
      />
      <TooltipContent side="bottom">{t(($) => $.toggle_sidebar)}</TooltipContent>
    </Tooltip>
  );
}

interface PageHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function PageHeader({ children, className }: PageHeaderProps) {
  return (
    <div className={cn("flex h-12 shrink-0 items-center border-b px-4", className)}>
      <PageSidebarTrigger />
      {children}
    </div>
  );
}
