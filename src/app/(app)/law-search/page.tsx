"use client";

import { useState, useEffect, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Panel } from "@/components/ui/panel";
import { cn } from "@/lib/cn";
import { Search, Info, Scale, ExternalLink, Filter, CheckCircle2, AlertCircle } from "lucide-react";
import { type LawSearchResult, WELFARE_LAW_MAP, type WelfareServiceCategory } from "@/lib/law-utils";

/**
 * 복지 법령 검색 페이지
 * 국가법령정보 MCP와 연계된 ERP 모듈입니다.
 */
export default function LawSearchPage() {
    const [query, setQuery] = useState("");
    const [activeCategory, setActiveCategory] = useState<string>("all");
    const [results, setResults] = useState<LawSearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const performSearch = useCallback(async (q: string, cat: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const resp = await fetch(`/api/law-search?q=${encodeURIComponent(q)}&category=${cat}`);
            const json = await resp.json();
            if (json.ok) {
                setResults(json.data.results);
            } else {
                setError(json.message || "검색 중 오류가 발생했습니다.");
            }
        } catch (e) {
            setError("서버와의 통신에 실패했습니다.");
        } finally {
            setIsLoading(false);
        }
    }, []);

    // 초기 로딩 시 전체 또는 카테고리 로딩
    useEffect(() => {
        performSearch("", activeCategory);
    }, [activeCategory, performSearch]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        performSearch(query, activeCategory);
    };

    const categories = Object.keys(WELFARE_LAW_MAP) as WelfareServiceCategory[];

    return (
        <div className="space-y-6">
            <PageHeader
                eyebrow="법률 자문"
                title="복지 법령 검색"
                description="사회복지 실천을 뒷받침하는 법적 근거와 현행 법령을 실시간으로 검색합니다."
            >
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">
                    <Scale size={14} />
                    국가법령정보 MCP 연동 활성화됨
                </div>
            </PageHeader>

            {/* 검색 및 필터 패널 */}
            <Panel className="p-1 px-1 sm:p-2">
                <div className="bg-white rounded-xl shadow-sm border border-[color:var(--border)] overflow-hidden">
                    <form onSubmit={handleSearch} className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x border-[color:var(--border)]">
                        <div className="flex-1 flex items-center px-4 py-3 gap-3">
                            <Search className="text-[color:var(--text-muted)]" size={20} />
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="법령명, 키워드(예: 아동학대 신고의무, 퇴업수당...)를 입력하세요"
                                className="w-full bg-transparent border-none outline-none text-sm placeholder:text-[color:var(--text-muted)]"
                            />
                        </div>

                        <div className="flex items-center px-4 py-2 gap-2 bg-[color:var(--background)] md:bg-transparent">
                            <Filter size={16} className="text-[color:var(--text-muted)]" />
                            <select
                                value={activeCategory}
                                onChange={(e) => setActiveCategory(e.target.value)}
                                className="bg-transparent border-none outline-none text-sm font-medium focus:ring-0 cursor-pointer py-1"
                            >
                                <option value="all">모든 카테고리</option>
                                {categories.map(cat => (
                                    <option key={cat} value={cat}>{cat}</option>
                                ))}
                            </select>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="px-8 py-3 bg-[color:var(--primary)] text-white text-sm font-bold transition-all hover:bg-[color:var(--primary-hover)] disabled:opacity-50"
                        >
                            {isLoading ? "검색 중..." : "법령 검색"}
                        </button>
                    </form>
                </div>
            </Panel>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* 결과 섹션 */}
                <div className="lg:col-span-8 space-y-4">
                    <div className="flex justify-between items-center px-2">
                        <h3 className="text-sm font-semibold text-[color:var(--text-muted)] flex items-center gap-2">
                            검색 결과 <span className="text-[color:var(--primary)]">{results.length}</span>
                        </h3>
                        {results.length > 0 && (
                            <p className="text-[10px] text-[color:var(--text-muted)]">실시간 법령 정보(v2026.03.25) 기준으로 제공됩니다.</p>
                        )}
                    </div>

                    {error && (
                        <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 flex items-center gap-3 text-sm">
                            <AlertCircle size={20} />
                            {error}
                        </div>
                    )}

                    {results.length === 0 && !isLoading && !error && (
                        <div className="flex flex-col items-center justify-center p-20 rounded-2xl border-2 border-dashed border-[color:var(--border)] text-[color:var(--text-muted)]">
                            <Search size={48} className="mb-4 opacity-20" />
                            <p className="text-sm font-medium">검색 결과가 없습니다.</p>
                            <p className="text-xs">다른 검색어 혹은 카테고리를 선택해 보세요.</p>
                        </div>
                    )}

                    {/* 결과 카드 목록 */}
                    <div className="space-y-3">
                        {results.map((law) => (
                            <Panel key={law.id} className="p-5 hover:border-[color:var(--primary)] transition-all group cursor-default">
                                <div className="flex flex-col gap-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                                                    law.relevance === 'high' ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                                                )}>
                                                    {law.category}
                                                </span>
                                                {law.relevance === 'high' && (
                                                    <span className="flex items-center gap-1 text-[10px] text-green-600 font-semibold">
                                                        <CheckCircle2 size={12} /> 최적 매칭
                                                    </span>
                                                )}
                                            </div>
                                            <h4 className="text-lg font-bold group-hover:text-[color:var(--primary)] transition-colors">
                                                {law.lawName}
                                            </h4>
                                        </div>
                                        <a
                                            href="#"
                                            className="p-2 rounded-lg hover:bg-[color:var(--background)] text-[color:var(--text-muted)] hover:text-[color:var(--primary)] transition-all"
                                            title="국가법령정보센터에서 확인"
                                            onClick={(e) => e.preventDefault()}
                                        >
                                            <ExternalLink size={18} />
                                        </a>
                                    </div>

                                    <div className="p-3 rounded-lg bg-[color:var(--background)] border border-[color:var(--border)] border-opacity-50">
                                        <p className="text-sm leading-relaxed text-[color:var(--text)]">
                                            {law.summary}
                                        </p>
                                    </div>

                                    <div className="space-y-2">
                                        <p className="text-[10px] font-bold text-[color:var(--text-muted)] uppercase tracking-widest flex items-center gap-2">
                                            핵심 조문 근거
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                            {law.keyArticles.map((art, i) => (
                                                <span key={i} className="px-2.5 py-1 rounded bg-white border border-[color:var(--border)] text-[11px] font-medium shadow-sm">
                                                    {art}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </Panel>
                        ))}
                    </div>
                </div>

                {/* 사이드바 - 유용한 정보 */}
                <div className="lg:col-span-4 space-y-6">
                    <Panel className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-100">
                        <div className="flex items-center gap-2 mb-3 text-blue-800">
                            <Info size={18} />
                            <h5 className="font-bold text-sm">법률 검색 팁</h5>
                        </div>
                        <ul className="space-y-3">
                            {[
                                { t: "구체적 행위 검색", c: "'신고의무', '인력기준' 처럼 구체적인 단어로 검색하세요." },
                                { t: "3단 법령 확인", c: "법-시행령-시행규칙을 함께 확인하여 세부 기준을 놓치지 마세요." },
                                { t: "지자체 조례", c: "복지 서비스는 지자체별 조례가 다를 수 있으니 주의가 필요합니다." }
                            ].map((tip, i) => (
                                <li key={i} className="text-xs">
                                    <span className="block font-bold text-blue-900 mb-0.5">{tip.t}</span>
                                    <p className="text-blue-700 opacity-80">{tip.c}</p>
                                </li>
                            ))}
                        </ul>
                    </Panel>

                    <Panel className="p-4">
                        <h5 className="font-bold text-sm mb-4">자주 확인하는 법령</h5>
                        <div className="flex flex-col gap-2">
                            {[
                                "사회복지사업법",
                                "국민기초생활보장법",
                                "아동복지법",
                                "노인복지법",
                                "장애인복지법",
                                "사회복지시설 재무회계규칙"
                            ].map((name) => (
                                <button
                                    key={name}
                                    onClick={() => {
                                        setQuery(name);
                                        performSearch(name, "all");
                                    }}
                                    className="w-full text-left px-3 py-2 rounded-lg border border-[color:var(--border)] text-xs font-medium hover:bg-[color:var(--selected)] hover:border-[color:var(--primary)] transition-all flex justify-between items-center group"
                                >
                                    {name}
                                    <Search size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                                </button>
                            ))}
                        </div>
                    </Panel>
                </div>
            </div>
        </div>
    );
}
