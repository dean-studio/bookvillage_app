-- QR 카드 회원 부가정보 (선택): phone_number 칸은 카드 코드로 쓰므로 보호자 연락처·메모를 별도 컬럼에 저장
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS contact_phone varchar(20);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS memo text;
