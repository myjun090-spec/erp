import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { requireApiActionPermission } from "@/lib/api-access";
import { buildActorSnapshot } from "@/lib/domain-write";
import { getMongoDb } from "@/lib/mongodb";
import type { BulkActionRequest } from "@/lib/domain-api";
import type { KnownPermissionCode } from "@/lib/permission-catalog";

const actionPermissionMap: Record<string, KnownPermissionCode> = {
  activate: "client.update",
  deactivate: "client.update",
  archive: "client.archive",
};

const actionStatusMap: Record<string, string> = {
  activate: "active",
  deactivate: "inactive",
  archive: "inactive",
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BulkActionRequest;
    const { action, targetIds } = body;

    const permission = actionPermissionMap[action];
    if (!permission) {
      return NextResponse.json(
        { ok: false, message: `지원하지 않는 액션입니다: ${action}` },
        { status: 400 },
      );
    }

    const auth = await requireApiActionPermission(permission);
    if ("error" in auth) return auth.error;

    if (!Array.isArray(targetIds) || targetIds.length === 0) {
      return NextResponse.json(
        { ok: false, message: "대상을 선택해 주세요." },
        { status: 400 },
      );
    }

    const objectIds = targetIds.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
    if (objectIds.length === 0) {
      return NextResponse.json(
        { ok: false, message: "유효한 대상이 없습니다." },
        { status: 400 },
      );
    }

    const db = await getMongoDb();
    const now = new Date().toISOString();
    const nextStatus = actionStatusMap[action];

    const result = await db.collection("clients").updateMany(
      { _id: { $in: objectIds } },
      {
        $set: {
          status: nextStatus,
          updatedAt: now,
          updatedBy: buildActorSnapshot(auth.profile),
        },
        $inc: { documentVersion: 1 },
      },
    );

    return NextResponse.json({
      ok: true,
      action,
      affectedCount: result.modifiedCount,
      targetIds: targetIds,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
