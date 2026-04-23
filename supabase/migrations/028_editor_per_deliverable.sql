-- Editors now work per-deliverable, not per-deal. Replace the old deal-level
-- join table with a simple FK on deliverables.

alter table deliverables
  add column if not exists assigned_editor_id uuid references profiles(id) on delete set null;

create index if not exists deliverables_assigned_editor_idx
  on deliverables(assigned_editor_id);

-- Drop the old per-deal editor assignment table (no production data)
drop table if exists deal_editors cascade;
