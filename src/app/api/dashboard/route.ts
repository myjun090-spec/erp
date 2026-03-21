import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiPermission } from "@/lib/api-access";
import type { DomainApiSuccessEnvelope } from "@/lib/domain-api";
import { getMongoDb } from "@/lib/mongodb";
import type { AppRole } from "@/lib/navigation";
import { getProjectAccessScope } from "@/lib/project-access";
import {
  buildProjectFilter,
  getProjectIdFromRequest,
  normalizeProjectIds,
} from "@/lib/project-scope";
import { buildWorkspacePostDetailHref } from "@/lib/workspace-navigation";

const finalizedProjectStatuses = ["archived", "cancelled", "canceled", "closed", "completed"];
const closedNcrStatuses = ["archived", "closed", "resolved"];
const finalizedJournalStatuses = ["archived", "posted", "reversed", "cancelled", "canceled"];

type ProjectDoc = {
  _id: ObjectId;
  code?: string;
  name?: string;
  projectType?: string;
  status?: string;
  customerSnapshot?: {
    name?: string;
  } | null;
  startDate?: string;
  endDate?: string;
  updatedAt?: string;
};

type RoleScopedDoc = {
  roles?: AppRole[];
};

type WorkspacePostDoc = RoleScopedDoc & {
  id?: string;
  _id?: ObjectId;
  title?: string;
  owner?: string;
  updatedAt?: string;
  status?: string;
  kind?: string;
  href?: string;
};

type ApprovalTaskDoc = RoleScopedDoc & {
  _id?: ObjectId;
  status?: string;
};

function includesRole(record: RoleScopedDoc, role: AppRole) {
  return !record.roles || record.roles.length === 0 || record.roles.includes(role);
}

function buildProjectDocumentFilter(
  projectId: string | null,
  allowedProjectIds: string[] | null,
) {
  const normalizedAllowedProjectIds = normalizeProjectIds(allowedProjectIds);

  if (projectId) {
    if (normalizedAllowedProjectIds && !normalizedAllowedProjectIds.includes(projectId)) {
      return { _id: { $exists: false } };
    }

    if (!ObjectId.isValid(projectId)) {
      return { _id: { $exists: false } };
    }

    return { _id: new ObjectId(projectId) };
  }

  if (normalizedAllowedProjectIds) {
    const objectIds = normalizedAllowedProjectIds
      .filter((id): id is string => typeof id === "string" && ObjectId.isValid(id))
      .map((id) => new ObjectId(id));

    if (objectIds.length === 0) {
      return { _id: { $exists: false } };
    }

    return { _id: { $in: objectIds } };
  }

  return {};
}

function formatProjectPeriod(startDate?: string, endDate?: string) {
  if (startDate && endDate) {
    return `${startDate} ~ ${endDate}`;
  }

  return startDate ?? endDate ?? "-";
}

export async function GET(request: Request) {
  const auth = await requireApiPermission("dashboard.read");

  if ("error" in auth) {
    return auth.error;
  }

  try {
    const db = await getMongoDb();
    const projectId = getProjectIdFromRequest(request);
    const projectAccessScope = await getProjectAccessScope({
      email: auth.profile.email,
      role: auth.profile.role,
    });

    const projectDocumentFilter = buildProjectDocumentFilter(
      projectId,
      projectAccessScope.allowedProjectIds,
    );
    const ongoingProjectFilter = {
      ...projectDocumentFilter,
      status: { $nin: finalizedProjectStatuses },
    };

    const [
      ongoingProjectCount,
      portfolioDocs,
      openNcrCount,
      unsettledJournalCount,
      approvalTasks,
      libraryDocs,
    ] = await Promise.all([
      db.collection<ProjectDoc>("projects").countDocuments(ongoingProjectFilter),
      db
        .collection<ProjectDoc>("projects")
        .find(ongoingProjectFilter)
        .sort({ updatedAt: -1, startDate: -1, name: 1 })
        .limit(12)
        .toArray(),
      db
        .collection("ncrs")
        .countDocuments(
          buildProjectFilter(
            projectId,
            { status: { $nin: closedNcrStatuses } },
            projectAccessScope.allowedProjectIds,
          ),
        ),
      db
        .collection("journal_entries")
        .countDocuments(
          buildProjectFilter(
            projectId,
            { status: { $nin: finalizedJournalStatuses } },
            projectAccessScope.allowedProjectIds,
          ),
        ),
      db
        .collection<ApprovalTaskDoc>("approvalTasks")
        .find({}, { projection: { _id: 1, roles: 1, status: 1 } })
        .toArray(),
      db
        .collection<WorkspacePostDoc>("workspacePosts")
        .find(
          { kind: "library" },
          { projection: { id: 1, _id: 1, title: 1, owner: 1, updatedAt: 1, status: 1, href: 1, roles: 1 } },
        )
        .sort({ updatedAt: -1, title: 1 })
        .limit(12)
        .toArray(),
    ]);

    const pendingApprovalCount = approvalTasks.filter(
      (task) => includesRole(task, auth.profile.role) && task.status === "대기",
    ).length;

    const libraries = libraryDocs
      .filter((record) => includesRole(record, auth.profile.role))
      .slice(0, 3)
      .map((record, index) => {
        const postId = record.id ?? record._id?.toString() ?? `library-${index + 1}`;

        return {
          id: postId,
        title: record.title ?? "미정 자료",
        owner: record.owner ?? "ERP Platform",
        updatedAt: record.updatedAt ?? "-",
        status: record.status ?? "초안",
          href: buildWorkspacePostDetailHref("library", postId),
        };
      });

    const portfolio = portfolioDocs.map((record) => ({
      id: record._id.toString(),
      code: record.code ?? "-",
      name: record.name ?? record.code ?? "미정 프로젝트",
      customerName: record.customerSnapshot?.name ?? "-",
      projectType: record.projectType ?? "-",
      periodLabel: formatProjectPeriod(record.startDate, record.endDate),
      status: record.status ?? "-",
    }));

    return NextResponse.json({
      ok: true,
      source: "database",
      data: {
        ongoingProjectCount,
        openNcrCount,
        unsettledJournalCount,
        pendingApprovalCount,
        portfolio,
        libraries,
      },
      meta: {
        total: portfolio.length,
      },
    } satisfies DomainApiSuccessEnvelope<{
      ongoingProjectCount: number;
      openNcrCount: number;
      unsettledJournalCount: number;
      pendingApprovalCount: number;
      portfolio: typeof portfolio;
      libraries: typeof libraries;
    }>);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Unknown",
      },
      { status: 500 },
    );
  }
}
