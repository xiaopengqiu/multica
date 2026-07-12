import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@multica/core/i18n/react";
import { autopilotKeys } from "@multica/core/autopilots/queries";
import type { Autopilot, AutopilotTrigger, GetAutopilotResponse } from "@multica/core/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import enAutopilots from "../../locales/en/autopilots.json";
import { AutopilotDetailPage } from "./autopilot-detail-page";

const mockUpdateTrigger = vi.hoisted(() => vi.fn());
const mockDeleteTrigger = vi.hoisted(() => vi.fn());
const mockRotateToken = vi.hoisted(() => vi.fn());

vi.mock("@multica/core/hooks", () => ({
  useWorkspaceId: () => "ws-1",
}));

vi.mock("@multica/core/paths", () => ({
  useWorkspacePaths: () => ({
    autopilots: () => "/acme/autopilots",
    issueDetail: (id: string) => `/acme/issues/${id}`,
  }),
}));

vi.mock("@multica/core/workspace/hooks", () => ({
  useActorName: () => ({
    getActorName: () => "Helper",
  }),
}));

vi.mock("../../navigation", () => ({
  AppLink: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
  useNavigation: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("../../editor", () => ({
  ReadonlyContent: ({ content }: { content: string }) => <div>{content}</div>,
}));

vi.mock("../../common/actor-avatar", () => ({
  ActorAvatar: () => <span data-testid="actor-avatar" />,
}));

vi.mock("../../common/task-transcript", () => ({
  TranscriptButton: () => null,
}));

vi.mock("./webhook-deliveries-section", () => ({
  WebhookDeliveriesSection: () => null,
}));

vi.mock("./autopilot-dialog", () => ({
  AutopilotDialog: () => null,
}));

vi.mock("@multica/core/api", () => ({
  api: {
    getBaseUrl: () => "https://api.example.test",
  },
}));

vi.mock("@multica/core/autopilots/mutations", () => ({
  useUpdateAutopilot: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteAutopilot: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useTriggerAutopilot: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateAutopilotTrigger: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateAutopilotTrigger: () => ({ mutateAsync: mockUpdateTrigger, isPending: false }),
  useDeleteAutopilotTrigger: () => ({ mutateAsync: mockDeleteTrigger, isPending: false }),
  useRotateAutopilotTriggerWebhookToken: () => ({ mutateAsync: mockRotateToken, isPending: false }),
}));

const TEST_RESOURCES = {
  en: { autopilots: enAutopilots },
};

function makeAutopilot(): Autopilot {
  return {
    id: "ap-1",
    workspace_id: "ws-1",
    title: "Daily helper",
    description: "Runbook",
    assignee_type: "agent",
    assignee_id: "agent-1",
    status: "active",
    execution_mode: "create_issue",
    issue_title_template: null,
    created_by_type: "user",
    created_by_id: "user-1",
    last_run_at: null,
    created_at: "2026-07-12T00:00:00Z",
    updated_at: "2026-07-12T00:00:00Z",
  };
}

function makeTrigger(overrides: Partial<AutopilotTrigger>): AutopilotTrigger {
  return {
    id: "trigger-1",
    autopilot_id: "ap-1",
    kind: "schedule",
    enabled: true,
    cron_expression: "30 9 * * *",
    timezone: "Asia/Shanghai",
    next_run_at: null,
    webhook_token: null,
    webhook_path: null,
    webhook_url: null,
    label: "Morning",
    last_fired_at: null,
    created_at: "2026-07-12T00:00:00Z",
    updated_at: "2026-07-12T00:00:00Z",
    ...overrides,
  };
}

function renderPage(triggers: AutopilotTrigger[]) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const detail: GetAutopilotResponse = {
    autopilot: makeAutopilot(),
    triggers,
  };
  queryClient.setQueryData(autopilotKeys.detail("ws-1", "ap-1"), detail);
  queryClient.setQueryData(autopilotKeys.runs("ws-1", "ap-1"), { runs: [], total: 0 });

  return render(
    <I18nProvider locale="en" resources={TEST_RESOURCES}>
      <QueryClientProvider client={queryClient}>
        <AutopilotDetailPage autopilotId="ap-1" />
      </QueryClientProvider>
    </I18nProvider>,
  );
}

describe("AutopilotDetailPage trigger editing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateTrigger.mockResolvedValue(makeTrigger({}));
    mockDeleteTrigger.mockResolvedValue(undefined);
    mockRotateToken.mockResolvedValue(makeTrigger({}));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("opens a schedule trigger edit dialog initialized from the existing cron and timezone", async () => {
    const user = userEvent.setup();
    renderPage([makeTrigger({ cron_expression: "30 9 * * *", timezone: "Asia/Shanghai" })]);

    await user.click(screen.getByRole("button", { name: /edit schedule trigger/i }));

    const dialog = screen.getByRole("dialog", { name: "Edit trigger" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("Schedule")).toBeInTheDocument();
    expect(screen.getByLabelText("Time")).toHaveValue("09:30");
  });

  it("sends an empty label when clearing an existing schedule trigger label", async () => {
    const user = userEvent.setup();
    renderPage([makeTrigger({ label: "Morning" })]);

    await user.click(screen.getByRole("button", { name: /edit schedule trigger/i }));
    await user.clear(screen.getByLabelText("Label (optional)"));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(mockUpdateTrigger).toHaveBeenCalledWith(
        expect.objectContaining({
          autopilotId: "ap-1",
          triggerId: "trigger-1",
          enabled: true,
          cron_expression: "30 9 * * *",
          timezone: "Asia/Shanghai",
          label: "",
        }),
      );
    });
  });

  it("saves schedule edits with cron, timezone, enabled state, and touched label", async () => {
    const user = userEvent.setup();
    renderPage([makeTrigger({ label: "Morning" })]);

    await user.click(screen.getByRole("button", { name: /edit schedule trigger/i }));
    await user.clear(screen.getByLabelText("Label (optional)"));
    await user.type(screen.getByLabelText("Label (optional)"), "Updated");
    await user.click(screen.getByRole("switch", { name: "Enabled" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(mockUpdateTrigger).toHaveBeenCalledWith({
        autopilotId: "ap-1",
        triggerId: "trigger-1",
        enabled: false,
        cron_expression: "30 9 * * *",
        timezone: "Asia/Shanghai",
        label: "Updated",
      });
    });
  });

  it("does not save a schedule edit when custom cron is cleared", async () => {
    const user = userEvent.setup();
    renderPage([makeTrigger({ cron_expression: "*/15 * * * *", timezone: "UTC" })]);

    await user.click(screen.getByRole("button", { name: /edit schedule trigger/i }));
    await user.clear(screen.getByLabelText("Cron Expression"));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(mockUpdateTrigger).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Edit trigger" })).toBeInTheDocument();
  });

  it("saves webhook and api trigger edits without schedule fields", async () => {
    const user = userEvent.setup();
    const webhook = makeTrigger({
      id: "webhook-1",
      kind: "webhook",
      cron_expression: null,
      timezone: null,
      webhook_token: "awt_123",
      webhook_path: "/api/webhooks/autopilots/awt_123",
      label: "Deploy",
    });
    const apiTrigger = makeTrigger({
      id: "api-1",
      kind: "api",
      cron_expression: null,
      timezone: null,
      label: "Legacy",
    });
    renderPage([webhook, apiTrigger]);

    await user.click(screen.getByRole("button", { name: /edit webhook trigger/i }));
    await user.clear(screen.getByLabelText("Label (optional)"));
    await user.type(screen.getByLabelText("Label (optional)"), "Incoming");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await user.click(screen.getByRole("button", { name: /edit api trigger/i }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(mockUpdateTrigger).toHaveBeenNthCalledWith(1, {
      autopilotId: "ap-1",
      triggerId: "webhook-1",
      enabled: true,
      label: "Incoming",
    });
    expect(mockUpdateTrigger).toHaveBeenNthCalledWith(2, {
      autopilotId: "ap-1",
      triggerId: "api-1",
      enabled: true,
    });
  });

  it("does not open edit when webhook action controls are activated", async () => {
    const user = userEvent.setup();
    renderPage([
      makeTrigger({
        kind: "webhook",
        cron_expression: null,
        timezone: null,
        webhook_token: "awt_123",
        webhook_path: "/api/webhooks/autopilots/awt_123",
      }),
    ]);

    await user.click(screen.getByRole("button", { name: "Copy URL" }));
    await user.keyboard("{Tab}{Tab}");
    await user.keyboard("{Enter}");

    expect(screen.queryByRole("dialog", { name: "Edit trigger" })).not.toBeInTheDocument();
  });

  it("opens edit from keyboard activation on the trigger content button", async () => {
    const user = userEvent.setup();
    renderPage([makeTrigger({})]);

    const editButton = screen.getByRole("button", { name: /edit schedule trigger/i });
    editButton.focus();
    await user.keyboard("{Enter}");

    expect(within(screen.getByRole("dialog", { name: "Edit trigger" })).getByText("Schedule")).toBeInTheDocument();
  });
});
