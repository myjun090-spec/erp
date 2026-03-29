// ===== Issue Types =====

export type IssueCategory = "안전사고" | "시설고장" | "이용자컴플레인" | "직원이슈" | "기타";
export type IssueUrgency = "긴급" | "보통" | "낮음";
export type IssueStatus = "접수" | "분석중" | "배정됨" | "처리중" | "완료" | "종결";

export type IssueAiAnalysis = {
  category: IssueCategory;
  urgency: IssueUrgency;
  riskLevel: number; // 1-5
  recommendedAction: string;
  summary: string;
  analyzedAt: string;
};

export type OpsIssue = {
  _id: string;
  title: string;
  description: string;
  reporterName: string;
  reporterEmail: string;
  location: string;
  imageUrls: string[];
  status: IssueStatus;
  aiAnalysis: IssueAiAnalysis | null;
  assignedStaffId: string | null;
  assignedStaffName: string | null;
  assignmentReason: string | null;
  resolution: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

// ===== Staff Types =====

export type StaffSkill =
  | "시설관리"
  | "안전관리"
  | "사회복지"
  | "상담"
  | "행정"
  | "의료/간호"
  | "프로그램운영"
  | "IT/정보"
  | "차량운전";

export type ShiftType = "오전" | "오후" | "야간" | "휴무";

export type StaffSchedule = {
  dayOfWeek: number; // 0=Sunday, 6=Saturday
  shift: ShiftType;
};

export type OpsStaff = {
  _id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  skills: StaffSkill[];
  schedule: StaffSchedule[];
  phone: string;
  isActive: boolean;
  currentLoad: number; // number of currently assigned issues
  createdAt: string;
  updatedAt: string;
};

// ===== Assignment Types =====

export type StaffAssignmentSuggestion = {
  staffId: string;
  staffName: string;
  matchScore: number;
  reason: string;
  skills: StaffSkill[];
  currentLoad: number;
  isOnShift: boolean;
};

// ===== Handover Types =====

export type HandoverEntry = {
  _id: string;
  shiftDate: string;
  shiftType: ShiftType;
  authorName: string;
  authorEmail: string;
  // AI-generated sections
  aiSummary: string | null;
  issuesSummary: Array<{
    issueId: string;
    title: string;
    status: IssueStatus;
    summary: string;
  }>;
  pendingItems: string[];
  // Manual sections
  manualNotes: string;
  vocNotes: string; // Voice of Customer
  specialInstructions: string;
  reminders: string[];
  createdAt: string;
  updatedAt: string;
};

// ===== Board Types =====

export type BoardEntryType = "issue" | "notification" | "handover" | "announcement";

export type BoardEntry = {
  _id: string;
  type: BoardEntryType;
  title: string;
  content: string;
  authorName: string;
  category?: IssueCategory;
  urgency?: IssueUrgency;
  riskLevel?: number;
  refId?: string; // Reference to issue/handover ID
  createdAt: string;
};

// ===== Report Types =====

export type WeeklyReportData = {
  period: { start: string; end: string };
  totalIssues: number;
  resolvedIssues: number;
  avgResolutionTimeHours: number;
  categoryDistribution: Record<IssueCategory, number>;
  urgencyDistribution: Record<IssueUrgency, number>;
  staffPerformance: Array<{
    staffName: string;
    assignedCount: number;
    resolvedCount: number;
    avgResolutionHours: number;
  }>;
  riskTrend: Array<{ date: string; avgRisk: number; count: number }>;
  aiInsights: string | null;
  aiRecommendations: string[];
};
