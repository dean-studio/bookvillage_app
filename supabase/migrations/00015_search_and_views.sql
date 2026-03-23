-- Book Village: 검색 로그 + 도서 조회 로그

-- search_logs: 검색어 로그
CREATE TABLE search_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query text NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  searched_at timestamptz DEFAULT now()
);
CREATE INDEX idx_search_logs_searched_at ON search_logs(searched_at DESC);
CREATE INDEX idx_search_logs_query ON search_logs(query);
ALTER TABLE search_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY search_logs_insert_all ON search_logs FOR INSERT WITH CHECK (true);
CREATE POLICY search_logs_select_admin ON search_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- book_views: 도서 조회 로그
CREATE TABLE book_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  viewed_at timestamptz DEFAULT now()
);
CREATE INDEX idx_book_views_book_id ON book_views(book_id);
CREATE INDEX idx_book_views_viewed_at ON book_views(viewed_at DESC);
ALTER TABLE book_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY book_views_insert_all ON book_views FOR INSERT WITH CHECK (true);
CREATE POLICY book_views_select_admin ON book_views FOR SELECT USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
