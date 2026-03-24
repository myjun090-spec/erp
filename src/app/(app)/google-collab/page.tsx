"use client";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";

const services = [
  { name: "Google Drive", desc: "시설별 공유 폴더 연결 및 문서 관리", status: "설정 필요" },
  { name: "Google Calendar", desc: "일정관리 모듈과 캘린더 동기화", status: "설정 필요" },
  { name: "Google Meet", desc: "사례회의 등 화상회의 링크 생성", status: "설정 필요" },
  { name: "Google Forms", desc: "만족도조사 폼 연동", status: "설정 필요" },
];

export default function GoogleCollabPage() {
  return (
    <>
      <PageHeader eyebrow="연계" title="구글 협업" description="Google Workspace 서비스와 연동합니다." />
      <div className="grid gap-4 sm:grid-cols-2">
        {services.map(s => (<Panel key={s.name} className="p-5"><div className="font-semibold">{s.name}</div><div className="mt-1 text-sm text-[color:var(--text-secondary)]">{s.desc}</div><div className="mt-3"><span className="inline-block rounded-full bg-[color:var(--surface)] px-3 py-1 text-xs font-medium">{s.status}</span></div></Panel>))}
      </div>
    </>
  );
}