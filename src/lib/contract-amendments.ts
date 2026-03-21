export type ContractAmendment = {
  id: string;
  version: string;
  date: string;
  amount: number;
  reason: string;
};

export function parseContractAmendmentOrder(version: string) {
  const match = /(\d+)/.exec(version);
  if (!match) {
    return null;
  }

  const parsed = Number.parseInt(match[1] ?? "", 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatContractAmendmentVersion(order: number) {
  return `${order}차`;
}

export function getNextContractAmendmentOrder(amendments: Pick<ContractAmendment, "version">[]) {
  const parsedOrders = amendments
    .map((amendment) => parseContractAmendmentOrder(amendment.version))
    .filter((value): value is number => value !== null && Number.isFinite(value));

  if (parsedOrders.length === 0) {
    return 1;
  }

  return Math.max(...parsedOrders) + 1;
}

export function getNextContractAmendmentVersion(amendments: Pick<ContractAmendment, "version">[]) {
  return formatContractAmendmentVersion(getNextContractAmendmentOrder(amendments));
}

export function getEffectiveContractAmount(
  baseContractAmount: unknown,
  amendmentsValue: unknown,
) {
  const baseAmount = Math.max(Number(baseContractAmount) || 0, 0);

  if (!Array.isArray(amendmentsValue) || amendmentsValue.length === 0) {
    return baseAmount;
  }

  let latestOrder = 0;
  let latestAmount = baseAmount;

  for (const amendment of amendmentsValue) {
    if (!amendment || typeof amendment !== "object") {
      continue;
    }

    const record = amendment as Record<string, unknown>;
    const order = parseContractAmendmentOrder(String(record.version || ""));
    const amount = Number(record.amount);

    if (!order || !Number.isFinite(amount) || amount < 0) {
      continue;
    }

    if (order >= latestOrder) {
      latestOrder = order;
      latestAmount = amount;
    }
  }

  return latestAmount;
}
