create type packet_status as enum ('pending', 'partially_approved', 'approved', 'rejected');
create type decision_value as enum ('approved', 'rejected', 'abstain');

create table approval_packets (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references profiles(id) on delete cascade,
  title text not null,
  status packet_status not null default 'pending',
  deal_ids uuid[] not null default '{}',
  approver_ids uuid[] not null default '{}',
  required_approvals int not null default 3,
  approved_count int not null default 0,
  rejected_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table approval_decisions (
  id uuid primary key default gen_random_uuid(),
  packet_id uuid not null references approval_packets(id) on delete cascade,
  deal_id uuid not null references deals(id) on delete cascade,
  approver_id uuid not null references profiles(id) on delete cascade,
  decision decision_value not null,
  comment text,
  decided_at timestamptz not null default now(),
  unique (packet_id, deal_id, approver_id)
);

alter table approval_packets enable row level security;
alter table approval_decisions enable row level security;

create policy "Admin/ops can manage packets"
  on approval_packets for all
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
      and p.role in ('admin', 'ops')
    )
  );

create policy "Approvers can view packets assigned to them"
  on approval_packets for select
  using (auth.uid() = any(approver_ids));

create policy "Admin/ops can view all decisions"
  on approval_decisions for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
      and p.role in ('admin', 'ops')
    )
  );

create policy "Approvers can view/insert own decisions"
  on approval_decisions for all
  using (approver_id = auth.uid());

create trigger approval_packets_updated_at
  before update on approval_packets
  for each row execute function set_updated_at();
