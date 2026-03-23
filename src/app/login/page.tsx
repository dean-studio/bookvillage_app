"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signIn, signUp } from "@/app/actions/auth";
import { Loader2 } from "lucide-react";

const PIN_LENGTH = 4;

type Step = "phone" | "pin" | "signup-info" | "signup-pin";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [name, setName] = useState("");
  const [dongHo, setDongHo] = useState("");
  const [step, setStep] = useState<Step>("phone");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleNumberClick(num: string) {
    if (isPending) return;
    if ((step === "phone") && phone.length < 11) {
      setPhone((prev) => prev + num);
    } else if ((step === "pin" || step === "signup-pin") && pin.length < PIN_LENGTH) {
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
    if (step === "phone") {
      setPhone((prev) => prev.slice(0, -1));
    } else if (step === "pin" || step === "signup-pin") {
      setPin((prev) => prev.slice(0, -1));
    }
  }

  function handlePhoneSubmit() {
    if (phone.length >= 10) {
      setError(null);
      setStep("pin");
    }
  }

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
    const formData = new FormData();
    formData.set("phone_number", phone);
    formData.set("pin", fullPin);
    formData.set("name", name);
    formData.set("dong_ho", dongHo);

    startTransition(async () => {
      const result = await signUp(formData);
      if (result.success) {
        // 가입 후 자동 로그인
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

  function resetToLogin() {
    setStep("phone");
    setPhone("");
    setPin("");
    setName("");
    setDongHo("");
  }

  function formatPhone(value: string) {
    if (value.length <= 3) return value;
    if (value.length <= 7) return `${value.slice(0, 3)}-${value.slice(3)}`;
    return `${value.slice(0, 3)}-${value.slice(3, 7)}-${value.slice(7)}`;
  }

  function getStepTitle() {
    switch (step) {
      case "phone":
        return "휴대폰 번호를 입력하세요";
      case "pin":
        return "비밀번호 4자리를 입력하세요";
      case "signup-info":
        return "회원 정보를 입력하세요";
      case "signup-pin":
        return "사용할 비밀번호 4자리를 입력하세요";
    }
  }

  const showNumpad = step === "phone" || step === "pin" || step === "signup-pin";

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-md flex flex-col items-center gap-6">
        <h1 className="text-3xl font-bold tracking-tight">책빌리지</h1>
        <p className="text-xl text-muted-foreground">{getStepTitle()}</p>

        {error && (
          <div className="w-full rounded-lg bg-destructive/10 px-4 py-3 text-center">
            <p className="text-lg text-destructive">{error}</p>
          </div>
        )}

        {isPending && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-lg">처리 중...</span>
          </div>
        )}

        {/* 휴대폰 번호 표시 */}
        {step === "phone" && (
          <p className="text-3xl font-mono tracking-widest min-h-[3rem]">
            {formatPhone(phone) || "\u00A0"}
          </p>
        )}

        {/* PIN 입력 표시 */}
        {(step === "pin" || step === "signup-pin") && (
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

        {/* 회원가입 정보 입력 */}
        {step === "signup-info" && (
          <div className="w-full space-y-4">
            <Input
              placeholder="이름"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-14 text-xl text-center"
              autoFocus
            />
            <Input
              placeholder="동호수 (예: 101동 1201호)"
              value={dongHo}
              onChange={(e) => setDongHo(e.target.value)}
              className="h-14 text-xl text-center"
            />
            <Button
              className="w-full h-14 text-xl font-semibold"
              onClick={() => {
                if (name && dongHo) {
                  setError(null);
                  setStep("signup-pin");
                } else {
                  setError("이름과 동호수를 모두 입력해주세요.");
                }
              }}
              disabled={!name || !dongHo}
            >
              다음
            </Button>
            <Button
              variant="ghost"
              className="w-full h-12 text-lg"
              onClick={resetToLogin}
            >
              로그인으로 돌아가기
            </Button>
          </div>
        )}

        {/* 숫자 패드 */}
        {showNumpad && (
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
            {step === "phone" ? (
              <Button
                className="h-16 text-xl font-semibold"
                onClick={handlePhoneSubmit}
                disabled={phone.length < 10 || isPending}
              >
                다음
              </Button>
            ) : (
              <Button
                variant="ghost"
                className="h-16 text-xl"
                onClick={() => {
                  setPin("");
                  setError(null);
                  if (step === "signup-pin") {
                    setStep("signup-info");
                  } else {
                    setStep("phone");
                  }
                }}
                disabled={isPending}
              >
                이전
              </Button>
            )}
          </div>
        )}

        {/* 회원가입 링크 - 로그인 화면에서만 */}
        {(step === "phone" || step === "pin") && (
          <Button
            variant="link"
            className="text-lg mt-2"
            onClick={() => {
              setError(null);
              setPin("");
              setStep("signup-info");
            }}
          >
            처음이신가요? 회원가입
          </Button>
        )}
      </div>
    </div>
  );
}
