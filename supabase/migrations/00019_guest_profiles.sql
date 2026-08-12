-- 비회원(게스트) 대출 지원: profiles.is_guest 플래그
-- 종이에 동/호수·이름·전화번호만 적고 가는 이용자를 게스트로 등록해 대여/반납만 관리.
-- 게스트는 통계(다독왕·젤리 랭킹 등)에서 제외하고, 대출/연체 목록에는 게스트 배지로 노출.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_guest boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_is_guest ON profiles(is_guest) WHERE is_guest = true;
