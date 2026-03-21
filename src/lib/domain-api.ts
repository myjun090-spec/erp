export type DomainApiSource = "database" | "empty";

export type UserSnapshot = {
  id: string;
  name: string;
  email?: string;
  orgUnitCode?: string;
  orgUnitName?: string;
};

export type EntitySnapshot = {
  id: string;
  code: string;
  name: string;
};

export type DocumentRef = {
  id: string;
  code: string;
  title: string;
  href?: string;
};

export type DomainApiListMeta = {
  total: number;
  page?: number;
  pageSize?: number;
  defaultProjectId?: string | null;
};

export type DomainApiSuccessEnvelope<T> = {
  ok: true;
  source: DomainApiSource;
  data: T;
  meta?: DomainApiListMeta;
};

export type DomainApiErrorEnvelope = {
  ok: false;
  message: string;
  code?: string;
  details?: Record<string, unknown>;
};

export type DomainMutationResult = {
  ok: true;
  action: string;
  affectedCount: number;
  targetIds: string[];
};

export type BulkActionRequest = {
  action: string;
  targetIds: string[];
  actorSnapshot?: UserSnapshot;
  reason?: string;
};
