import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/api-access";
import { getMongoDb } from "@/lib/mongodb";
import { generateWeeklyInsights } from "@/lib/ai-operations";
import type { IssueCategory, IssueUrgency } from "@/types/operations";

export async function GET(request: Request) {
  const auth = await requireApiPermission("operations.read");
  if ("error" in auth) return auth.error;

  try {
    const db = await getMongoDb();
    const url = new URL(request.url);

    // Default to last 7 days
    const endDate = url.searchParams.get("end") || new Date().toISOString().slice(0, 10);
    const startDefault = new Date(endDate);
    startDefault.setDate(startDefault.getDate() - 7);
    const startDate = url.searchParams.get("start") || startDefault.toISOString().slice(0, 10);

    const issues = await db
      .collection("ops_issues")
      .find({
        createdAt: { $gte: `${startDate}T00:00:00`, $lte: `${endDate}T23:59:59` },
      })
      .toArray();

    const totalIssues = issues.length;
    const resolvedIssues = issues.filter(
      (i) => i.status === "완료" || i.status === "종결",
    ).length;

    // Category distribution
    const categoryDistribution: Record<IssueCategory, number> = {
      "안전사고": 0,
      "시설고장": 0,
      "이용자컴플레인": 0,
      "직원이슈": 0,
      "기타": 0,
    };
    for (const issue of issues) {
      const cat = (issue.aiAnalysis?.category ?? "기타") as IssueCategory;
      if (cat in categoryDistribution) {
        categoryDistribution[cat]++;
      } else {
        categoryDistribution["기타"]++;
      }
    }

    // Urgency distribution
    const urgencyDistribution: Record<IssueUrgency, number> = {
      "긴급": 0,
      "보통": 0,
      "낮음": 0,
    };
    for (const issue of issues) {
      const urg = (issue.aiAnalysis?.urgency ?? "보통") as IssueUrgency;
      if (urg in urgencyDistribution) {
        urgencyDistribution[urg]++;
      } else {
        urgencyDistribution["보통"]++;
      }
    }

    // Average resolution time
    let totalResolutionHours = 0;
    let resolvedCount = 0;
    for (const issue of issues) {
      if (issue.resolvedAt && issue.createdAt) {
        const diff = new Date(issue.resolvedAt).getTime() - new Date(issue.createdAt).getTime();
        totalResolutionHours += diff / (1000 * 60 * 60);
        resolvedCount++;
      }
    }
    const avgResolutionTimeHours = resolvedCount > 0 ? totalResolutionHours / resolvedCount : 0;

    // Staff performance
    const staffMap = new Map<string, { name: string; assigned: number; resolved: number; totalHours: number }>();
    for (const issue of issues) {
      const staffName = issue.assignedStaffName;
      if (!staffName) continue;
      if (!staffMap.has(staffName)) {
        staffMap.set(staffName, { name: staffName, assigned: 0, resolved: 0, totalHours: 0 });
      }
      const entry = staffMap.get(staffName)!;
      entry.assigned++;
      if (issue.status === "완료" || issue.status === "종결") {
        entry.resolved++;
        if (issue.resolvedAt && issue.createdAt) {
          const diff = new Date(issue.resolvedAt).getTime() - new Date(issue.createdAt).getTime();
          entry.totalHours += diff / (1000 * 60 * 60);
        }
      }
    }

    const staffPerformance = [...staffMap.values()].map((s) => ({
      staffName: s.name,
      assignedCount: s.assigned,
      resolvedCount: s.resolved,
      avgResolutionHours: s.resolved > 0 ? s.totalHours / s.resolved : 0,
    }));

    // Daily risk trend
    const dayMap = new Map<string, { totalRisk: number; count: number }>();
    for (const issue of issues) {
      const day = issue.createdAt?.slice(0, 10) ?? "";
      if (!day) continue;
      if (!dayMap.has(day)) dayMap.set(day, { totalRisk: 0, count: 0 });
      const entry = dayMap.get(day)!;
      entry.totalRisk += issue.aiAnalysis?.riskLevel ?? 3;
      entry.count++;
    }
    const riskTrend = [...dayMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({
        date,
        avgRisk: v.count > 0 ? Math.round((v.totalRisk / v.count) * 10) / 10 : 0,
        count: v.count,
      }));

    // AI Insights
    const aiResult = await generateWeeklyInsights({
      totalIssues,
      resolvedIssues,
      categoryDistribution,
      avgResolutionTimeHours,
    });

    return NextResponse.json({
      ok: true,
      data: {
        period: { start: startDate, end: endDate },
        totalIssues,
        resolvedIssues,
        avgResolutionTimeHours: Math.round(avgResolutionTimeHours * 10) / 10,
        categoryDistribution,
        urgencyDistribution,
        staffPerformance,
        riskTrend,
        aiInsights: aiResult.insights,
        aiRecommendations: aiResult.recommendations,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, message: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
