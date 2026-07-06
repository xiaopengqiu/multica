import { describe, expect, it } from "vitest";
import {
  buildRequiredSkillDirective,
  filterSkillsBySlashQuery,
  getTrailingSkillSlashQuery,
  replaceTrailingSkillSlashCommand,
} from "./skill-directive";

describe("skill directive helpers", () => {
  it("formats selected skills as a required-skill directive", () => {
    expect(
      buildRequiredSkillDirective([
        { name: "test-driven-development" },
        { name: "code-review" },
      ]),
    ).toBe("Required skills: test-driven-development, code-review");
  });

  it("detects a trailing slash query with an optional skill name prefix", () => {
    expect(getTrailingSkillSlashQuery("Fix the login bug\n/")).toBe("");
    expect(getTrailingSkillSlashQuery("Fix the login bug\n/test")).toBe("test");
    expect(getTrailingSkillSlashQuery("Fix the login bug")).toBeNull();
  });

  it("filters skills by the trailing slash query prefix", () => {
    expect(
      filterSkillsBySlashQuery(
        [
          { name: "test-driven-development" },
          { name: "code-review" },
        ],
        "test",
      ),
    ).toEqual([{ name: "test-driven-development" }]);
  });

  it("filters skills by a continuous substring in the skill name", () => {
    expect(
      filterSkillsBySlashQuery(
        [
          { name: "test-driven-development" },
          { name: "code-review" },
        ],
        "driven",
      ),
    ).toEqual([{ name: "test-driven-development" }]);
  });

  it("replaces a trailing slash query with the directive", () => {
    expect(
      replaceTrailingSkillSlashCommand(
        "Fix the login bug\n/test",
        "Required skills: test-driven-development",
      ),
    ).toBe("Fix the login bug\n\nRequired skills: test-driven-development");
  });

  it("appends the directive when no trailing slash command is present", () => {
    expect(
      replaceTrailingSkillSlashCommand(
        "Fix the login bug",
        "Required skills: test-driven-development",
      ),
    ).toBe("Fix the login bug\n\nRequired skills: test-driven-development");
  });
});
