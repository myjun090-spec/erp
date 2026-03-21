import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import {
  requireApiActionPermission,
  requireApiPermission,
} from "@/lib/api-access";
import { serializeArInvoice } from "@/lib/ar-collections";
import {
  formatContractAmendmentVersion,
  getEffectiveContractAmount,
  getNextContractAmendmentOrder,
  type ContractAmendment as SharedContractAmendment,
} from "@/lib/contract-amendments";
import { buildContractBillingSummary } from "@/lib/contract-billing";
import { buildActorSnapshot } from "@/lib/domain-write";
import { getMongoDb } from "@/lib/mongodb";

type ContractAmendment = SharedContractAmendment;

type ContractHistoryEntry = {
  id: string;
  type: string;
  title: string;
  description: string;
  occurredAt: string;
  actorSnapshot: {
    userId: string;
    employeeNo: string;
    displayName: string;
    orgUnitName: string;
  };
};

const editableStatuses = new Set([
  "draft",
  "review",
  "active",
  "completed",
  "terminated",
  "archived",
]);

function toTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseAmendment(value: unknown, fallbackId: string): ContractAmendment | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const version = toTrimmedString(record.version);
  const date = toTrimmedString(record.date);
  const amount = Number(record.amount);

  if (!version || !date || !Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return {
    id: toTrimmedString(record.id) || fallbackId,
    version,
    date,
    amount,
    reason: toTrimmedString(record.reason),
  };
}

function parseAmendmentDraft(
  value: unknown,
  fallbackId: string,
): Omit<ContractAmendment, "version"> | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const date = toTrimmedString(record.date);
  const amount = Number(record.amount);

  if (!date || !Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return {
    id: toTrimmedString(record.id) || fallbackId,
    date,
    amount,
    reason: toTrimmedString(record.reason),
  };
}

function readContractAmendments(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item, index) => {
    const parsed = parseAmendment(item, `amendment-${index + 1}`);
    return parsed ? [parsed] : [];
  });
}

function parseHistoryEntry(value: unknown, fallbackId: string): ContractHistoryEntry | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const title = toTrimmedString(record.title);
  const occurredAt = toTrimmedString(record.occurredAt);
  const type = toTrimmedString(record.type);
  const description = toTrimmedString(record.description);
  const actorSnapshotValue = record.actorSnapshot;

  if (!title || !occurredAt || !type || !actorSnapshotValue || typeof actorSnapshotValue !== "object") {
    return null;
  }

  const actorSnapshotRecord = actorSnapshotValue as Record<string, unknown>;

  return {
    id: toTrimmedString(record.id) || fallbackId,
    type,
    title,
    description,
    occurredAt,
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
  const updatedAt = toTrimmedString(doc.updatedAt);
  const createdBy =
    doc.createdBy && typeof doc.createdBy === "object"
      ? (doc.createdBy as Record<string, unknown>)
      : null;
  const updatedBy =
    doc.updatedBy && typeof doc.updatedBy === "object"
      ? (doc.updatedBy as Record<string, unknown>)
      : createdBy;

  const createdEntry =
    createdAt && createdBy
      ? [
          {
            id: "created",
            type: "contract.created",
            title: "계약 등록",
            description: "초기 계약 문서가 생성되었습니다.",
            occurredAt: createdAt,
            actorSnapshot: {
              userId: toTrimmedString(createdBy.userId),
              employeeNo: toTrimmedString(createdBy.employeeNo),
              displayName: toTrimmedString(createdBy.displayName),
              orgUnitName: toTrimmedString(createdBy.orgUnitName),
            },
          } satisfies ContractHistoryEntry,
        ]
      : [];

  const updatedEntry =
    updatedAt &&
    updatedBy &&
    createdAt &&
    updatedAt !== createdAt
      ? [
          {
            id: "updated",
            type: "contract.updated",
            title: "기본정보 수정",
            description: "기본 계약 정보가 갱신되었습니다.",
            occurredAt: updatedAt,
            actorSnapshot: {
              userId: toTrimmedString(updatedBy.userId),
              employeeNo: toTrimmedString(updatedBy.employeeNo),
              displayName: toTrimmedString(updatedBy.displayName),
              orgUnitName: toTrimmedString(updatedBy.orgUnitName),
            },
          } satisfies ContractHistoryEntry,
        ]
      : [];

  return [...updatedEntry, ...createdEntry];
}

function readContractHistory(value: unknown, fallbackDoc: Record<string, unknown>) {
  if (!Array.isArray(value)) {
    return buildFallbackHistory(fallbackDoc);
  }

  const history = value.flatMap((item, index) => {
    const parsed = parseHistoryEntry(item, `history-${index + 1}`);
    return parsed ? [parsed] : [];
  });

  return history.length > 0 ? history : buildFallbackHistory(fallbackDoc);
}

function describeStatus(status: string) {
  switch (status) {
    case "draft":
      return "초안";
    case "review":
      return "검토";
    case "active":
      return "활성";
    case "completed":
      return "완료";
    case "terminated":
      return "해지";
    case "archived":
      return "보관";
    default:
      return status;
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("business-development.read");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const db = await getMongoDb();
    const doc = await db.collection("contracts").findOne({ _id: new ObjectId(id) });

    if (!doc) {
      return NextResponse.json({ ok: false, message: "계약을 찾을 수 없습니다." }, { status: 404 });
    }

    const amendments = readContractAmendments(doc.amendments);
    const changeHistory = readContractHistory(doc.changeHistory, doc as Record<string, unknown>);
    const [arInvoices, billingSummary] = await Promise.all([
      db
        .collection("ar_invoices")
        .find({ "contractSnapshot.contractId": doc._id.toString() })
        .sort({ invoiceDate: -1, createdAt: -1 })
        .toArray(),
      buildContractBillingSummary(db, doc as Record<string, unknown>),
    ]);

    return NextResponse.json({
      ok: true,
      source: "database",
      data: {
        ...doc,
        _id: doc._id.toString(),
        contractAmount: getEffectiveContractAmount(doc.contractAmount, doc.amendments),
        amendments,
        changeHistory,
        billingSummary,
        arInvoices: arInvoices.map((invoice) =>
          serializeArInvoice({ ...invoice, _id: invoice._id.toString() }),
        ),
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    if (!ObjectId.isValid(id)) {
      return NextResponse.json(
        { ok: false, message: "계약 ID 형식이 올바르지 않습니다." },
        { status: 400 },
      );
    }

    const db = await getMongoDb();
    const body = await request.json();
    const auth = await requireApiActionPermission(
      toTrimmedString(body.status) === "archived" ? "contract.archive" : "contract.update",
    );
    if ("error" in auth) return auth.error;
    const currentDoc = await db.collection("contracts").findOne({ _id: new ObjectId(id) });

    if (!currentDoc) {
      return NextResponse.json({ ok: false, message: "계약을 찾을 수 없습니다." }, { status: 404 });
    }

    const now = new Date().toISOString();
    const actorSnapshot = buildActorSnapshot(auth.profile);
    const updateFields: Record<string, unknown> = {};
    const nextHistoryEntries: ContractHistoryEntry[] = [];
    const changedFieldLabels = new Set<string>();
    const currentAmendments = readContractAmendments(currentDoc.amendments);
    const currentCustomerSnapshot =
      currentDoc.customerSnapshot && typeof currentDoc.customerSnapshot === "object"
        ? (currentDoc.customerSnapshot as Record<string, unknown>)
        : null;
    const currentProjectSnapshot =
      currentDoc.projectSnapshot && typeof currentDoc.projectSnapshot === "object"
        ? (currentDoc.projectSnapshot as Record<string, unknown>)
        : null;

    if ("contractNo" in body) {
      const contractNo = toTrimmedString(body.contractNo);
      if (!contractNo) {
        return NextResponse.json({ ok: false, message: "계약번호는 비워둘 수 없습니다." }, { status: 400 });
      }
      updateFields.contractNo = contractNo;
      if (contractNo !== toTrimmedString(currentDoc.contractNo)) {
        changedFieldLabels.add("계약번호");
      }
    }

    if ("title" in body) {
      const title = toTrimmedString(body.title);
      if (!title) {
        return NextResponse.json({ ok: false, message: "계약명은 비워둘 수 없습니다." }, { status: 400 });
      }
      updateFields.title = title;
      if (title !== toTrimmedString(currentDoc.title)) {
        changedFieldLabels.add("계약명");
      }
    }

    if ("contractType" in body) {
      const contractType = toTrimmedString(body.contractType);
      if (!contractType) {
        return NextResponse.json({ ok: false, message: "계약유형은 비워둘 수 없습니다." }, { status: 400 });
      }
      updateFields.contractType = contractType;
      if (contractType !== toTrimmedString(currentDoc.contractType)) {
        changedFieldLabels.add("계약유형");
      }
    }

    if ("customerPartyId" in body) {
      const customerPartyId = toTrimmedString(body.customerPartyId);
      if (!customerPartyId || !ObjectId.isValid(customerPartyId)) {
        return NextResponse.json({ ok: false, message: "고객 ID가 유효하지 않습니다." }, { status: 400 });
      }

      const customer = await db.collection("parties").findOne({ _id: new ObjectId(customerPartyId) });
      if (!customer) {
        return NextResponse.json({ ok: false, message: "등록 가능한 고객 정보를 찾지 못했습니다." }, { status: 400 });
      }

      updateFields.customerSnapshot = {
        partyId: customer._id.toString(),
        code: customer.code,
        name: customer.name,
        partyRoles: customer.partyRoles,
        taxId: customer.taxId || "",
      };

      if (customer._id.toString() !== toTrimmedString(currentCustomerSnapshot?.partyId)) {
        changedFieldLabels.add("고객");
      }
    }

    if ("projectId" in body) {
      const projectId = toTrimmedString(body.projectId);

      if (!projectId) {
        updateFields.projectSnapshot = null;
        if (toTrimmedString(currentProjectSnapshot?.projectId)) {
          changedFieldLabels.add("프로젝트");
        }
      } else {
        if (!ObjectId.isValid(projectId)) {
          return NextResponse.json({ ok: false, message: "프로젝트 ID가 유효하지 않습니다." }, { status: 400 });
        }

        const project = await db.collection("projects").findOne({ _id: new ObjectId(projectId) });
        if (!project) {
          return NextResponse.json({ ok: false, message: "등록 가능한 프로젝트 정보를 찾지 못했습니다." }, { status: 400 });
        }

        updateFields.projectSnapshot = {
          projectId: project._id.toString(),
          code: project.code,
          name: project.name,
          projectType: project.projectType,
        };

        if (project._id.toString() !== toTrimmedString(currentProjectSnapshot?.projectId)) {
          changedFieldLabels.add("프로젝트");
        }
      }
    }

    if ("startDate" in body) {
      const startDate = toTrimmedString(body.startDate);
      updateFields.startDate = startDate;
      if (startDate !== toTrimmedString(currentDoc.startDate)) {
        changedFieldLabels.add("시작일");
      }
    }

    if ("endDate" in body) {
      const endDate = toTrimmedString(body.endDate);
      updateFields.endDate = endDate;
      if (endDate !== toTrimmedString(currentDoc.endDate)) {
        changedFieldLabels.add("종료일");
      }
    }

    if ("contractAmount" in body) {
      const contractAmount = Number(body.contractAmount);
      if (!Number.isFinite(contractAmount) || contractAmount < 0) {
        return NextResponse.json({ ok: false, message: "계약금액이 유효하지 않습니다." }, { status: 400 });
      }
      updateFields.contractAmount = contractAmount;
      if (contractAmount !== Number(currentDoc.contractAmount ?? 0)) {
        changedFieldLabels.add("계약금액");
      }
    }

    if ("currency" in body) {
      const currency = toTrimmedString(body.currency);
      if (!currency) {
        return NextResponse.json({ ok: false, message: "통화는 비워둘 수 없습니다." }, { status: 400 });
      }
      updateFields.currency = currency;
      if (currency !== toTrimmedString(currentDoc.currency)) {
        changedFieldLabels.add("통화");
      }
    }

    if ("amendments" in body) {
      if (!Array.isArray(body.amendments)) {
        return NextResponse.json({ ok: false, message: "변경계약 이력 형식이 올바르지 않습니다." }, { status: 400 });
      }

      const amendmentInputs = body.amendments as unknown[];
      const amendmentDrafts = amendmentInputs.map((item) =>
        parseAmendmentDraft(item, crypto.randomUUID()),
      );

      if (amendmentDrafts.some((amendment) => amendment === null)) {
        return NextResponse.json(
          { ok: false, message: "변경계약 이력의 필수 항목을 확인해 주세요." },
          { status: 400 },
        );
      }

      const currentAmendmentMap = new Map(
        currentAmendments.map((amendment) => [amendment.id, amendment]),
      );
      let nextOrder = getNextContractAmendmentOrder(currentAmendments);
      const nextAmendments = (amendmentDrafts as Array<Omit<ContractAmendment, "version">>).map(
        (amendmentDraft) => {
          const previousAmendment = currentAmendmentMap.get(amendmentDraft.id);

          return {
            ...amendmentDraft,
            version: previousAmendment?.version || formatContractAmendmentVersion(nextOrder++),
          };
        },
      );
      const nextAmendmentMap = new Map(
        nextAmendments.map((amendment) => [amendment.id, amendment]),
      );

      updateFields.amendments = nextAmendments;

      for (const amendment of nextAmendments) {
        const previousAmendment = currentAmendmentMap.get(amendment.id);

        if (!previousAmendment) {
          nextHistoryEntries.push({
            id: crypto.randomUUID(),
            type: "contract.amendment.added",
            title: "변경계약 추가",
            description: `${amendment.version} 변경계약이 ${amendment.date} 기준으로 등록되었습니다.`,
            occurredAt: now,
            actorSnapshot,
          });
          continue;
        }

        if (
          previousAmendment.version !== amendment.version ||
          previousAmendment.date !== amendment.date ||
          previousAmendment.amount !== amendment.amount ||
          previousAmendment.reason !== amendment.reason
        ) {
          nextHistoryEntries.push({
            id: crypto.randomUUID(),
            type: "contract.amendment.updated",
            title: "변경계약 수정",
            description: `${amendment.version} 변경계약 정보가 갱신되었습니다.`,
            occurredAt: now,
            actorSnapshot,
          });
        }
      }

      for (const amendment of currentAmendments) {
        if (!nextAmendmentMap.has(amendment.id)) {
          nextHistoryEntries.push({
            id: crypto.randomUUID(),
            type: "contract.amendment.deleted",
            title: "변경계약 삭제",
            description: `${amendment.version} 변경계약이 이력에서 제거되었습니다.`,
            occurredAt: now,
            actorSnapshot,
          });
        }
      }
    }

    if ("status" in body) {
      const status = toTrimmedString(body.status);

      if (!editableStatuses.has(status)) {
        return NextResponse.json({ ok: false, message: "계약 상태가 유효하지 않습니다." }, { status: 400 });
      }

      updateFields.status = status;

      if (status !== toTrimmedString(currentDoc.status)) {
        nextHistoryEntries.unshift({
          id: crypto.randomUUID(),
          type: status === "archived" ? "contract.archived" : "contract.status.updated",
          title: status === "archived" ? "계약 보관" : "계약 상태 변경",
          description:
            status === "archived"
              ? "계약이 목록에서 제외되도록 보관 처리되었습니다."
              : `계약 상태가 ${describeStatus(status)}(으)로 변경되었습니다.`,
          occurredAt: now,
          actorSnapshot,
        });
      }
    }

    if (changedFieldLabels.size > 0) {
      nextHistoryEntries.unshift({
        id: crypto.randomUUID(),
        type: "contract.updated",
        title: "기본정보 수정",
        description: `${Array.from(changedFieldLabels).join(", ")} 항목이 수정되었습니다.`,
        occurredAt: now,
        actorSnapshot,
      });
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ ok: false, message: "수정 가능한 필드가 없습니다." }, { status: 400 });
    }

    const currentHistory = readContractHistory(
      currentDoc.changeHistory,
      currentDoc as Record<string, unknown>,
    );

    updateFields.changeHistory = [...nextHistoryEntries, ...currentHistory];

    const result = await db.collection("contracts").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          ...updateFields,
          updatedAt: now,
          updatedBy: actorSnapshot,
        },
        $inc: { documentVersion: 1 },
      },
    );

    return NextResponse.json({
      ok: true,
      action: "update",
      affectedCount: result.modifiedCount,
      targetIds: [id],
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
