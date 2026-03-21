import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import {
  requireApiActionPermission,
  requireApiPermission,
} from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";
import { buildActorSnapshot } from "@/lib/domain-write";

type OpportunityProposal = {
  id: string;
  version: string;
  submittedAt: string;
  result: string;
};

type OpportunityHistoryEntry = {
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

function toTrimmedString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseProposal(
  value: unknown,
  fallbackId: string,
): OpportunityProposal | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const version = toTrimmedString(record.version);
  const submittedAt = toTrimmedString(record.submittedAt);

  if (!version || !submittedAt) {
    return null;
  }

  return {
    id: toTrimmedString(record.id) || fallbackId,
    version,
    submittedAt,
    result: toTrimmedString(record.result) || "submitted",
  };
}

function readOpportunityProposals(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item, index) => {
    const parsed = parseProposal(item, `proposal-${index + 1}`);
    return parsed ? [parsed] : [];
  });
}

function parseHistoryEntry(value: unknown, fallbackId: string): OpportunityHistoryEntry | null {
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
            type: "opportunity.created",
            title: "사업기회 등록",
            description: "초기 사업기회 문서가 생성되었습니다.",
            occurredAt: createdAt,
            actorSnapshot: {
              userId: toTrimmedString(createdBy.userId),
              employeeNo: toTrimmedString(createdBy.employeeNo),
              displayName: toTrimmedString(createdBy.displayName),
              orgUnitName: toTrimmedString(createdBy.orgUnitName),
            },
          } satisfies OpportunityHistoryEntry,
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
            type: "opportunity.updated",
            title: "기본정보 수정",
            description: "기본정보가 갱신되었습니다.",
            occurredAt: updatedAt,
            actorSnapshot: {
              userId: toTrimmedString(updatedBy.userId),
              employeeNo: toTrimmedString(updatedBy.employeeNo),
              displayName: toTrimmedString(updatedBy.displayName),
              orgUnitName: toTrimmedString(updatedBy.orgUnitName),
            },
          } satisfies OpportunityHistoryEntry,
        ]
      : [];

  return [...updatedEntry, ...createdEntry];
}

function readOpportunityHistory(value: unknown, fallbackDoc: Record<string, unknown>) {
  if (!Array.isArray(value)) {
    return buildFallbackHistory(fallbackDoc);
  }

  const history = value.flatMap((item, index) => {
    const parsed = parseHistoryEntry(item, `history-${index + 1}`);
    return parsed ? [parsed] : [];
  });

  return history.length > 0 ? history : buildFallbackHistory(fallbackDoc);
}

function getProposalResultLabel(result: string) {
  switch (result) {
    case "shortlisted":
      return "쇼트리스트";
    case "revised":
      return "보완 요청";
    case "rejected":
      return "탈락";
    case "submitted":
    default:
      return "제출 완료";
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiPermission("business-development.read");
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const db = await getMongoDb();
    const doc = await db.collection("opportunities").findOne({ _id: new ObjectId(id) });

    if (!doc) {
      return NextResponse.json({ ok: false, message: "사업기회를 찾을 수 없습니다." }, { status: 404 });
    }

    const proposals = readOpportunityProposals(doc.proposals);
    const changeHistory = readOpportunityHistory(
      doc.changeHistory,
      doc as Record<string, unknown>,
    );

    return NextResponse.json({
      ok: true,
      source: "database",
      data: { ...doc, _id: doc._id.toString(), proposals, changeHistory },
    });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const db = await getMongoDb();
    const body = await request.json();
    const auth = await requireApiActionPermission(
      toTrimmedString(body.status) === "archived"
        ? "opportunity.archive"
        : "opportunity.update",
    );
    if ("error" in auth) return auth.error;
    const now = new Date().toISOString();
    const updateFields: Record<string, unknown> = {};
    const currentDoc = await db.collection("opportunities").findOne({ _id: new ObjectId(id) });

    if (!currentDoc) {
      return NextResponse.json({ ok: false, message: "사업기회를 찾을 수 없습니다." }, { status: 404 });
    }

    const actorSnapshot = buildActorSnapshot(auth.profile);
    const nextHistoryEntries: OpportunityHistoryEntry[] = [];
    const changedFieldLabels = new Set<string>();
    const currentProposals = readOpportunityProposals(currentDoc.proposals);
    const currentCustomerSnapshot =
      currentDoc.customerSnapshot && typeof currentDoc.customerSnapshot === "object"
        ? (currentDoc.customerSnapshot as Record<string, unknown>)
        : null;

    if ("name" in body) {
      const name = toTrimmedString(body.name);
      if (!name) {
        return NextResponse.json({ ok: false, message: "기회명은 비워둘 수 없습니다." }, { status: 400 });
      }
      updateFields.name = name;
      if (name !== toTrimmedString(currentDoc.name)) {
        changedFieldLabels.add("기회명");
      }
    }

    if ("opportunityType" in body) {
      const opportunityType = toTrimmedString(body.opportunityType);
      if (!opportunityType) {
        return NextResponse.json({ ok: false, message: "기회유형은 비워둘 수 없습니다." }, { status: 400 });
      }
      updateFields.opportunityType = opportunityType;
      if (opportunityType !== toTrimmedString(currentDoc.opportunityType)) {
        changedFieldLabels.add("기회유형");
      }
    }

    if ("stage" in body) {
      const stage = toTrimmedString(body.stage);
      if (!stage) {
        return NextResponse.json({ ok: false, message: "단계는 비워둘 수 없습니다." }, { status: 400 });
      }
      updateFields.stage = stage;
      if (stage !== toTrimmedString(currentDoc.stage)) {
        changedFieldLabels.add("단계");
      }
    }

    if ("expectedAmount" in body) {
      const expectedAmount = Number(body.expectedAmount);
      if (!Number.isFinite(expectedAmount) || expectedAmount < 0) {
        return NextResponse.json({ ok: false, message: "예상금액이 유효하지 않습니다." }, { status: 400 });
      }
      updateFields.expectedAmount = expectedAmount;
      if (expectedAmount !== Number(currentDoc.expectedAmount ?? 0)) {
        changedFieldLabels.add("예상금액");
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

    if ("expectedAwardDate" in body) {
      const expectedAwardDate = toTrimmedString(body.expectedAwardDate);
      updateFields.expectedAwardDate = expectedAwardDate;
      if (expectedAwardDate !== toTrimmedString(currentDoc.expectedAwardDate)) {
        changedFieldLabels.add("예상수주일");
      }
    }

    if ("riskSummary" in body) {
      const riskSummary = toTrimmedString(body.riskSummary);
      updateFields.riskSummary = riskSummary;
      if (riskSummary !== toTrimmedString(currentDoc.riskSummary)) {
        changedFieldLabels.add("리스크 메모");
      }
    }

    if ("proposals" in body) {
      if (!Array.isArray(body.proposals)) {
        return NextResponse.json({ ok: false, message: "제안 이력 형식이 올바르지 않습니다." }, { status: 400 });
      }

      const proposalInputs = body.proposals as unknown[];
      const proposals = proposalInputs.map((item: unknown) =>
        parseProposal(item, crypto.randomUUID()),
      );

      if (proposals.some((proposal) => proposal === null)) {
        return NextResponse.json({ ok: false, message: "제안 이력의 필수 항목을 확인해 주세요." }, { status: 400 });
      }

      updateFields.proposals = proposals;

      const nextProposals = proposals as OpportunityProposal[];
      const currentProposalMap = new Map(
        currentProposals.map((proposal) => [proposal.id, proposal]),
      );
      const nextProposalMap = new Map(
        nextProposals.map((proposal) => [proposal.id, proposal]),
      );

      for (const proposal of nextProposals) {
        const previousProposal = currentProposalMap.get(proposal.id);

        if (!previousProposal) {
          nextHistoryEntries.push({
            id: crypto.randomUUID(),
            type: "opportunity.proposal.added",
            title: "제안 이력 추가",
            description: `${proposal.version} 제안이 ${proposal.submittedAt} 기준으로 등록되었습니다.`,
            occurredAt: now,
            actorSnapshot,
          });
          continue;
        }

        if (
          previousProposal.version !== proposal.version ||
          previousProposal.submittedAt !== proposal.submittedAt ||
          previousProposal.result !== proposal.result
        ) {
          nextHistoryEntries.push({
            id: crypto.randomUUID(),
            type: "opportunity.proposal.updated",
            title: "제안 이력 수정",
            description: `${proposal.version} 제안이 ${getProposalResultLabel(proposal.result)} 상태로 갱신되었습니다.`,
            occurredAt: now,
            actorSnapshot,
          });
        }
      }

      for (const proposal of currentProposals) {
        if (!nextProposalMap.has(proposal.id)) {
          nextHistoryEntries.push({
            id: crypto.randomUUID(),
            type: "opportunity.proposal.deleted",
            title: "제안 이력 삭제",
            description: `${proposal.version} 제안이 이력에서 제거되었습니다.`,
            occurredAt: now,
            actorSnapshot,
          });
        }
      }
    }

    if ("customerPartyId" in body) {
      const customerPartyId = toTrimmedString(body.customerPartyId);

      if (!customerPartyId) {
        return NextResponse.json({ ok: false, message: "고객 ID가 유효하지 않습니다." }, { status: 400 });
      }

      if (!ObjectId.isValid(customerPartyId)) {
        return NextResponse.json({ ok: false, message: "고객 ID 형식이 올바르지 않습니다." }, { status: 400 });
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

    if ("status" in body) {
      const status = toTrimmedString(body.status);
      if (!["active", "closed", "archived"].includes(status)) {
        return NextResponse.json({ ok: false, message: "사업기회 상태가 유효하지 않습니다." }, { status: 400 });
      }
      updateFields.status = status;

      if (status !== toTrimmedString(currentDoc.status)) {
        nextHistoryEntries.unshift({
          id: crypto.randomUUID(),
          type: status === "archived" ? "opportunity.archived" : "opportunity.status.updated",
          title: status === "archived" ? "사업기회 보관" : "사업기회 상태 변경",
          description:
            status === "archived"
              ? "사업기회가 목록에서 제외되도록 보관 처리되었습니다."
              : `사업기회 상태가 ${status}(으)로 변경되었습니다.`,
          occurredAt: now,
          actorSnapshot,
        });
      }
    }

    if (changedFieldLabels.size > 0) {
      nextHistoryEntries.unshift({
        id: crypto.randomUUID(),
        type: "opportunity.updated",
        title: "기본정보 수정",
        description: `${Array.from(changedFieldLabels).join(", ")} 항목이 수정되었습니다.`,
        occurredAt: now,
        actorSnapshot,
      });
    }

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ ok: false, message: "수정 가능한 필드가 없습니다." }, { status: 400 });
    }

    const currentHistory = readOpportunityHistory(
      currentDoc.changeHistory,
      currentDoc as Record<string, unknown>,
    );

    updateFields.changeHistory = [...nextHistoryEntries, ...currentHistory];

    const result = await db.collection("opportunities").updateOne(
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

    return NextResponse.json({ ok: true, action: "update", affectedCount: result.modifiedCount, targetIds: [id] });
  } catch (error) {
    return NextResponse.json({ ok: false, message: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
