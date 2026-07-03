"use client";

import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export function PrivacyTermsModal({
  open,
  onClose,
  onAgree,
  orgName,
}: {
  open: boolean;
  onClose: () => void;
  /** 제공 시 하단 버튼이 "동의하고 닫기"로 동작 (회원가입용). 미제공 시 "닫기"만 (조회용) */
  onAgree?: () => void;
  orgName?: string;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[150] flex flex-col bg-background">
      <div className="flex items-center justify-between border-b px-5 py-4 flex-shrink-0">
        <h2 className="text-[clamp(1.2rem,3vw,1.6rem)] font-bold">개인정보 수집·이용 동의</h2>
        <button onClick={onClose} className="p-2 -mr-2 active:opacity-60" aria-label="닫기">
          <X className="size-7" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6 text-[clamp(0.95rem,2.3vw,1.15rem)] leading-relaxed space-y-6">
        <p className="text-muted-foreground">
          {orgName || "본 도서관"}은(는) 작은도서관 운영을 위해 아래와 같이
          최소한의 개인정보를 수집·이용합니다. 내용을 확인하신 후 동의해주세요.
        </p>

        <section className="space-y-2">
          <h3 className="font-bold text-foreground">1. 수집하는 개인정보 항목</h3>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>이름</li>
            <li>연락처(휴대폰 번호)</li>
            <li>거주 정보(동·호수)</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="font-bold text-foreground">2. 개인정보의 이용 목적</h3>
          <p className="text-muted-foreground">
            수집한 개인정보는 다음 목적으로만 이용합니다.
          </p>
          <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
            <li>도서 대출·반납 및 본인 확인</li>
            <li>연체 도서 안내 및 반납 요청 연락</li>
            <li>도서관 이벤트(독서 행사 등) 참여 및 안내</li>
          </ul>
          <p className="rounded-lg bg-primary/10 px-4 py-3 text-foreground font-medium">
            ※ 수집한 개인정보는 위 목적 외의 상업적 광고·홍보·마케팅 용도로
            절대 사용하지 않으며, 제3자에게 제공하거나 외부에 판매하지 않습니다.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="font-bold text-foreground">3. 보유 및 이용 기간</h3>
          <p className="text-muted-foreground">
            개인정보는 회원 탈퇴 시 또는 도서관 이용이 중단된 때까지 보유하며,
            목적이 달성되면 지체 없이 파기합니다. 회원은 언제든지 본인의
            개인정보 열람·정정·삭제 및 처리정지를 요청할 수 있습니다.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="font-bold text-foreground">4. 만 14세 미만 아동의 가입</h3>
          <p className="text-muted-foreground">
            본 서비스는 세대(가구) 단위로 가입하며, 별도의 나이·생년월일 정보를
            수집하지 않습니다. 만 14세 미만 아동의 정보(이름 등)는 반드시
            보호자(법정대리인)가 직접 입력하고 본 동의를 진행해야 합니다.
            가입을 진행하는 분은 본인이 성인이거나, 가족 구성원의 정보 입력 및
            개인정보 수집·이용에 대해 보호자로서 동의할 권한이 있음을 확인합니다.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="font-bold text-foreground">5. 동의를 거부할 권리</h3>
          <p className="text-muted-foreground">
            회원은 개인정보 수집·이용 동의를 거부할 권리가 있습니다. 다만 위
            정보는 도서 대출 서비스 제공에 필요한 최소 항목이므로, 동의하지
            않으시면 회원가입 및 도서 대출 서비스 이용이 제한됩니다.
          </p>
        </section>
      </div>

      <div className="border-t p-5 flex-shrink-0">
        {onAgree ? (
          <Button
            className="w-full h-[7vh] min-h-14 text-[clamp(1.2rem,3vw,1.6rem)] font-semibold"
            onClick={onAgree}
          >
            동의하고 닫기
          </Button>
        ) : (
          <Button
            variant="outline"
            className="w-full h-[7vh] min-h-14 text-[clamp(1.2rem,3vw,1.6rem)] font-semibold"
            onClick={onClose}
          >
            닫기
          </Button>
        )}
      </div>
    </div>
  );
}
