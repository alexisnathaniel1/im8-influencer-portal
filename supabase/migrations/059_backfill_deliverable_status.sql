-- Backfill deliverable status for rows that already have submissions in the
-- review queue but were logged before the auto-sync logic was added.
--
-- pending submission   → deliverable becomes 'submitted'
-- revision_requested   → deliverable becomes 'in_progress'  (belt-and-suspenders)

UPDATE deliverables
SET status = 'submitted'
WHERE status IN ('pending', 'in_progress')
  AND EXISTS (
    SELECT 1 FROM submissions s
    WHERE s.deliverable_id = deliverables.id
      AND s.status = 'pending'
      AND (s.is_script IS NULL OR s.is_script = false)
  );

UPDATE deliverables
SET status = 'in_progress'
WHERE status = 'pending'
  AND EXISTS (
    SELECT 1 FROM submissions s
    WHERE s.deliverable_id = deliverables.id
      AND s.status = 'revision_requested'
      AND (s.is_script IS NULL OR s.is_script = false)
  );
