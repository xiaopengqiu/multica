import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DesktopShell } from "./desktop-layout";

const mocks = vi.hoisted(() => ({
  sidebar: {
    state: "expanded" as "expanded" | "collapsed",
    isMobile: false,
    openMobile: false,
    toggleSidebar: vi.fn(),
  },
}));

vi.mock("@/hooks/use-tab-history", () => ({
  useTabHistory: () => ({
    canGoBack: false,
    canGoForward: false,
    goBack: vi.fn(),
    goForward: vi.fn(),
  }),
}));
vi.mock("@/hooks/use-tab-sync", () => ({ useActiveTitleSync: vi.fn() }));
vi.mock("@/stores/tab-store", () => ({
  resolveRouteIcon: vi.fn(),
  useTabStore: { getState: () => ({ openTab: vi.fn(), setActiveTab: vi.fn() }) },
}));
vi.mock("@multica/views/modals/registry", () => ({ ModalRegistry: () => null }));
vi.mock("@multica/views/layout", () => ({ AppSidebar: () => null }));
vi.mock("@multica/views/search", () => ({ SearchCommand: () => null, SearchTrigger: () => null }));
vi.mock("@multica/views/chat", () => ({ ChatFab: () => null, ChatWindow: () => null }));
vi.mock("@multica/core/paths", () => ({
  WorkspaceSlugProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  paths: { workspace: (slug: string) => ({ inbox: () => `/${slug}/inbox` }) },
  useCurrentWorkspace: () => null,
}));
vi.mock("@multica/core/platform", () => ({
  getCurrentSlug: () => "acme",
  subscribeToCurrentSlug: () => () => {},
}));
vi.mock("@multica/views/platform", () => ({ useDesktopUnreadBadge: vi.fn() }));
vi.mock("@/platform/navigation", () => ({
  DesktopNavigationProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("./tab-bar", () => ({ TabBar: () => null }));
vi.mock("./window-overlay", () => ({ WindowOverlay: () => null }));
vi.mock("./tab-content", async () => {
  const { PageHeader } = await import("../../../../../../packages/views/layout/page-header");
  return { TabContent: () => <PageHeader>Page</PageHeader> };
});
vi.mock("@multica/ui/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ render }: { render: ReactNode }) => <>{render}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: () => "Toggle sidebar" }) }));
vi.mock("@multica/ui/components/ui/sidebar", () => ({
  SidebarProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useSidebar: () => mocks.sidebar,
  SidebarTrigger: () => (
    <button
      type="button"
      aria-label="Toggle sidebar"
      data-sidebar="trigger"
      onClick={mocks.sidebar.toggleSidebar}
    />
  ),
}));

describe("DesktopShell sidebar triggers", () => {
  beforeEach(() => {
    mocks.sidebar.state = "expanded";
    mocks.sidebar.isMobile = false;
    mocks.sidebar.openMobile = false;
    mocks.sidebar.toggleSidebar.mockReset();
    Object.defineProperty(window, "desktopAPI", {
      configurable: true,
      value: { onInboxOpen: () => () => {} },
    });
  });

  it("has no trigger while the desktop sidebar is expanded", () => {
    render(<DesktopShell />);

    expect(screen.queryByRole("button", { name: "Toggle sidebar" })).not.toBeInTheDocument();
  });

  it.each([
    ["collapsed", false],
    ["expanded", true],
  ] as const)("has one shell trigger when state=%s and mobile=%s", (state, isMobile) => {
    mocks.sidebar.state = state;
    mocks.sidebar.isMobile = isMobile;

    render(<DesktopShell />);

    const triggers = screen.getAllByRole("button", { name: "Toggle sidebar" });
    expect(triggers).toHaveLength(1);
    fireEvent.click(triggers[0]);
    expect(mocks.sidebar.toggleSidebar).toHaveBeenCalledOnce();
  });
});
