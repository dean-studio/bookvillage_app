// 사이트 유형(모드) 판별은 이 파일 한 곳에서만 한다.
// 서버 액션·클라이언트 화면 양쪽에서 쓰도록 순수 함수만 둔다 ("use server"/"use client" 없음).
//
// 규칙
// - site_type 값은 library_settings 의 'site_type' 키. 키가 없거나 모르는 값이면 apartment 로 본다.
// - 모드 비교를 화면·액션에 직접 쓰지 말고 아래 헬퍼를 쓴다.
// - 새 설정 플래그는 "키가 없으면 지금과 같다". 켜짐 판정은 항상 === 'on' (isFlagOn).

export const SITE_TYPE_VALUES = ["apartment", "school", "village", "kindergarten", "academy"] as const;

export type SiteType = (typeof SITE_TYPE_VALUES)[number];

type SiteTypeInput = string | null | undefined;

/** 저장된 site_type 값을 알려진 유형으로 바꾼다. 빈 값·모르는 값은 'apartment'. (공백·대소문자 보정 없음: 정확히 같은 값만 인정) */
export function normalizeSiteType(value: SiteTypeInput): SiteType {
  return (SITE_TYPE_VALUES as readonly string[]).includes(value ?? "") ? (value as SiteType) : "apartment";
}

export function isKindergarten(siteType: SiteTypeInput): boolean {
  return normalizeSiteType(siteType) === "kindergarten";
}

export function isAcademy(siteType: SiteTypeInput): boolean {
  return normalizeSiteType(siteType) === "academy";
}

/** 반(그룹) 단위로 회원을 나누는 유형: 유치원·학원 */
export function usesGroups(siteType: SiteTypeInput): boolean {
  return isKindergarten(siteType) || isAcademy(siteType);
}

/** 키오스크(리더기)에서 카드 없이 책 바코드만으로 반납: 유치원·학원 */
export function allowsKioskReturn(siteType: SiteTypeInput): boolean {
  return isKindergarten(siteType) || isAcademy(siteType);
}

/** 대출 중인 책을 분실로 처리해 삭제: 유치원·학원 */
export function allowsLostDelete(siteType: SiteTypeInput): boolean {
  return isKindergarten(siteType) || isAcademy(siteType);
}

/** 설정 플래그 켜짐 여부. 키가 없거나 'on' 이 아니면 꺼짐. */
export function isFlagOn(settings: Record<string, string | null | undefined> | null | undefined, key: string): boolean {
  return settings?.[key] === "on";
}
