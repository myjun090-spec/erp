import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionPayloadFromCookies } from "@/lib/auth-session";
import { getGoogleAuthStatus } from "@/lib/google-auth";
import { loginRoleCards } from "@/lib/navigation";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const roleLabels: Record<string, string> = {
  platform_admin: "운영 관리자",
  domain_lead: "업무 담당자",
  executive: "경영진 조회",
};

const roleBadges: Record<string, string> = {
  platform_admin: "Admin",
  domain_lead: "Ops",
  executive: "View",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next =
    typeof params.next === "string" && params.next.startsWith("/") ? params.next : "/dashboard";
  const cookieStore = await cookies();
  const sessionPayload = getSessionPayloadFromCookies(cookieStore);

  if (sessionPayload) {
    redirect(next);
  }

  const googleStatus = getGoogleAuthStatus();
  const errorCode = typeof params.error === "string" ? params.error : null;
  const errorMessage = typeof params.message === "string" ? params.message : null;
  const showPreviewAccess =
    process.env.ERP_ENABLE_PREVIEW_LOGIN === "true";

  const loginMessages: Record<string, string> = {
    access_denied: "Google 로그인 권한이 거부되었습니다.",
    google_not_configured: "Google OAuth 환경 변수가 아직 준비되지 않았습니다.",
    google_state_invalid: "로그인 상태 검증에 실패했습니다. 다시 시도하세요.",
    google_login_failed: errorMessage ?? "Google 로그인 처리 중 오류가 발생했습니다.",
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#ebe7df] px-4 py-4 text-[#1e2a36] sm:px-6 sm:py-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(206,71,27,0.16),transparent_24%),radial-gradient(circle_at_82%_18%,rgba(15,78,140,0.18),transparent_20%),linear-gradient(135deg,rgba(255,255,255,0.54),rgba(235,231,223,0.92))]" />
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(30,42,54,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(30,42,54,0.08)_1px,transparent_1px)] [background-size:24px_24px]" />
        <div className="absolute left-[-8rem] top-[-7rem] h-80 w-80 rounded-full bg-[rgba(206,71,27,0.14)] blur-3xl" />
        <div className="absolute right-[-10rem] top-16 h-96 w-96 rounded-full bg-[rgba(15,78,140,0.14)] blur-3xl" />
        <div className="absolute bottom-[-10rem] left-1/3 h-[28rem] w-[28rem] rounded-full bg-[rgba(34,49,63,0.12)] blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-[1480px] items-center justify-center rounded-[32px] border border-[rgba(30,42,54,0.1)] bg-[rgba(250,247,242,0.72)] px-5 py-8 shadow-[0_30px_90px_rgba(38,44,57,0.14)] backdrop-blur sm:px-8 md:min-h-[calc(100vh-3rem)]">
        <div className="w-full max-w-[34rem]">
          <div className="text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-[22px] border border-[rgba(30,42,54,0.12)] bg-[#1e2a36] text-sm font-semibold tracking-[0.18em] text-[#f4efe7]">
              ERP
            </div>
            <div className="mt-4 font-mono text-[11px] uppercase tracking-[0.28em] text-[#8a5f45]">
              smr enterprise workspace
            </div>
          </div>

          <div className="mx-auto mt-6 w-full max-w-[34rem]">
              <div className="rounded-[34px] border border-[rgba(30,42,54,0.08)] bg-[rgba(255,252,247,0.86)] p-6 shadow-[0_24px_70px_rgba(38,44,57,0.12)] backdrop-blur sm:p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#8a5f45]">
                      sign in
                    </div>
                    <h2 className="mt-3 text-[2rem] font-semibold leading-none tracking-[-0.06em] text-[#1c2732] sm:text-[2.4rem]">
                      조직 계정 로그인
                    </h2>
                    <p className="mt-4 text-sm leading-7 text-[#5f6d79]">
                      승인된 Google 계정으로 인증한 뒤 바로 업무 화면으로 이동합니다.
                    </p>
                  </div>
                </div>

                {errorCode ? (
                  <div className="mt-6 rounded-[24px] border border-[rgba(201,55,44,0.18)] bg-[rgba(201,55,44,0.08)] px-4 py-4 text-sm leading-7 text-[#b2372e]">
                    {loginMessages[errorCode] ?? "로그인 중 문제가 발생했습니다."}
                  </div>
                ) : null}

                <div className="mt-7 grid gap-3">
                  {googleStatus.enabled ? (
                    <Link
                      href={`/auth/google?next=${encodeURIComponent(next)}`}
                      className="group inline-flex min-h-14 items-center justify-between rounded-[22px] border border-[rgba(30,42,54,0.12)] bg-[#1e2a36] px-5 py-4 text-sm font-semibold text-white shadow-[0_18px_30px_rgba(30,42,54,0.14)] transition hover:bg-[#16202b]"
                    >
                      <span>Google 계정으로 계속</span>
                      <span className="font-mono text-xs uppercase tracking-[0.18em] text-[#d7e0e8] transition group-hover:translate-x-0.5">
                        OAuth
                      </span>
                    </Link>
                  ) : (
                    <div className="inline-flex min-h-14 items-center justify-between rounded-[22px] border border-[rgba(161,92,7,0.18)] bg-[rgba(161,92,7,0.08)] px-5 py-4 text-sm font-semibold text-[#8a5209]">
                      <span>SSO 환경 변수 설정 필요</span>
                      <span className="font-mono text-xs uppercase tracking-[0.18em]">setup</span>
                    </div>
                  )}
                </div>

                {!googleStatus.enabled ? (
                  <div className="mt-6 rounded-[24px] border border-[rgba(161,92,7,0.18)] bg-[rgba(161,92,7,0.08)] px-4 py-4 text-sm leading-7 text-[#8a5209]">
                    누락된 환경 변수: {googleStatus.missing.join(", ")}
                  </div>
                ) : null}

                <div className="mt-7 rounded-[28px] border border-[rgba(30,42,54,0.08)] bg-[#f3ede4] p-5">
                  <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#8a5f45]">
                    support
                  </div>
                  <div className="mt-3 space-y-3 text-sm leading-7 text-[#576572]">
                    <p>로그인이 차단되면 관리자에게 계정 허용 여부와 역할, 조직 배정을 먼저 확인하세요.</p>
                    <p>인증 후에는 권한 범위에 맞는 메뉴와 화면만 노출됩니다.</p>
                  </div>
                </div>
              </div>

                {showPreviewAccess ? (
                  <div className="mt-5 rounded-[30px] border border-[rgba(30,42,54,0.08)] bg-[rgba(255,252,247,0.72)] p-6 shadow-[0_14px_40px_rgba(38,44,57,0.08)] backdrop-blur">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#8a5f45]">
                          preview access
                        </div>
                        <div className="mt-2 text-xl font-semibold tracking-[-0.04em] text-[#1f2c37]">
                          개발용 세션 진입
                        </div>
                      </div>
                      <div className="rounded-full border border-[rgba(30,42,54,0.08)] bg-white/80 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-[#6b7884]">
                        dev only
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3">
                      {loginRoleCards.map((card) => (
                        <Link
                          key={card.role}
                          href={`/auth/login?role=${card.role}&next=${encodeURIComponent(next)}`}
                          className="group rounded-[22px] border border-[rgba(30,42,54,0.08)] bg-white/84 px-4 py-4 transition hover:-translate-y-0.5 hover:border-[rgba(31,95,168,0.26)] hover:shadow-[0_12px_30px_rgba(38,44,57,0.08)]"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="text-base font-semibold text-[#1f2c37]">
                                {roleLabels[card.role]}
                              </div>
                              <p className="mt-2 text-sm leading-7 text-[#60707d]">
                                {card.description}
                              </p>
                            </div>
                            <div className="rounded-full border border-[rgba(31,95,168,0.16)] bg-[rgba(31,95,168,0.08)] px-3 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-[#1f5fa8]">
                              {roleBadges[card.role]}
                            </div>
                          </div>
                          <div className="mt-3 font-mono text-[11px] uppercase tracking-[0.18em] text-[#7b8a97] transition group-hover:translate-x-0.5">
                            preview session
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
