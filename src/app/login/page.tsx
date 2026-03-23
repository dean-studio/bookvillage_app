"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signIn, signUp, checkPhoneExists } from "@/app/actions/auth";
import { getPublicSettings } from "@/app/actions/settings";
import { Loader2, ChevronLeft } from "lucide-react";

const PIN_LENGTH = 4;

type LoginStep = "phone" | "pin";
type SignupStep = "s-name" | "s-phone" | "s-dong" | "s-ho" | "s-pin";
type Step = LoginStep | SignupStep;

const SIGNUP_STEPS: SignupStep[] = ["s-name", "s-phone", "s-dong", "s-ho", "s-pin"];

function getSignupStepIndex(step: Step): number {
  return SIGNUP_STEPS.indexOf(step as SignupStep);
}

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [step, setStep] = useState<Step>("phone");

  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [dong, setDong] = useState("");
  const [ho, setHo] = useState("");

  const [apartmentName, setApartmentName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    getPublicSettings().then((settings) => {
      if (settings.apartment_name) setApartmentName(settings.apartment_name);
      if (settings.logo_url) setLogoUrl(settings.logo_url);
    });
  }, []);

  const isNumpadStep =
    step === "phone" || step === "pin" ||
    step === "s-phone" || step === "s-pin" ||
    step === "s-dong" || step === "s-ho";

  const isTextInput = step === "s-name";

  function handleNumberClick(num: string) {
    if (isPending) return;
    if ((step === "phone" || step === "s-phone") && phone.length < 11) {
      setPhone((prev) => prev + num);
    } else if ((step === "pin" || step === "s-pin") && pin.length < PIN_LENGTH) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === PIN_LENGTH) {
        if (step === "pin") {
          handleLogin(newPin);
        } else {
          handleSignUp(newPin);
        }
      }
    } else if (step === "s-dong" && dong.length < 4) {
      setDong((prev) => prev + num);
    } else if (step === "s-ho" && ho.length < 5) {
      setHo((prev) => prev + num);
    }
  }

  function handleDelete() {
    if (isPending) return;
    if (step === "phone" || step === "s-phone") {
      setPhone((prev) => prev.slice(0, -1));
    } else if (step === "pin" || step === "s-pin") {
      setPin((prev) => prev.slice(0, -1));
    } else if (step === "s-dong") {
      setDong((prev) => prev.slice(0, -1));
    } else if (step === "s-ho") {
      setHo((prev) => prev.slice(0, -1));
    }
  }

  function handleNext() {
    setError(null);
    if (step === "phone") {
      if (phone.length >= 10) setStep("pin");
    } else if (step === "s-name") {
      if (name.trim()) setStep("s-phone");
      else setError("이름을 입력해주세요.");
    } else if (step === "s-phone") {
      if (phone.length >= 10) {
        startTransition(async () => {
          const exists = await checkPhoneExists(phone);
          if (exists) {
            setError("이미 가입된 번호입니다.");
          } else {
            setStep("s-dong");
          }
        });
      } else {
        setError("휴대폰 번호를 입력해주세요.");
      }
    } else if (step === "s-dong") {
      if (dong.trim()) setStep("s-ho");
      else setError("동을 입력해주세요.");
    } else if (step === "s-ho") {
      if (ho.trim()) setStep("s-pin");
      else setError("호수를 입력해주세요.");
    }
  }

  function handleBack() {
    setError(null);
    setPin("");
    if (mode === "login") {
      if (step === "pin") setStep("phone");
    } else {
      const idx = getSignupStepIndex(step);
      if (idx > 0) {
        setStep(SIGNUP_STEPS[idx - 1]);
      } else {
        resetToLogin();
      }
    }
  }

  function resetToLogin() {
    setMode("login");
    setStep("phone");
    setPhone("");
    setPin("");
    setName("");
    setDong("");
    setHo("");
    setError(null);
  }

  function startSignup() {
    setMode("signup");
    setStep("s-name");
    setPhone("");
    setPin("");
    setName("");
    setDong("");
    setHo("");
    setError(null);
  }

  async function handleLogin(fullPin: string) {
    setError(null);
    const formData = new FormData();
    formData.set("phone_number", phone);
    formData.set("pin", fullPin);

    startTransition(async () => {
      const result = await signIn(formData);
      if (result.success) {
        router.push("/rent");
      } else {
        setError(result.error ?? "로그인에 실패했습니다.");
        setPin("");
      }
    });
  }

  async function handleSignUp(fullPin: string) {
    setError(null);
    const dongHo = `${dong}동 ${ho}호`;
    const formData = new FormData();
    formData.set("phone_number", phone);
    formData.set("pin", fullPin);
    formData.set("name", name);
    formData.set("dong_ho", dongHo);

    startTransition(async () => {
      const result = await signUp(formData);
      if (result.success) {
        const loginData = new FormData();
        loginData.set("phone_number", phone);
        loginData.set("pin", fullPin);
        const loginResult = await signIn(loginData);
        if (loginResult.success) {
          router.push("/rent");
        } else {
          setError("가입 완료! 로그인해 주세요.");
          resetToLogin();
        }
      } else {
        setError(result.error ?? "회원가입에 실패했습니다.");
        setPin("");
      }
    });
  }

  function formatPhone(value: string, masked = false) {
    if (value.length <= 3) return value;
    if (value.length <= 7) return `${value.slice(0, 3)}-${value.slice(3)}`;
    const last = value.slice(7);
    const maskedLast = masked ? "●".repeat(last.length) : last;
    return `${value.slice(0, 3)}-${value.slice(3, 7)}-${maskedLast}`;
  }

  function getTitle(): string {
    switch (step) {
      case "phone": return "휴대폰 번호를 입력하세요";
      case "pin": return "비밀번호 4자리를 입력하세요";
      case "s-name": return "이름을 입력하세요";
      case "s-phone": return "휴대폰 번호를 입력하세요";
      case "s-dong": return "동을 입력하세요";
      case "s-ho": return "호수를 입력하세요";
      case "s-pin": return "비밀번호 4자리를 설정하세요";
    }
  }

  const hasNextButton =
    step === "phone" || step === "s-phone" || step === "s-dong" || step === "s-ho";

  function isNextDisabled(): boolean {
    switch (step) {
      case "phone":
      case "s-phone": return phone.length < 10;
      case "s-name": return !name.trim();
      case "s-dong": return !dong.trim();
      case "s-ho": return !ho.trim();
      default: return false;
    }
  }

  function getNumpadDisplay(): string {
    switch (step) {
      case "phone": return formatPhone(phone, phone.length > 7) || "\u00A0";
      case "s-phone": return formatPhone(phone) || "\u00A0";
      case "s-dong": return dong ? `${dong}동` : "___동";
      case "s-ho": return ho ? `${ho}호` : "___호";
      default: return "";
    }
  }

  const signupIdx = getSignupStepIndex(step);
  const showProgress = mode === "signup" && signupIdx >= 0;
  const isPinStep = step === "pin" || step === "s-pin";

  return (
    <div className="flex h-dvh flex-col px-6 py-[3vh]">
      <div className="flex w-full max-w-lg mx-auto flex-col items-center flex-1">
        {/* 상단 영역: 헤더 + 안내 + 입력 표시 */}
        <div className="flex flex-col items-center gap-[2vh] flex-shrink-0">
          {logoUrl && <img src={logoUrl} alt="" className="max-h-16 object-contain" />}
          {apartmentName && <p className="text-[clamp(1rem,2.5vw,1.5rem)] text-muted-foreground">{apartmentName}</p>}

          {showProgress && (
            <div className="w-full max-w-sm space-y-2">
              <p className="text-[clamp(1.2rem,3vw,1.8rem)] text-muted-foreground text-center">
                {signupIdx + 1} / {SIGNUP_STEPS.length}
              </p>
              <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${((signupIdx + 1) / SIGNUP_STEPS.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          <p className="text-[clamp(1.6rem,4vw,2.4rem)] font-bold">{getTitle()}</p>

          {error && (
            <div className="w-full max-w-sm rounded-lg bg-destructive/10 px-4 py-3 text-center">
              <p className="text-[clamp(1rem,2.5vw,1.4rem)] text-destructive">{error}</p>
            </div>
          )}

          {isPending && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-6 animate-spin" />
              <span className="text-[clamp(1rem,2.5vw,1.4rem)]">처리 중...</span>
            </div>
          )}
        </div>

        {/* 중간 영역: 값 표시 (flex-1로 남은 공간 차지) */}
        <div className="flex flex-1 items-center justify-center w-full">
          {/* 텍스트 입력 (이름만) */}
          {isTextInput && (
            <div className="w-full max-w-sm space-y-[3vh]">
              <Input
                placeholder="예: 홍길동"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleNext()}
                className="h-[10vh] !text-[clamp(2.5rem,7vw,4.5rem)] text-center placeholder:!text-[clamp(1.8rem,4.5vw,3rem)]"
                autoFocus
              />
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="h-[8vh] min-h-16 text-[clamp(1.3rem,3vw,1.8rem)] flex-1"
                  onClick={handleBack}
                >
                  <ChevronLeft className="size-6 mr-1" />
                  이전
                </Button>
                <Button
                  className="h-[8vh] min-h-16 text-[clamp(1.3rem,3vw,1.8rem)] font-semibold flex-1"
                  onClick={handleNext}
                  disabled={!name.trim()}
                >
                  다음
                </Button>
              </div>
            </div>
          )}

          {/* 숫자 표시 (전화번호, 동, 호) */}
          {isNumpadStep && !isPinStep && (() => {
            const display = getNumpadDisplay();
            const len = display.replace(/\s/g, "").length;
            const sizeClass = len > 10
              ? "text-[clamp(1.6rem,4.5vw,2.8rem)] tracking-wider"
              : len > 6
              ? "text-[clamp(2rem,6vw,3.5rem)] tracking-wider"
              : "text-[clamp(2.5rem,8vw,5rem)] tracking-widest";
            return (
              <p className={`font-mono whitespace-nowrap transition-all duration-150 ${sizeClass}`}>
                {display}
              </p>
            );
          })()}

          {/* PIN 표시 */}
          {isPinStep && (
            <div className="flex gap-[clamp(1.5rem,4vw,2.5rem)] justify-center">
              {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                <div
                  key={i}
                  className="w-[clamp(1.5rem,4vw,2.5rem)] h-[clamp(1.5rem,4vw,2.5rem)] rounded-full border-2 border-foreground transition-colors"
                  style={{
                    backgroundColor:
                      i < pin.length ? "var(--foreground)" : "transparent",
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* 하단 영역: 숫자패드 (화면 하단 고정) */}
        {isNumpadStep && (
          <div className="w-full max-w-md flex-shrink-0 pb-[1vh]">
            {/* 회원가입 numpad 단계에 이전 버튼 */}
            {mode === "signup" && hasNextButton && (
              <button
                onClick={handleBack}
                className="flex items-center gap-1 text-[clamp(1rem,2.2vw,1.3rem)] text-muted-foreground mb-[0.5vh] px-1 active:text-foreground transition-colors"
              >
                <ChevronLeft className="size-[clamp(1rem,2.2vw,1.3rem)]" />
                이전
              </button>
            )}
            <div className="grid grid-cols-3 gap-[clamp(0.4rem,1.2vw,0.6rem)]">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                <Button
                  key={num}
                  variant="outline"
                  className="h-[8.5vh] min-h-16 text-[clamp(1.6rem,4.5vw,2.8rem)] font-semibold"
                  onClick={() => handleNumberClick(num)}
                  disabled={isPending}
                >
                  {num}
                </Button>
              ))}
              <Button
                variant="ghost"
                className="h-[8.5vh] min-h-16 text-[clamp(1.2rem,3vw,1.8rem)]"
                onClick={handleDelete}
                disabled={isPending}
              >
                삭제
              </Button>
              <Button
                variant="outline"
                className="h-[8.5vh] min-h-16 text-[clamp(1.6rem,4.5vw,2.8rem)] font-semibold"
                onClick={() => handleNumberClick("0")}
                disabled={isPending}
              >
                0
              </Button>
              {hasNextButton ? (
                <Button
                  className="h-[8.5vh] min-h-16 text-[clamp(1.2rem,3vw,1.8rem)] font-semibold"
                  onClick={handleNext}
                  disabled={isNextDisabled() || isPending}
                >
                  다음
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  className="h-[8.5vh] min-h-16 text-[clamp(1.2rem,3vw,1.8rem)]"
                  onClick={handleBack}
                  disabled={isPending}
                >
                  이전
                </Button>
              )}
            </div>
          </div>
        )}

        {/* 회원가입 / 로그인 전환 링크 */}
        {mode === "login" && (step === "phone" || step === "pin") && (
          <Button
            variant="link"
            className="text-[clamp(1rem,2.5vw,1.4rem)] flex-shrink-0 py-[1vh]"
            onClick={startSignup}
          >
            처음이신가요? 회원가입
          </Button>
        )}
        {mode === "signup" && isTextInput && (
          <Button
            variant="link"
            className="text-[clamp(1rem,2.5vw,1.4rem)] flex-shrink-0 py-[1vh]"
            onClick={resetToLogin}
          >
            이미 회원이신가요? 로그인
          </Button>
        )}
      </div>
    </div>
  );
}
