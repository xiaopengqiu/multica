import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { PageHeader } from "./page-header";

const mocks = vi.hoisted(() => ({
  clientType: "web" as "web" | "desktop",
  sidebar: null as null | {
    state: "expanded" | "collapsed";
    isMobile: boolean;
    openMobile: boolean;
    toggleSidebar: Mock<() => void>;
  },
}));

vi.mock("@multica/core/analytics", () => ({
  detectClientType: () => mocks.clientType,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: () => "Toggle sidebar" }),
}));

vi.mock("@multica/ui/components/ui/sidebar", () => ({
  useSidebar: () => {
    if (!mocks.sidebar) {
      throw new Error("useSidebar must be used within a SidebarProvider.");
    }
    return mocks.sidebar;
  },
  SidebarTrigger: ({
    className,
    variant,
  }: {
    className?: string;
    variant?: "ghost" | "secondary";
  }) => {
    if (!mocks.sidebar) {
      throw new Error("useSidebar must be used within a SidebarProvider.");
    }
    return (
      <button
        type="button"
        aria-label="Toggle sidebar"
        className={className}
        data-variant={variant ?? "ghost"}
        onClick={mocks.sidebar.toggleSidebar}
      />
    );
  },
}));

vi.mock("@multica/ui/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ render }: { render: ReactNode }) => <>{render}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => (
    <span data-testid="tooltip-content">{children}</span>
  ),
}));

function setSidebar(overrides: Partial<NonNullable<typeof mocks.sidebar>> = {}) {
  mocks.sidebar = {
    state: "expanded",
    isMobile: false,
    openMobile: false,
    toggleSidebar: vi.fn(),
    ...overrides,
  };
}

describe("PageHeader sidebar trigger", () => {
  beforeEach(() => {
    mocks.clientType = "web";
    setSidebar();
  });

  it.each([
    ["expanded", "secondary", false],
    ["collapsed", "ghost", true],
  ] as const)(
    "renders the web desktop %s state like the right sidebar toggle",
    (state, variant, muted) => {
      setSidebar({ state });

      render(<PageHeader>Header</PageHeader>);

      const trigger = screen.getByRole("button", { name: "Toggle sidebar" });
      expect(trigger).toHaveAttribute("data-variant", variant);
      expect(trigger).toHaveClass("mr-2");
      expect(trigger).not.toHaveClass("md:hidden");
      if (muted) expect(trigger).toHaveClass("text-muted-foreground");
      else expect(trigger).not.toHaveClass("text-muted-foreground");
      expect(screen.getAllByRole("button")).toHaveLength(1);
      expect(screen.getByTestId("tooltip-content")).toHaveTextContent("Toggle sidebar");
    },
  );

  it.each([
    [false, "ghost", true],
    [true, "secondary", false],
  ] as const)("uses openMobile=%s for the web mobile visual state", (openMobile, variant, muted) => {
    setSidebar({ state: openMobile ? "collapsed" : "expanded", isMobile: true, openMobile });

    render(<PageHeader>Header</PageHeader>);

    const trigger = screen.getByRole("button", { name: "Toggle sidebar" });
    expect(trigger).toHaveAttribute("data-variant", variant);
    if (muted) expect(trigger).toHaveClass("text-muted-foreground");
    else expect(trigger).not.toHaveClass("text-muted-foreground");
  });

  it("delegates clicks to the sidebar trigger", () => {
    render(<PageHeader>Header</PageHeader>);

    fireEvent.click(screen.getByRole("button", { name: "Toggle sidebar" }));

    expect(mocks.sidebar?.toggleSidebar).toHaveBeenCalledOnce();
  });

  it.each([
    ["expanded", false, false],
    ["collapsed", false, false],
    ["expanded", true, true],
  ] as const)("omits the shared trigger in Electron (%s, mobile=%s)", (state, isMobile, openMobile) => {
    mocks.clientType = "desktop";
    setSidebar({ state, isMobile, openMobile });

    render(<PageHeader>Header</PageHeader>);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders safely without a sidebar provider", () => {
    mocks.sidebar = null;

    render(<PageHeader>Header</PageHeader>);

    expect(screen.getByText("Header")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
