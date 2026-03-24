import { toTrimmedString } from "@/lib/domain-write";

export type ClientSnapshot = {
  clientId: string;
  clientNo: string;
  name: string;
  birthDate: string;
  gender: string;
};

export function buildClientSnapshot(client: Record<string, unknown>): ClientSnapshot {
  return {
    clientId: String(client._id),
    clientNo: toTrimmedString(client.clientNo),
    name: toTrimmedString(client.name),
    birthDate: toTrimmedString(client.birthDate),
    gender: toTrimmedString(client.gender),
  };
}
