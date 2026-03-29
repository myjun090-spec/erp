import type {
  IssueAiAnalysis,
  IssueCategory,
  IssueUrgency,
  OpsIssue,
  StaffAssignmentSuggestion,
  OpsStaff,
  StaffSkill,
} from "@/types/operations";

// ---------------------------------------------------------------------------
// Gemini API configuration
// ---------------------------------------------------------------------------

const GEMINI_API_KEY = process.env.GOOGLE_AI_API_KEY ?? "";
const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

function isGeminiConfigured() {
  return GEMINI_API_KEY.length > 0;
}

async function callGemini(prompt: string): Promise<string> {
  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

function extractJsonFromResponse(text: string): string {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();

  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) return braceMatch[0];

  return text.trim();
}

// ---------------------------------------------------------------------------
// Rule-based fallback (when Gemini API key is not configured)
// ---------------------------------------------------------------------------

function classifyCategoryByKeywords(text: string): IssueCategory {
  const lower = text.toLowerCase();
  const safetyKeywords = ["사고", "부상", "넘어", "떨어", "화재", "감전", "위험", "응급", "골절", "출혈", "안전"];
  const facilityKeywords = ["고장", "파손", "누수", "수리", "전기", "에어컨", "난방", "보일러", "엘리베이터", "조명", "시설"];
  const complainKeywords = ["불만", "컴플레인", "항의", "민원", "요청", "서비스", "불편", "소음"];
  const staffKeywords = ["직원", "근태", "갈등", "폭언", "근무태만", "지각", "결근", "인사", "직장"];

  if (safetyKeywords.some((k) => lower.includes(k))) return "안전사고";
  if (facilityKeywords.some((k) => lower.includes(k))) return "시설고장";
  if (staffKeywords.some((k) => lower.includes(k))) return "직원이슈";
  if (complainKeywords.some((k) => lower.includes(k))) return "이용자컴플레인";
  return "기타";
}

function classifyUrgencyByKeywords(text: string): IssueUrgency {
  const lower = text.toLowerCase();
  const urgentKeywords = ["긴급", "즉시", "응급", "위험", "화재", "부상", "출혈", "골절", "심각"];
  const lowKeywords = ["경미", "사소", "참고", "나중에", "여유"];

  if (urgentKeywords.some((k) => lower.includes(k))) return "긴급";
  if (lowKeywords.some((k) => lower.includes(k))) return "낮음";
  return "보통";
}

function calculateRiskLevel(category: IssueCategory, urgency: IssueUrgency): number {
  const categoryRisk: Record<IssueCategory, number> = {
    "안전사고": 4,
    "시설고장": 3,
    "직원이슈": 2,
    "이용자컴플레인": 2,
    "기타": 1,
  };
  const urgencyMultiplier: Record<IssueUrgency, number> = {
    "긴급": 1.3,
    "보통": 1.0,
    "낮음": 0.7,
  };
  return Math.min(5, Math.max(1, Math.round(categoryRisk[category] * urgencyMultiplier[urgency])));
}

function generateRecommendedAction(category: IssueCategory, urgency: IssueUrgency): string {
  if (category === "안전사고" && urgency === "긴급") {
    return "즉시 현장 확인 및 응급 조치를 실시하고, 관련 기관에 신고하십시오. 이용자 안전을 최우선으로 확보합니다.";
  }
  if (category === "안전사고") {
    return "현장 점검 및 안전조치를 실시하고, 사고 경위를 파악하여 재발 방지 대책을 수립하십시오.";
  }
  if (category === "시설고장" && urgency === "긴급") {
    return "시설 사용을 즉시 중단하고, 수리 업체에 긴급 출동을 요청하십시오. 대체 공간을 확보합니다.";
  }
  if (category === "시설고장") {
    return "시설 상태를 점검하고, 수리 일정을 조율하십시오. 필요시 이용자에게 안내합니다.";
  }
  if (category === "이용자컴플레인") {
    return "이용자의 의견을 경청하고, 담당 부서와 협의하여 개선 방안을 마련하십시오. 결과를 이용자에게 회신합니다.";
  }
  if (category === "직원이슈") {
    return "해당 직원 및 관련자의 의견을 청취하고, 인사 담당자와 협의하여 적절한 조치를 취하십시오.";
  }
  return "상황을 확인하고 적절한 담당자에게 전달하십시오.";
}

function fallbackAnalyzeIssue(title: string, description: string): IssueAiAnalysis {
  const combined = `${title} ${description}`;
  const category = classifyCategoryByKeywords(combined);
  const urgency = classifyUrgencyByKeywords(combined);
  const riskLevel = calculateRiskLevel(category, urgency);
  const recommendedAction = generateRecommendedAction(category, urgency);

  return {
    category,
    urgency,
    riskLevel,
    recommendedAction,
    summary: `[자동분석] ${category} 관련 이슈로 분류되었습니다. 긴급도: ${urgency}, 위험도: ${riskLevel}/5`,
    analyzedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Skill-to-category mapping for staff assignment
// ---------------------------------------------------------------------------

const categorySkillMap: Record<IssueCategory, StaffSkill[]> = {
  "안전사고": ["안전관리", "의료/간호", "시설관리"],
  "시설고장": ["시설관리", "IT/정보"],
  "직원이슈": ["행정", "사회복지", "상담"],
  "이용자컴플레인": ["사회복지", "상담", "프로그램운영"],
  "기타": ["행정", "사회복지"],
};

function getCurrentShiftType(): "오전" | "오후" | "야간" {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 14) return "오전";
  if (hour >= 14 && hour < 22) return "오후";
  return "야간";
}

function isStaffOnShift(staff: OpsStaff): boolean {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const currentShift = getCurrentShiftType();
  const todaySchedule = staff.schedule.find((s) => s.dayOfWeek === dayOfWeek);
  if (!todaySchedule) return false;
  return todaySchedule.shift === currentShift;
}

function fallbackAssignStaff(
  issue: Pick<OpsIssue, "title" | "description" | "aiAnalysis">,
  staffList: OpsStaff[],
): StaffAssignmentSuggestion[] {
  const category = issue.aiAnalysis?.category ?? "기타";
  const requiredSkills = categorySkillMap[category];

  return staffList
    .filter((s) => s.isActive)
    .map((staff) => {
      let matchScore = 0;
      const reasons: string[] = [];

      // Skill match (max 50 points)
      const matchedSkills = staff.skills.filter((sk) => requiredSkills.includes(sk));
      matchScore += matchedSkills.length * 20;
      if (matchedSkills.length > 0) {
        reasons.push(`필요 역량 보유: ${matchedSkills.join(", ")}`);
      }

      // On-shift bonus (20 points)
      const onShift = isStaffOnShift(staff);
      if (onShift) {
        matchScore += 20;
        reasons.push("현재 근무 중");
      }

      // Low workload bonus (max 30 points)
      const loadPenalty = Math.min(staff.currentLoad * 10, 30);
      matchScore += 30 - loadPenalty;
      if (staff.currentLoad === 0) {
        reasons.push("현재 배정 이슈 없음");
      } else {
        reasons.push(`현재 배정 이슈 ${staff.currentLoad}건`);
      }

      return {
        staffId: staff._id,
        staffName: staff.name,
        matchScore: Math.min(100, Math.max(0, matchScore)),
        reason: reasons.join(" / "),
        skills: staff.skills,
        currentLoad: staff.currentLoad,
        isOnShift: onShift,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}

// ---------------------------------------------------------------------------
// Public API functions
// ---------------------------------------------------------------------------

export async function analyzeIssue(
  title: string,
  description: string,
  imageDescription?: string,
): Promise<IssueAiAnalysis> {
  if (!isGeminiConfigured()) {
    return fallbackAnalyzeIssue(title, description);
  }

  try {
    const prompt = `당신은 사회복지시설 운영 관리 AI 전문가입니다.
다음 이슈 보고를 분석하고 JSON 형식으로 응답하세요.

## 이슈 제목
${title}

## 이슈 내용
${description}
${imageDescription ? `\n## 첨부 이미지 설명\n${imageDescription}` : ""}

## 응답 형식 (JSON만 반환하세요)
{
  "category": "안전사고" | "시설고장" | "이용자컴플레인" | "직원이슈" | "기타",
  "urgency": "긴급" | "보통" | "낮음",
  "riskLevel": 1~5 (숫자),
  "recommendedAction": "구체적인 조치 사항 (한국어)",
  "summary": "분석 요약 (한국어, 2~3문장)"
}

반드시 유효한 JSON만 반환하고, 다른 텍스트는 포함하지 마세요.`;

    const raw = await callGemini(prompt);
    const json = JSON.parse(extractJsonFromResponse(raw));

    return {
      category: json.category ?? "기타",
      urgency: json.urgency ?? "보통",
      riskLevel: Math.min(5, Math.max(1, Number(json.riskLevel) || 3)),
      recommendedAction: json.recommendedAction ?? "",
      summary: json.summary ?? "",
      analyzedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Gemini analysis failed, using fallback:", error);
    return fallbackAnalyzeIssue(title, description);
  }
}

export async function suggestStaffAssignment(
  issue: Pick<OpsIssue, "title" | "description" | "aiAnalysis">,
  staffList: OpsStaff[],
): Promise<StaffAssignmentSuggestion[]> {
  if (!isGeminiConfigured() || staffList.length === 0) {
    return fallbackAssignStaff(issue, staffList);
  }

  try {
    const staffSummary = staffList
      .filter((s) => s.isActive)
      .map((s) => ({
        id: s._id,
        name: s.name,
        skills: s.skills,
        currentLoad: s.currentLoad,
        isOnShift: isStaffOnShift(s),
        department: s.department,
      }));

    const prompt = `당신은 사회복지시설 인력 배정 AI 전문가입니다.
이슈에 가장 적합한 담당자를 추천하세요.

## 이슈 정보
- 제목: ${issue.title}
- 내용: ${issue.description}
- AI 분석 카테고리: ${issue.aiAnalysis?.category ?? "미분류"}
- 긴급도: ${issue.aiAnalysis?.urgency ?? "보통"}
- 위험도: ${issue.aiAnalysis?.riskLevel ?? 3}/5

## 가용 직원 목록
${JSON.stringify(staffSummary, null, 2)}

## 응답 형식 (JSON 배열, 적합도 순)
[
  {
    "staffId": "직원ID",
    "staffName": "직원명",
    "matchScore": 0~100,
    "reason": "추천 사유 (한국어, 구체적으로)"
  }
]

상위 3명까지 추천하세요. JSON 배열만 반환하세요.`;

    const raw = await callGemini(prompt);
    const json = JSON.parse(extractJsonFromResponse(raw));

    if (!Array.isArray(json)) {
      return fallbackAssignStaff(issue, staffList);
    }

    return json.map((item: { staffId?: string; staffName?: string; matchScore?: number; reason?: string }) => {
      const staff = staffList.find((s) => s._id === item.staffId);
      return {
        staffId: item.staffId ?? "",
        staffName: item.staffName ?? staff?.name ?? "",
        matchScore: Math.min(100, Math.max(0, Number(item.matchScore) || 50)),
        reason: item.reason ?? "",
        skills: staff?.skills ?? [],
        currentLoad: staff?.currentLoad ?? 0,
        isOnShift: staff ? isStaffOnShift(staff) : false,
      };
    });
  } catch (error) {
    console.error("Gemini assignment failed, using fallback:", error);
    return fallbackAssignStaff(issue, staffList);
  }
}

export async function generateHandoverBriefing(
  issues: OpsIssue[],
  shiftType: string,
  shiftDate: string,
): Promise<{
  aiSummary: string;
  issuesSummary: Array<{ issueId: string; title: string; status: string; summary: string }>;
  pendingItems: string[];
}> {
  const issuesSummary = issues.map((i) => ({
    issueId: i._id,
    title: i.title,
    status: i.status,
    summary: i.aiAnalysis?.summary ?? i.description.slice(0, 100),
  }));

  const pendingItems = issues
    .filter((i) => i.status !== "완료" && i.status !== "종결")
    .map((i) => `[${i.aiAnalysis?.urgency ?? "보통"}] ${i.title} - ${i.status}`);

  if (!isGeminiConfigured()) {
    const resolved = issues.filter((i) => i.status === "완료" || i.status === "종결").length;
    const pending = issues.length - resolved;
    return {
      aiSummary: `${shiftDate} ${shiftType} 근무 인수인계 요약: 총 ${issues.length}건의 이슈 중 ${resolved}건 완료, ${pending}건 진행 중입니다.`,
      issuesSummary,
      pendingItems,
    };
  }

  try {
    const prompt = `당신은 사회복지시설 근무 인수인계 AI 도우미입니다.
이전 근무 시간의 이슈를 요약하여 인수인계 브리핑을 작성하세요.

## 근무 정보
- 날짜: ${shiftDate}
- 근무: ${shiftType}

## 이슈 목록
${JSON.stringify(issuesSummary, null, 2)}

## 응답 형식 (JSON)
{
  "aiSummary": "전체 요약 (한국어, 3~5문장, 핵심 사항 위주)"
}

JSON만 반환하세요.`;

    const raw = await callGemini(prompt);
    const json = JSON.parse(extractJsonFromResponse(raw));

    return {
      aiSummary: json.aiSummary ?? "",
      issuesSummary,
      pendingItems,
    };
  } catch (error) {
    console.error("Gemini handover failed, using fallback:", error);
    const resolved = issues.filter((i) => i.status === "완료" || i.status === "종결").length;
    const pending = issues.length - resolved;
    return {
      aiSummary: `${shiftDate} ${shiftType} 근무 인수인계 요약: 총 ${issues.length}건의 이슈 중 ${resolved}건 완료, ${pending}건 진행 중입니다.`,
      issuesSummary,
      pendingItems,
    };
  }
}

export async function generateWeeklyInsights(
  stats: {
    totalIssues: number;
    resolvedIssues: number;
    categoryDistribution: Record<string, number>;
    avgResolutionTimeHours: number;
  },
): Promise<{ insights: string; recommendations: string[] }> {
  if (!isGeminiConfigured()) {
    const resolutionRate = stats.totalIssues > 0
      ? Math.round((stats.resolvedIssues / stats.totalIssues) * 100)
      : 0;
    const topCategory = Object.entries(stats.categoryDistribution)
      .sort((a, b) => b[1] - a[1])[0];

    return {
      insights: `이번 주 총 ${stats.totalIssues}건의 이슈가 접수되었으며, ${stats.resolvedIssues}건이 해결되어 해결률 ${resolutionRate}%를 기록했습니다. 평균 처리 시간은 ${stats.avgResolutionTimeHours.toFixed(1)}시간입니다.${topCategory ? ` 가장 많은 이슈 유형은 '${topCategory[0]}'(${topCategory[1]}건)입니다.` : ""}`,
      recommendations: [
        resolutionRate < 80 ? "이슈 해결률이 80% 미만입니다. 미해결 이슈를 점검하세요." : "이슈 해결률이 양호합니다. 현재 대응 체계를 유지하세요.",
        stats.avgResolutionTimeHours > 24 ? "평균 처리 시간이 24시간을 초과합니다. 초기 대응 프로세스를 개선하세요." : "평균 처리 시간이 적정 수준입니다.",
        "정기 시설 점검을 통해 시설고장 이슈를 사전에 예방하세요.",
      ],
    };
  }

  try {
    const prompt = `당신은 사회복지시설 운영 분석 AI 전문가입니다.
이번 주 운영 통계를 분석하고 인사이트와 개선 권고를 제공하세요.

## 주간 통계
- 총 이슈: ${stats.totalIssues}건
- 해결 이슈: ${stats.resolvedIssues}건
- 평균 처리 시간: ${stats.avgResolutionTimeHours.toFixed(1)}시간
- 카테고리별 분포: ${JSON.stringify(stats.categoryDistribution)}

## 응답 형식 (JSON)
{
  "insights": "분석 인사이트 (한국어, 3~5문장)",
  "recommendations": ["권고사항1", "권고사항2", "권고사항3"]
}

JSON만 반환하세요.`;

    const raw = await callGemini(prompt);
    const json = JSON.parse(extractJsonFromResponse(raw));

    return {
      insights: json.insights ?? "",
      recommendations: Array.isArray(json.recommendations) ? json.recommendations : [],
    };
  } catch (error) {
    console.error("Gemini weekly insights failed, using fallback:", error);
    return {
      insights: `이번 주 총 ${stats.totalIssues}건의 이슈가 접수되었으며 ${stats.resolvedIssues}건이 해결되었습니다.`,
      recommendations: ["정기적인 시설 점검을 실시하세요.", "직원 교육을 강화하세요."],
    };
  }
}
