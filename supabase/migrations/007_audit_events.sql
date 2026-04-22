create type audit_entity_type as enum (
  'discovery_profile', 'deal', 'approval_packet', 'submission', 'brief'
);

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id) on delete set null,
  entity_type audit_entity_type not null,
  entity_id uuid not null,
  action text not null,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

alter table audit_events enable row level security;

create policy "Admin/ops can view audit events"
  on audit_events for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
      and p.role in ('admin', 'ops')
    )
  );

-- Audit events are insert-only from service role (no user can delete/update)
