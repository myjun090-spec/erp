import type { AppRole } from "@/lib/navigation";
import { findAdminAuthContextByEmail } from "@/lib/admin-store";

export type ProjectAccessScope = {
  allowedProjectIds: string[] | null;
  defaultProjectId: string | null;
};

export async function getProjectAccessScope(input: {
  email: string;
  role: AppRole;
}): Promise<ProjectAccessScope> {
  if (input.role === "platform_admin" || input.role === "executive") {
    return {
      allowedProjectIds: null,
      defaultProjectId: null,
    };
  }

  const authContext = await findAdminAuthContextByEmail(input.email);
  const projectAssignments = authContext.user?.projectAssignments ?? [];

  return {
    allowedProjectIds: projectAssignments.map((assignment) => assignment.projectId),
    defaultProjectId: authContext.user?.defaultProjectId ?? null,
  };
}
