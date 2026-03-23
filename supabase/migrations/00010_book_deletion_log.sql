-- Book deletion log
CREATE TABLE book_deletions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL,
  book_title varchar(200) NOT NULL,
  book_barcode varchar(50) NOT NULL,
  book_author varchar(100),
  deleted_by uuid NOT NULL REFERENCES profiles(id),
  deleted_at timestamptz NOT NULL DEFAULT now(),
  reason text
);

CREATE INDEX idx_book_deletions_deleted_at ON book_deletions(deleted_at DESC);
CREATE INDEX idx_book_deletions_deleted_by ON book_deletions(deleted_by);
