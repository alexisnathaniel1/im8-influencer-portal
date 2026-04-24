-- Add per-type sequence numbering to deliverables so a deal with 3× IGR shows
-- as IGR #1, IGR #2, IGR #3 instead of three identical "IGR" entries.
alter table deliverables add column if not exists sequence int;

-- Backfill: row_number over (deal_id, deliverable_type) ordered by created_at.
-- Runs inside a CTE so existing rows get stable numbering matching the order
-- they were inserted when the deal was moved to approved/contracted.
with numbered as (
  select id, row_number() over (
    partition by deal_id, deliverable_type
    order by created_at, id
  ) as seq
  from deliverables
)
update deliverables d
  set sequence = n.seq
  from numbered n
  where d.id = n.id and d.sequence is null;

-- Index for fast "find the Nth IGR for this deal" lookups.
create index if not exists deliverables_deal_type_sequence_idx
  on deliverables (deal_id, deliverable_type, sequence);

notify pgrst, 'reload schema';
