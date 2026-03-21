import { Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatIntegerDisplay } from "@/lib/number-input";
import type { AuditLogRecord } from "@/lib/platform-catalog";

type AdminAuditLogPanelProps = {
  auditLogs: AuditLogRecord[];
};

export function AdminAuditLogPanel({ auditLogs }: AdminAuditLogPanelProps) {
  const warningCount = auditLogs.filter((log) => log.result !== "success").length;

  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold tracking-[0.16em] uppercase text-[color:var(--text-muted)]">
            Audit Log
          </div>
          <h3 className="mt-2 text-lg font-semibold text-[color:var(--text)]">
            최근 운영 로그
          </h3>
          <p className="mt-2 text-sm leading-7 text-[color:var(--text-muted)]">
            감사 로그는 인증, 정책 변경, 배정 수정 같은 운영 이벤트를 현재
            리스트 아래에서 바로 확인하는 영역입니다.
          </p>
        </div>
        <StatusBadge
          label={warningCount > 0 ? `${formatIntegerDisplay(warningCount)}건 주의` : "정상"}
          tone={warningCount > 0 ? "warning" : "success"}
        />
      </div>

      <div className="mt-5 grid gap-3">
        {auditLogs.map((log) => (
          <div
            key={log.id}
            className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-muted)] px-4 py-4"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-[color:var(--text)]">
                {log.eventCode}
              </div>
              <StatusBadge
                label={log.result}
                tone={log.result === "success" ? "success" : "warning"}
              />
            </div>
            <div className="mt-2 text-sm leading-7 text-[color:var(--text-muted)]">
              {log.actor} · {log.resource}
            </div>
            <div className="mt-2 text-xs text-[color:var(--text-muted)]">
              {log.route} · {log.ipAddress} · {log.occurredAt}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
