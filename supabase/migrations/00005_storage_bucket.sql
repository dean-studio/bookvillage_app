-- Book Village: Supabase Storage bucket for images

INSERT INTO storage.buckets (id, name, public)
VALUES ('images', 'images', true)
ON CONFLICT (id) DO NOTHING;

-- 인증 사용자: 이미지 업로드
CREATE POLICY "images_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'images');

-- 모든 사용자: 이미지 조회
CREATE POLICY "images_select" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'images');

-- 본인 업로드 파일만 삭제
CREATE POLICY "images_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'images' AND (storage.foldername(name))[1] = 'market');
