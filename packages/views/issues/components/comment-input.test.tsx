import { forwardRef, useImperativeHandle, useRef, useState, type ReactNode } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@multica/core/i18n/react";
import enCommon from "../../locales/en/common.json";
import enIssues from "../../locales/en/issues.json";
import { CommentInput } from "./comment-input";

const TEST_RESOURCES = {
  en: { common: enCommon, issues: enIssues },
};

function I18nWrapper({ children }: { children: ReactNode }) {
  return (
    <I18nProvider locale="en" resources={TEST_RESOURCES}>
      {children}
    </I18nProvider>
  );
}

const mockSetDraft = vi.hoisted(() => vi.fn());
const mockClearDraft = vi.hoisted(() => vi.fn());

vi.mock("@multica/core/issues/stores", () => ({
  useCommentDraftStore: Object.assign(
    (selector?: (state: { setDraft: typeof mockSetDraft; clearDraft: typeof mockClearDraft }) => unknown) => {
      const state = { setDraft: mockSetDraft, clearDraft: mockClearDraft };
      return selector ? selector(state) : state;
    },
    {
      getState: () => ({
        getDraft: () => undefined,
        setDraft: mockSetDraft,
        clearDraft: mockClearDraft,
      }),
    },
  ),
}));

vi.mock("@multica/core/hooks/use-file-upload", () => ({
  useFileUpload: () => ({ uploadWithToast: vi.fn() }),
}));

vi.mock("@multica/core/api", () => ({
  api: {},
}));

vi.mock("@multica/ui/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ render }: { render: ReactNode }) => <>{render}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@multica/ui/components/common/file-upload-button", () => ({
  FileUploadButton: () => <button type="button">Upload file</button>,
}));

vi.mock("@multica/ui/components/common/submit-button", () => ({
  SubmitButton: ({ onClick, disabled, loading }: { onClick: () => void; disabled?: boolean; loading?: boolean }) => (
    <button type="button" onClick={onClick} disabled={disabled || loading}>
      Send
    </button>
  ),
}));

vi.mock("../../editor", () => {
  const ContentEditor = forwardRef(({ defaultValue, onUpdate, onSubmit, placeholder }: any, ref: any) => {
    const valueRef = useRef(defaultValue || "");
    const [value, setValue] = useState(defaultValue || "");
    useImperativeHandle(ref, () => ({
      getMarkdown: () => valueRef.current,
      setMarkdown: (markdown: string) => {
        valueRef.current = markdown;
        setValue(markdown);
        onUpdate?.(markdown);
      },
      clearContent: () => {
        valueRef.current = "";
        setValue("");
      },
      focus: vi.fn(),
      uploadFile: vi.fn(),
    }));
    return (
      <textarea
        value={value}
        onChange={(event) => {
          valueRef.current = event.target.value;
          setValue(event.target.value);
          onUpdate?.(event.target.value);
        }}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") onSubmit?.();
        }}
        placeholder={placeholder}
      />
    );
  });
  ContentEditor.displayName = "ContentEditor";
  return {
    ContentEditor,
    useFileDropZone: () => ({ isDragOver: false, dropZoneProps: {} }),
    FileDropOverlay: () => <div>Drop files</div>,
  };
});

describe("CommentInput", () => {
  beforeEach(() => {
    mockSetDraft.mockClear();
    mockClearDraft.mockClear();
  });

  it("filters and inserts selected agent skills from a slash query into the comment", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <I18nWrapper>
        <CommentInput
          issueId="issue-1"
          onSubmit={onSubmit}
          agentSkills={[
            {
              id: "skill-1",
              name: "test-driven-development",
              description: "Write the test first.",
            },
            {
              id: "skill-2",
              name: "code-review",
              description: "Review implementation quality.",
            },
          ]}
        />
      </I18nWrapper>,
    );

    await user.type(screen.getByPlaceholderText("Leave a comment..."), "Please handle this\n/review");

    expect(await screen.findByRole("button", { name: /code-review/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /test-driven-development/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /code-review/i }));
    await user.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        "Please handle this\n\nRequired skills: code-review",
        undefined,
      );
    });
  });
});
