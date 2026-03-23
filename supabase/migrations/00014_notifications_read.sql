-- 알림 읽음 처리를 위한 타임스탬프
ALTER TABLE profiles ADD COLUMN notifications_read_at timestamptz DEFAULT NULL;
