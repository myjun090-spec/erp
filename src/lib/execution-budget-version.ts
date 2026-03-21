const INITIAL_EXECUTION_BUDGET_VERSION = "v1.0";

type ParsedBudgetVersion = {
  major: number;
  minor: number;
};

function parseExecutionBudgetVersion(version: unknown): ParsedBudgetVersion | null {
  const trimmedVersion = typeof version === "string" ? version.trim() : "";
  const versionMatch = /^v(\d+)\.(\d+)$/i.exec(trimmedVersion);

  if (versionMatch) {
    return {
      major: Number.parseInt(versionMatch[1] ?? "1", 10),
      minor: Number.parseInt(versionMatch[2] ?? "0", 10),
    };
  }

  const legacyMatch = /(\d+)$/.exec(trimmedVersion);
  if (!legacyMatch) {
    return null;
  }

  return {
    major: Math.max(1, Number.parseInt(legacyMatch[1] ?? "1", 10)),
    minor: 0,
  };
}

export function getInitialExecutionBudgetVersion() {
  return INITIAL_EXECUTION_BUDGET_VERSION;
}

export function normalizeExecutionBudgetVersion(version: unknown) {
  const parsedVersion = parseExecutionBudgetVersion(version);

  if (!parsedVersion) {
    return INITIAL_EXECUTION_BUDGET_VERSION;
  }

  return `v${parsedVersion.major}.${parsedVersion.minor}`;
}

export function getNextExecutionBudgetVersion(version: unknown) {
  const parsedVersion = parseExecutionBudgetVersion(version) ?? {
    major: 1,
    minor: 0,
  };

  const nextMinor = parsedVersion.minor + 1;
  if (nextMinor <= 9) {
    return `v${parsedVersion.major}.${nextMinor}`;
  }

  return `v${parsedVersion.major + 1}.0`;
}
