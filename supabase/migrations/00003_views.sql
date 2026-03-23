-- Book Village: Useful Views

-- 현재 연체 목록
CREATE VIEW overdue_rentals AS
SELECT
  r.id,
  r.book_id,
  r.user_id,
  r.rented_at,
  r.due_date,
  (CURRENT_DATE - r.due_date) AS overdue_days,
  b.title AS book_title,
  b.barcode AS book_barcode,
  p.name AS user_name,
  p.dong_ho AS user_dong_ho,
  p.phone_number AS user_phone,
  EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.rental_id = r.id AND n.type = '7day' AND n.status = 'sent'
  ) AS notified_7day,
  EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.rental_id = r.id AND n.type = '30day' AND n.status = 'sent'
  ) AS notified_30day
FROM rentals r
JOIN books b ON b.id = r.book_id
JOIN profiles p ON p.id = r.user_id
WHERE r.returned_at IS NULL
  AND r.due_date < CURRENT_DATE;

-- 도서별 평균 평점
CREATE VIEW book_ratings AS
SELECT
  book_id,
  COUNT(*) AS review_count,
  ROUND(AVG(rating), 1) AS avg_rating
FROM book_reports
GROUP BY book_id;
