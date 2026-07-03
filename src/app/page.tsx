import Link from "next/link";
import { getPublicSettings } from "@/app/actions/settings";

export default async function Home() {
  const settings = await getPublicSettings();
  const name = settings.apartment_name || "작은도서관";
  const logoUrl = settings.logo_url || "/logo.png";
  const kakaoChannelId = settings.kakao_channel_id;

  return (
    <div className="flex h-dvh flex-col">
      {kakaoChannelId && (
        <a
          href={`https://pf.kakao.com/${kakaoChannelId}/chat`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 bg-[#FEE500] py-2 text-[clamp(0.8rem,1.8vw,0.95rem)] font-medium text-[#191919] hover:brightness-95 active:brightness-90 transition-all flex-shrink-0"
        >
          <img src="/kakao_ch.png" alt="" className="size-[clamp(1rem,2.2vw,1.2rem)]" />
          카카오톡 문의
        </a>
      )}

      <div className="flex flex-1 flex-col items-center justify-center px-6">
        <div className="flex w-full max-w-sm flex-col items-center">
          {/* 로고 */}
          <div className="mb-[3vh] flex flex-col items-center gap-[2vh]">
            <img
              src={logoUrl}
              alt={name}
              className="size-[clamp(8rem,32vw,13rem)] object-contain"
            />
            <p className="text-center text-[clamp(1rem,2.8vw,1.3rem)] text-muted-foreground">
              우리 동네 작은도서관
            </p>
          </div>

          {/* 버튼 2개 */}
          <div className="flex w-full flex-col gap-[2vh]">
            <Link
              href="/login"
              className="flex h-[8vh] min-h-16 items-center justify-center rounded-2xl bg-primary text-[clamp(1.3rem,3.5vw,1.8rem)] font-semibold text-primary-foreground shadow-sm transition-transform active:scale-95 active:brightness-95"
            >
              로그인
            </Link>
            <Link
              href="/login?signup=1"
              className="flex h-[8vh] min-h-16 items-center justify-center rounded-2xl border-2 border-primary bg-background text-[clamp(1.3rem,3.5vw,1.8rem)] font-semibold text-primary transition-transform active:scale-95 active:bg-primary/5"
            >
              회원가입
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
