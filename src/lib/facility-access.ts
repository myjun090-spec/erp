import "server-only";

export async function getFacilityAccessScope(params: {
  email: string;
  role: string;
}): Promise<{ allowAll: boolean; allowedFacilityIds?: string[] }> {
  if (params.role === "platform_admin" || params.role === "executive") {
    return { allowAll: true };
  }

  const { getMongoDb } = await import("@/lib/mongodb");
  const db = await getMongoDb();
  const user = await db.collection("users").findOne({ email: params.email });

  if (!user) return { allowAll: false, allowedFacilityIds: [] };

  const facilityIds: string[] = [];

  if (user.defaultFacilityId) facilityIds.push(String(user.defaultFacilityId));

  if (Array.isArray(user.facilityAssignments)) {
    for (const a of user.facilityAssignments) {
      if (a.facilityId) facilityIds.push(String(a.facilityId));
    }
  }

  return { allowAll: false, allowedFacilityIds: [...new Set(facilityIds)] };
}
