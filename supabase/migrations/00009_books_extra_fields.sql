-- Add extra book info fields from Kakao API
ALTER TABLE books ADD COLUMN isbn varchar(30) DEFAULT '';
ALTER TABLE books ADD COLUMN translators varchar(200) DEFAULT '';
ALTER TABLE books ADD COLUMN published_at varchar(20) DEFAULT '';
ALTER TABLE books ADD COLUMN price integer DEFAULT 0;
ALTER TABLE books ADD COLUMN sale_price integer DEFAULT 0;
ALTER TABLE books ADD COLUMN category varchar(200) DEFAULT '';
