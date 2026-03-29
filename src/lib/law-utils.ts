/**
 * 복지 법령 유틸리티
 *
 * 서비스 유형별 관련 법령 매핑, 검색 결과 포맷, 법적 근거 조회 등
 * 국가법령정보 MCP 도구와 연계하여 사용합니다.
 */

// ---------------------------------------------------------------------------
// 서비스 카테고리별 관련 법령 매핑
// ---------------------------------------------------------------------------

export type WelfareLawEntry = {
  /** 법령 정식 명칭 */
  name: string;
  /** 검색 키워드 (search_law 용) */
  keyword: string;
  /** 핵심 조항 (참고용) */
  keyArticles: string[];
  /** 간략 설명 */
  summary: string;
};

export type WelfareServiceCategory =
  | "아동복지"
  | "노인복지"
  | "장애인복지"
  | "기초생활보장"
  | "긴급지원"
  | "한부모가족"
  | "다문화가족"
  | "정신건강"
  | "시설운영"
  | "개인정보"
  | "학대신고"
  | "재무회계";

export const WELFARE_LAW_MAP: Record<WelfareServiceCategory, WelfareLawEntry[]> = {
  아동복지: [
    {
      name: "아동복지법",
      keyword: "아동복지법",
      keyArticles: ["제3조(정의)", "제10조(아동정책조정위원회)", "제22조(아동학대의 금지)", "제25조(신고의무자)"],
      summary: "아동의 권리 보장, 학대 예방, 보호조치, 신고의무",
    },
    {
      name: "아동학대범죄의 처벌 등에 관한 특례법",
      keyword: "아동학대처벌법",
      keyArticles: ["제10조(신고의무와 절차)", "제46조(벌칙)"],
      summary: "아동학대범죄 처벌 특례, 신고의무자 범위 및 절차",
    },
    {
      name: "영유아보육법",
      keyword: "영유아보육법",
      keyArticles: ["제2조(정의)", "제15조(어린이집의 설치)"],
      summary: "어린이집 설치/운영, 보육 서비스 기준",
    },
  ],
  노인복지: [
    {
      name: "노인복지법",
      keyword: "노인복지법",
      keyArticles: ["제1조의2(기본이념)", "제31조(노인복지시설)", "제39조의6(신고의무)"],
      summary: "노인복지시설, 노인학대 예방, 재가/시설 급여",
    },
    {
      name: "노인장기요양보험법",
      keyword: "노인장기요양보험법",
      keyArticles: ["제2조(정의)", "제15조(등급판정)", "제23조(장기요양급여)"],
      summary: "장기요양 등급 판정, 재가/시설 급여, 수가 기준",
    },
    {
      name: "치매관리법",
      keyword: "치매관리법",
      keyArticles: ["제2조(정의)", "제11조(치매안심센터)"],
      summary: "치매 예방, 치매안심센터, 돌봄 서비스",
    },
  ],
  장애인복지: [
    {
      name: "장애인복지법",
      keyword: "장애인복지법",
      keyArticles: ["제2조(장애인의 정의)", "제32조(장애인 등록)", "제59조의4(신고의무)"],
      summary: "장애인 등록, 복지시설, 학대 신고의무",
    },
    {
      name: "장애인활동 지원에 관한 법률",
      keyword: "장애인활동지원법",
      keyArticles: ["제5조(활동지원급여)", "제16조(활동보조)"],
      summary: "활동지원 급여, 활동보조/방문간호/방문목욕",
    },
    {
      name: "발달장애인 권리보장 및 지원에 관한 법률",
      keyword: "발달장애인법",
      keyArticles: ["제2조(정의)", "제23조(개인별지원계획)"],
      summary: "발달장애인 개인별 지원계획, 주간활동/돌봄 서비스",
    },
  ],
  기초생활보장: [
    {
      name: "국민기초생활보장법",
      keyword: "국민기초생활보장법",
      keyArticles: ["제2조(정의)", "제5조(수급권자)", "제7조(급여의 종류)"],
      summary: "수급자 선정 기준, 생계/의료/주거/교육급여",
    },
    {
      name: "사회보장급여의 이용ㆍ제공 및 수급권자 발굴에 관한 법률",
      keyword: "사회보장급여법",
      keyArticles: ["제5조(신청)", "제10조(조사)"],
      summary: "사회보장급여 신청, 조사, 결정, 제공 절차",
    },
  ],
  긴급지원: [
    {
      name: "긴급복지지원법",
      keyword: "긴급복지지원법",
      keyArticles: ["제2조(정의)", "제5조(긴급지원대상자)", "제9조(긴급지원의 종류)"],
      summary: "긴급 생계/의료/주거 지원, 위기상황 요건",
    },
  ],
  한부모가족: [
    {
      name: "한부모가족지원법",
      keyword: "한부모가족지원법",
      keyArticles: ["제4조(정의)", "제5조(보호대상자)", "제12조(복지 급여)"],
      summary: "한부모가족 대상자 기준, 복지 급여, 시설 보호",
    },
  ],
  다문화가족: [
    {
      name: "다문화가족지원법",
      keyword: "다문화가족지원법",
      keyArticles: ["제2조(정의)", "제5조(다문화가족에 대한 이해증진)", "제6조(생활정보 제공)"],
      summary: "다문화가족 정의, 지원 서비스, 다문화가족지원센터",
    },
  ],
  정신건강: [
    {
      name: "정신건강증진 및 정신질환자 복지서비스 지원에 관한 법률",
      keyword: "정신건강복지법",
      keyArticles: ["제3조(정의)", "제41조(입원)", "제72조(퇴원)"],
      summary: "정신질환자 입원/퇴원, 권리 보장, 정신건강복지센터",
    },
    {
      name: "자살예방 및 생명존중문화 조성을 위한 법률",
      keyword: "자살예방법",
      keyArticles: ["제4조(자살예방정책)", "제19조(자살위험자 발견)"],
      summary: "자살예방, 자살위험자 발견 시 조치 의무",
    },
  ],
  시설운영: [
    {
      name: "사회복지사업법",
      keyword: "사회복지사업법",
      keyArticles: ["제2조(정의)", "제11조(사회복지사 자격)", "제34조(시설의 설치)"],
      summary: "사회복지시설 설치/운영, 사회복지사 자격, 비밀누설 금지",
    },
    {
      name: "사회복지시설 재무회계규칙",
      keyword: "사회복지시설 재무회계규칙",
      keyArticles: ["제6조(회계의 구분)", "제10조(예산편성)", "제20조(지출)"],
      summary: "사회복지시설 예산/결산/회계 기준, 서식",
    },
  ],
  개인정보: [
    {
      name: "개인정보보호법",
      keyword: "개인정보보호법",
      keyArticles: ["제15조(수집/이용)", "제17조(제공)", "제21조(파기)", "제23조(민감정보)"],
      summary: "개인정보 수집/이용/제공/파기 기준, 민감정보 처리",
    },
  ],
  학대신고: [
    {
      name: "아동학대범죄의 처벌 등에 관한 특례법",
      keyword: "아동학대처벌법",
      keyArticles: ["제10조(신고의무와 절차)"],
      summary: "아동학대 신고의무자, 신고 방법, 미신고 시 과태료",
    },
    {
      name: "노인복지법",
      keyword: "노인복지법 학대",
      keyArticles: ["제39조의6(신고의무)"],
      summary: "노인학대 신고의무자, 신고 절차",
    },
    {
      name: "장애인복지법",
      keyword: "장애인복지법 학대",
      keyArticles: ["제59조의4(신고의무)"],
      summary: "장애인학대 신고의무자, 신고 절차",
    },
    {
      name: "가정폭력방지 및 피해자보호 등에 관한 법률",
      keyword: "가정폭력방지법",
      keyArticles: ["제4조(신고의무)"],
      summary: "가정폭력 신고의무, 피해자 보호 조치",
    },
  ],
  재무회계: [
    {
      name: "사회복지시설 재무회계규칙",
      keyword: "사회복지시설 재무회계규칙",
      keyArticles: ["제6조(회계의 구분)", "제10조(예산편성)", "제20조(지출)", "별표"],
      summary: "사회복지시설 예산/결산 절차, 회계 서식",
    },
    {
      name: "보조금 관리에 관한 법률",
      keyword: "보조금관리법",
      keyArticles: ["제22조(보조금의 교부)", "제30조(정산)"],
      summary: "보조금 교부, 사용, 정산 기준",
    },
  ],
};

// ---------------------------------------------------------------------------
// 자주 검색하는 법령 바로가기
// ---------------------------------------------------------------------------

export type QuickLawItem = {
  label: string;
  keyword: string;
  category: WelfareServiceCategory;
};

export const QUICK_LAW_ITEMS: QuickLawItem[] = [
  { label: "사회복지사업법", keyword: "사회복지사업법", category: "시설운영" },
  { label: "국민기초생활보장법", keyword: "국민기초생활보장법", category: "기초생활보장" },
  { label: "긴급복지지원법", keyword: "긴급복지지원법", category: "긴급지원" },
  { label: "아동복지법", keyword: "아동복지법", category: "아동복지" },
  { label: "노인복지법", keyword: "노인복지법", category: "노인복지" },
  { label: "장애인복지법", keyword: "장애인복지법", category: "장애인복지" },
  { label: "아동학대처벌법", keyword: "아동학대처벌법", category: "학대신고" },
  { label: "재무회계규칙", keyword: "사회복지시설 재무회계규칙", category: "재무회계" },
];

// ---------------------------------------------------------------------------
// 검색 결과 포맷
// ---------------------------------------------------------------------------

export type LawSearchResult = {
  id: string;
  lawName: string;
  keyword: string;
  category: WelfareServiceCategory | string;
  keyArticles: string[];
  summary: string;
  relevance: "high" | "medium" | "low";
};

export type LawSearchResponse = {
  query: string;
  results: LawSearchResult[];
  suggestedTools: string[];
  timestamp: string;
};

/**
 * 검색 결과를 UI 표시용 텍스트로 포맷합니다.
 */
export function formatLawResult(result: LawSearchResult): string {
  const articles = result.keyArticles.join(", ");
  return `${result.lawName}\n핵심 조항: ${articles}\n${result.summary}`;
}

/**
 * 검색 결과 목록을 마크다운 표로 변환합니다.
 */
export function formatLawResultsAsMarkdown(results: LawSearchResult[]): string {
  if (results.length === 0) {
    return "검색 결과가 없습니다.";
  }

  const header = "| 법령명 | 핵심 조항 | 요약 | 관련도 |\n|--------|----------|------|--------|";
  const rows = results.map(
    (r) =>
      `| ${r.lawName} | ${r.keyArticles.join(", ")} | ${r.summary} | ${r.relevance} |`,
  );

  return [header, ...rows].join("\n");
}

// ---------------------------------------------------------------------------
// 서비스 유형 → 법적 근거 조회
// ---------------------------------------------------------------------------

/**
 * 서비스 유형에 대한 법적 근거 법령 목록을 반환합니다.
 * WELFARE_LAW_MAP에서 해당 카테고리의 법령을 조회합니다.
 */
export function getLawBasisForService(
  serviceType: string,
): { category: WelfareServiceCategory; laws: WelfareLawEntry[] } | null {
  // 정확한 카테고리 매칭
  const categories = Object.keys(WELFARE_LAW_MAP) as WelfareServiceCategory[];
  const exactMatch = categories.find((c) => c === serviceType);

  if (exactMatch) {
    return { category: exactMatch, laws: WELFARE_LAW_MAP[exactMatch] };
  }

  // 키워드 기반 퍼지 매칭
  const keywordMap: Record<string, WelfareServiceCategory> = {
    아동: "아동복지",
    영유아: "아동복지",
    어린이: "아동복지",
    노인: "노인복지",
    어르신: "노인복지",
    치매: "노인복지",
    장기요양: "노인복지",
    장애: "장애인복지",
    활동지원: "장애인복지",
    발달장애: "장애인복지",
    기초생활: "기초생활보장",
    수급: "기초생활보장",
    차상위: "기초생활보장",
    긴급: "긴급지원",
    위기: "긴급지원",
    한부모: "한부모가족",
    다문화: "다문화가족",
    정신건강: "정신건강",
    자살: "정신건강",
    우울: "정신건강",
    시설: "시설운영",
    운영: "시설운영",
    개인정보: "개인정보",
    학대: "학대신고",
    신고: "학대신고",
    가정폭력: "학대신고",
    재무: "재무회계",
    회계: "재무회계",
    보조금: "재무회계",
    예산: "재무회계",
  };

  for (const [keyword, category] of Object.entries(keywordMap)) {
    if (serviceType.includes(keyword)) {
      return { category, laws: WELFARE_LAW_MAP[category] };
    }
  }

  return null;
}

/**
 * 자연어 검색어에서 관련 법령 목록을 검색합니다.
 * 모든 카테고리에서 매칭되는 결과를 반환합니다.
 */
export function searchLawsByQuery(query: string): LawSearchResult[] {
  const results: LawSearchResult[] = [];
  const queryLower = query.toLowerCase();
  let idCounter = 0;

  for (const [category, laws] of Object.entries(WELFARE_LAW_MAP)) {
    for (const law of laws) {
      const nameMatch = queryLower.includes(law.name.slice(0, 4)) || law.name.includes(query);
      const keywordMatch = queryLower.includes(law.keyword.slice(0, 3));
      const summaryMatch = law.summary.split(",").some((s) => queryLower.includes(s.trim().slice(0, 3)));
      const categoryMatch = queryLower.includes(category.slice(0, 2));

      let relevance: "high" | "medium" | "low" = "low";

      if (nameMatch || keywordMatch) {
        relevance = "high";
      } else if (categoryMatch || summaryMatch) {
        relevance = "medium";
      } else {
        continue;
      }

      idCounter++;
      results.push({
        id: `law-${idCounter}`,
        lawName: law.name,
        keyword: law.keyword,
        category: category as WelfareServiceCategory,
        keyArticles: law.keyArticles,
        summary: law.summary,
        relevance,
      });
    }
  }

  // 관련도 순으로 정렬
  results.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.relevance] - order[b.relevance];
  });

  return results;
}

// ---------------------------------------------------------------------------
// 사례관리 서비스 유형 → 법적 근거 뱃지 텍스트
// ---------------------------------------------------------------------------

/**
 * 사례관리 서비스 유형(예: 돌봄등급, 소득수준)에 대한
 * 간단한 법적 근거 문구를 반환합니다.
 */
export function getLawBadgeText(serviceContext: string): string | null {
  const contextMap: Record<string, string> = {
    "기초생활": "국민기초생활보장법",
    "차상위": "국민기초생활보장법",
    "1등급": "노인장기요양보험법",
    "2등급": "노인장기요양보험법",
    "3등급": "노인장기요양보험법",
    "4등급": "노인장기요양보험법",
    "5등급": "노인장기요양보험법",
    "인지지원등급": "노인장기요양보험법",
    "아동학대": "아동학대처벌법",
    "노인학대": "노인복지법 제39조의6",
    "장애인학대": "장애인복지법 제59조의4",
    "긴급지원": "긴급복지지원법",
    "한부모": "한부모가족지원법",
    "다문화": "다문화가족지원법",
    "활동지원": "장애인활동지원법",
  };

  for (const [keyword, lawName] of Object.entries(contextMap)) {
    if (serviceContext.includes(keyword)) {
      return lawName;
    }
  }

  return null;
}
