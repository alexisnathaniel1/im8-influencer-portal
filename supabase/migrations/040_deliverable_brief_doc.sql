-- Per-deliverable Google Doc brief.
-- Originally a brief was one row per deal with one google_doc_url. The team wants
-- one brief URL per deliverable row (IGR #1, IGR #2, etc.) so Denis can paste a
-- different Google Doc per individual post.

alter table deliverables
  add column if not exists brief_doc_url text;

notify pgrst, 'reload schema';
