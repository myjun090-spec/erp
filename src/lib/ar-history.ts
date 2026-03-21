import { buildActorSnapshot, toTrimmedString } from "@/lib/domain-write";

type MutableViewerProfile = {
  displayName: string;
  orgUnitName: string;
  email: string;
};

export type ArChangeHistoryEntry = {
  id: string;
  type: string;
  title: string;
  description: string;
  occurredAt: string;
  reason?: string;
  actorSnapshot: {
    userId: string;
    employeeNo: string;
    displayName: string;
    orgUnitName: string;
  };
};

function parseHistoryEntry(value: unknown, fallbackId: string): ArChangeHistoryEntry | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const actorSnapshotValue = record.actorSnapshot;
  if (!actorSnapshotValue || typeof actorSnapshotValue !== "object") {
    return null;
  }

  const actorSnapshotRecord = actorSnapshotValue as Record<string, unknown>;
  const title = toTrimmedString(record.title);
  const occurredAt = toTrimmedString(record.occurredAt);
  const type = toTrimmedString(record.type);
  if (!title || !occurredAt || !type) {
    return null;
  }

  return {
    id: toTrimmedString(record.id) || fallbackId,
    type,
    title,
    description: toTrimmedString(record.description),
    occurredAt,
    reason: toTrimmedString(record.reason),
    actorSnapshot: {
      userId: toTrimmedString(actorSnapshotRecord.userId),
      employeeNo: toTrimmedString(actorSnapshotRecord.employeeNo),
      displayName: toTrimmedString(actorSnapshotRecord.displayName),
      orgUnitName: toTrimmedString(actorSnapshotRecord.orgUnitName),
    },
  };
}

function buildFallbackHistory(doc: Record<string, unknown>) {
  const createdAt = toTrimmedString(doc.createdAt);
  const createdBy =
    doc.createdBy && typeof doc.createdBy === "object"
      ? (doc.createdBy as Record<string, unknown>)
      : null;

  if (!createdAt || !createdBy) {
    return [] as ArChangeHistoryEntry[];
  }

  return [
    {
      id: "created",
      type: "ar.created",
      title: "AR 등록",
      description: "AR 문서가 생성되었습니다.",
      occurredAt: createdAt,
      actorSnapshot: {
        userId: toTrimmedString(createdBy.userId),
        employeeNo: toTrimmedString(createdBy.employeeNo),
        displayName: toTrimmedString(createdBy.displayName),
        orgUnitName: toTrimmedString(createdBy.orgUnitName),
      },
    } satisfies ArChangeHistoryEntry,
  ];
}

export function readArChangeHistory(value: unknown, fallbackDoc: Record<string, unknown>) {
  if (!Array.isArray(value)) {
    return buildFallbackHistory(fallbackDoc);
  }

  const history = value.flatMap((item, index) => {
    const parsed = parseHistoryEntry(item, `history-${index + 1}`);
    return parsed ? [parsed] : [];
  });

  return history.length > 0 ? history : buildFallbackHistory(fallbackDoc);
}

export function buildArChangeHistoryEntry(input: {
  type: string;
  title: string;
  description: string;
  occurredAt: string;
  profile: MutableViewerProfile;
  reason?: string;
}) {
  return {
    id: `${input.type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: input.type,
    title: input.title,
    description: input.description,
    occurredAt: input.occurredAt,
    reason: toTrimmedString(input.reason),
    actorSnapshot: buildActorSnapshot(input.profile),
  } satisfies ArChangeHistoryEntry;
}
