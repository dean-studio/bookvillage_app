-- Book Village: Admin Approval System

-- profiles 테이블에 admin_status 컬럼 추가
-- NULL = 일반 주민 (해당 없음), 'pending' = 승인 대기, 'approved' = 승인 완료
ALTER TABLE profiles
  ADD COLUMN admin_status varchar(10)
    CHECK (admin_status IS NULL OR admin_status IN ('pending', 'approved'));

-- 기존 관리자 계정은 자동 승인 처리
UPDATE profiles SET admin_status = 'approved' WHERE role = 'admin';

-- 인덱스: 승인 대기 관리자 조회용
CREATE INDEX idx_profiles_admin_status ON profiles(admin_status) WHERE role = 'admin';
