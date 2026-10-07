-- 관리자 자료실: 인쇄용 파일(pdf, hwp, hwpx, docx 등)을 올려두고 도서관 PC에서 내려받기
CREATE TABLE IF NOT EXISTS admin_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL,          -- 원래 파일 이름 (내려받을 때 이 이름으로)
  path text NOT NULL UNIQUE,           -- 저장소 경로 (한글 이름 대신 uuid)
  size bigint NOT NULL DEFAULT 0,
  mime varchar(150),
  memo text,
  uploaded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_admin_files_created ON admin_files(created_at DESC);

-- 서버(service role)에서만 다룸: RLS만 켜고 정책은 두지 않음
ALTER TABLE admin_files ENABLE ROW LEVEL SECURITY;

-- 비공개 저장소 버킷 (파일당 50MB)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('admin-files', 'admin-files', false, 52428800)
ON CONFLICT (id) DO NOTHING;
