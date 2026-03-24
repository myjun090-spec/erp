"use client";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";

const faqItems = [
  { q: "복무 규정은 어디서 확인하나요?", a: "관리자 > 정책 관리에서 복무 관련 정책을 확인할 수 있습니다." },
  { q: "사례관리 절차는 어떻게 되나요?", a: "접수 → 욕구사정 → 사례계획 수립 → 서비스 제공/연계 → 중간평가 → 사례종결 순으로 진행합니다." },
  { q: "후원금 영수증은 어떻게 발급하나요?", a: "발급/기안 메뉴에서 후원금영수증 템플릿을 선택하여 발급할 수 있습니다." },
  { q: "보조금 정산 보고는 언제 하나요?", a: "분기 종료 후 15일 이내입니다. 재무 > 보조금 메뉴에서 일정을 확인하세요." },
  { q: "자원봉사 시간 인증은 어떻게 하나요?", a: "후원/봉사 > 봉사시간 메뉴에서 등록하고 담당자가 확인하면 1365 포털과 연동됩니다." },
  { q: "전자결재 결재선은 어떻게 설정하나요?", a: "문서유형에 따라 기본 결재선(주임→팀장→센터장)이 자동 설정됩니다." },
  { q: "시설 예약은 어떻게 하나요?", a: "일정관리에서 새 일정 등록 시 장소를 선택하면 됩니다." },
];

export default function AiAssistantPage() {
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "system"; text: string }[]>([]);
  const handleSearch = () => {
    if (!query.trim()) return;
    const q = query.trim().toLowerCase();
    setMessages(prev => [...prev, { role: "user", text: query }]);
    const match = faqItems.find(f => q.split(" ").some(w => f.q.includes(w) || f.a.includes(w)));
    setMessages(prev => [...prev, { role: "system", text: match ? match.a : "관련 정보를 찾지 못했습니다." }]);
    setQuery("");
  };
  return (
    <>
      <PageHeader eyebrow="분석" title="AI 도우미" description="업무 매뉴얼과 규정을 검색합니다." />
      <Panel className="flex flex-col min-h-[500px]">
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (<div className="space-y-2"><p className="text-sm text-[color:var(--text-secondary)]">자주 묻는 질문:</p>{faqItems.map((f, i) => (<button key={i} onClick={() => setQuery(f.q)} className="block w-full text-left rounded-lg border border-[color:var(--border)] p-3 text-sm hover:bg-[color:var(--surface)]">{f.q}</button>))}</div>)}
          {messages.map((m, i) => (<div key={i} className={"flex " + (m.role === "user" ? "justify-end" : "justify-start")}><div className={"max-w-[80%] rounded-lg px-4 py-2 text-sm " + (m.role === "user" ? "bg-[color:var(--primary)] text-white" : "bg-[color:var(--surface)]")}>{m.text}</div></div>))}
        </div>
        <div className="border-t border-[color:var(--border)] p-4 flex gap-2">
          <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleSearch(); }} placeholder="질문을 입력하세요..." className="flex-1 rounded-lg border border-[color:var(--border)] px-4 py-2 text-sm" />
          <button onClick={handleSearch} className="rounded-lg bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white">검색</button>
        </div>
      </Panel>
    </>
  );
}