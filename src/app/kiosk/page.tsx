import { redirect } from "next/navigation";

// 키오스크는 대여하기 화면에 통합됨 (기존 /kiosk 북마크 호환)
export default function KioskPage() {
  redirect("/rent");
}
