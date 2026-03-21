import Link from "next/link";

type UnauthorizedPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function UnauthorizedPage({
  searchParams,
}: UnauthorizedPageProps) {
  const params = await searchParams;
  const from = typeof params.from === "string" ? params.from : "/dashboard";

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="w-full max-w-3xl rounded-[32px] border border-[color:var(--border)] bg-[color:var(--surface)] p-8 shadow-[var(--shadow-panel)]">
        <div className="text-xs font-semibold tracking-[0.16em] uppercase text-[color:var(--danger)]">
          Unauthorized
        </div>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.06em] text-[color:var(--text)]">
          이 역할로는 접근할 수 없는 메뉴입니다.
        </h1>
        <p className="mt-4 text-sm leading-7 text-[color:var(--text-muted)]">
          요청 경로: <span className="font-mono">{from}</span>
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/dashboard"
            className="rounded-full bg-[color:var(--primary)] px-4 py-2 text-sm font-semibold text-white"
          >
            대시보드로 이동
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-semibold text-[color:var(--text)]"
          >
            역할 다시 선택
          </Link>
        </div>
      </div>
    </main>
  );
}
