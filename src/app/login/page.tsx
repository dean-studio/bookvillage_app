"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signIn, signUp } from "@/app/actions/auth";
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

  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  // --- Numpad logic ---
  const isNumpadStep = step === "phone" || step === "pin" || step === "s-phone" || step === "s-pin";

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
    }
  }

  function handleDelete() {
    if (isPending) return;
    if (step === "phone" || step === "s-phone") {
      setPhone((prev) => prev.slice(0, -1));
    } else if (step === "pin" || step === "s-pin") {
      setPin((prev) => prev.slice(0, -1));
    }
  }

  // --- Navigation ---
  function handleNext() {
    setError(null);
    if (step === "phone") {
      if (phone.length >= 10) setStep("pin");
    } else if (step === "s-name") {
      if (name.trim()) setStep("s-phone");
      else setError("이름을 입력해주세요.");
    } else if (step === "s-phone") {
      if (phone.length >= 10) setStep("s-dong");
      else setError("휴대폰 번호를 입력해주세요.");
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

  // --- API calls ---
  async function handleLogin(fullPin: string) {
    setError(null);
    const formData = new FormData();
    formData.set("phone_number", phone);
    formData.set("pin", fullPin);

    startTransition(async () => {
      const result = await signIn(formData);
      if (result.success) {
        router.push("/books");
      } else {
        setError(result.error ?? "로그인에 실패했습니다.");
        setPin("");
      }
    });
  }

  async function handleSignUp(fullPin: string) {
    setError(null);
    const dongHo = `${dong} ${ho}`;
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
          router.push("/books");
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

  // --- Helpers ---
  function formatPhone(value: string) {
    if (value.length <= 3) return value;
    if (value.length <= 7) return `${value.slice(0, 3)}-${value.slice(3)}`;
    return `${value.slice(0, 3)}-${value.slice(3, 7)}-${value.slice(7)}`;
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

  function getPlaceholder(): string {
    switch (step) {
      case "s-name": return "예: 홍길동";
      case "s-dong": return "예: 101동";
      case "s-ho": return "예: 1201호";
      default: return "";
    }
  }

  function getTextValue(): string {
    switch (step) {
      case "s-name": return name;
      case "s-dong": return dong;
      case "s-ho": return ho;
      default: return "";
    }
  }

  function setTextValue(val: string) {
    switch (step) {
      case "s-name": setName(val); break;
      case "s-dong": setDong(val); break;
      case "s-ho": setHo(val); break;
    }
  }

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

  const isTextInput = step === "s-name" || step === "s-dong" || step === "s-ho";
  const signupIdx = getSignupStepIndex(step);
  const showProgress = mode === "signup" && signupIdx >= 0;

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-md flex flex-col items-center gap-6">
        {/* 헤더 */}
        <h1 className="text-3xl font-bold tracking-tight">책빌리지</h1>

        {/* 진행률 표시 (회원가입만) */}
        {showProgress && (
          <div className="w-full space-y-2">
            <p className="text-base text-muted-foreground text-center">
              {signupIdx + 1} / {SIGNUP_STEPS.length}
            </p>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${((signupIdx + 1) / SIGNUP_STEPS.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        <p className="text-xl text-muted-foreground">{getTitle()}</p>

        {/* 에러 */}
        {error && (
          <div className="w-full rounded-lg bg-destructive/10 px-4 py-3 text-center">
            <p className="text-lg text-destructive">{error}</p>
          </div>
        )}

        {/* 로딩 */}
        {isPending && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-lg">처리 중...</span>
          </div>
        )}

        {/* 텍스트 입력 (이름, 동, 호) */}
        {isTextInput && (
          <div className="w-full space-y-4">
            <Input
              placeholder={getPlaceholder()}
              value={getTextValue()}
              onChange={(e) => setTextValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleNext()}
              className="h-16 text-2xl text-center"
              autoFocus
            />
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="h-14 text-xl flex-1"
                onClick={handleBack}
              >
                <ChevronLeft className="size-5 mr-1" />
                이전
              </Button>
              <Button
                className="h-14 text-xl font-semibold flex-1"
                onClick={handleNext}
                disabled={isNextDisabled()}
              >
                다음
              </Button>
            </div>
          </div>
        )}

        {/* 휴대폰 번호 표시 */}
        {(step === "phone" || step === "s-phone") && (
          <p className="text-3xl font-mono tracking-widest min-h-[3rem]">
            {formatPhone(phone) || "\u00A0"}
          </p>
        )}

        {/* PIN 표시 */}
        {(step === "pin" || step === "s-pin") && (
          <div className="flex gap-4 justify-center">
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <div
                key={i}
                className="w-5 h-5 rounded-full border-2 border-foreground transition-colors"
                style={{
                  backgroundColor:
                    i < pin.length ? "var(--foreground)" : "transparent",
                }}
              />
            ))}
          </div>
        )}

        {/* 숫자 패드 */}
        {isNumpadStep && (
          <div className="grid grid-cols-3 gap-3 w-full max-w-xs">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
              <Button
                key={num}
                variant="outline"
                className="h-16 text-2xl font-semibold"
                onClick={() => handleNumberClick(num)}
                disabled={isPending}
              >
                {num}
              </Button>
            ))}
            <Button
              variant="ghost"
              className="h-16 text-xl"
              onClick={handleDelete}
              disabled={isPending}
            >
              삭제
            </Button>
            <Button
              variant="outline"
              className="h-16 text-2xl font-semibold"
              onClick={() => handleNumberClick("0")}
              disabled={isPending}
            >
              0
            </Button>
            {(step === "phone" || step === "s-phone") ? (
              <Button
                className="h-16 text-xl font-semibold"
                onClick={handleNext}
                disabled={isNextDisabled() || isPending}
              >
                다음
              </Button>
            ) : (
              <Button
                variant="ghost"
                className="h-16 text-xl"
                onClick={handleBack}
                disabled={isPending}
              >
                이전
              </Button>
            )}
          </div>
        )}

        {/* 회원가입 / 로그인 전환 링크 */}
        {mode === "login" && (step === "phone" || step === "pin") && (
          <Button
            variant="link"
            className="text-lg mt-2"
            onClick={startSignup}
          >
            처음이신가요? 회원가입
          </Button>
        )}
        {mode === "signup" && isTextInput && (
          <Button
            variant="link"
            className="text-lg"
            onClick={resetToLogin}
          >
            이미 회원이신가요? 로그인
          </Button>
        )}
      </div>
    </div>
  );
}
