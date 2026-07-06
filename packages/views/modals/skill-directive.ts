import type { AgentSkillSummary } from "@multica/core/types";

const TRAILING_SKILL_COMMAND_RE = /(?:^|\n)[ \t]*\/[^\s/]*[ \t]*$/;
const TRAILING_SKILL_QUERY_RE = /(?:^|\n)[ \t]*\/([^\s/]*)[ \t]*$/;

export function buildRequiredSkillDirective(skills: readonly Pick<AgentSkillSummary, "name">[]): string {
  return `Required skills: ${skills.map((skill) => skill.name).join(", ")}`;
}

export function getTrailingSkillSlashQuery(markdown: string): string | null {
  const match = markdown.match(TRAILING_SKILL_QUERY_RE);
  return match ? (match[1] ?? "").toLowerCase() : null;
}

export function filterSkillsBySlashQuery<T extends Pick<AgentSkillSummary, "name">>(
  skills: readonly T[],
  query: string,
): T[] {
  if (!query) return [...skills];
  return skills.filter((skill) => skill.name.toLowerCase().includes(query));
}

export function hasTrailingSkillSlashCommand(markdown: string): boolean {
  return getTrailingSkillSlashQuery(markdown) !== null;
}

export function replaceTrailingSkillSlashCommand(markdown: string, directive: string): string {
  const trimmed = markdown.trimEnd();
  const withoutCommand = trimmed.replace(TRAILING_SKILL_COMMAND_RE, "");
  return [withoutCommand.trimEnd(), directive].filter(Boolean).join("\n\n");
}
