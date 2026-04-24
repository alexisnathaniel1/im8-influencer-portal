-- Editor + QA columns on deliverables.
--
-- Editor workflow: after the creator's draft is approved, an editor uploads the
-- finished/edited cut. We store the drive link on the deliverable row so the
-- QA team can see it alongside the brief + approved draft.
--
-- QA workflow: after the edit is done, QA sets qa_status to
-- 'ready_to_go_live' or 'revisions_needed', and can leave comments.
alter table deliverables
  add column if not exists edited_video_url text,
  add column if not exists qa_status text not null default 'pending',
  -- pending | ready_to_go_live | revisions_needed
  add column if not exists qa_comments text;

notify pgrst, 'reload schema';
