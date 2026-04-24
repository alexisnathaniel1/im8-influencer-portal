-- Support staff now writes briefs in Google Docs and pastes a shareable link
-- rather than authoring markdown inside the portal.
alter table briefs
  add column if not exists google_doc_url text;

notify pgrst, 'reload schema';
