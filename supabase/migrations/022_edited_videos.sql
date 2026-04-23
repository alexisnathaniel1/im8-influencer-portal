-- Editors assigned to deals
create table if not exists deal_editors (
  deal_id uuid not null references deals(id) on delete cascade,
  editor_id uuid not null references profiles(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (deal_id, editor_id)
);

alter table deal_editors enable row level security;

create policy "Admin/ops can manage deal editors"
  on deal_editors for all
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
      and p.role in ('admin', 'ops')
    )
  );

create policy "Editor can read own assignments"
  on deal_editors for select
  using (editor_id = auth.uid());

-- Edited videos uploaded by editors
create table if not exists edited_videos (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete cascade,
  deliverable_id uuid references deliverables(id) on delete set null,
  uploaded_by uuid not null references profiles(id) on delete cascade,

  drive_file_id text not null,
  drive_url text not null,
  original_file_name text not null,
  canonical_file_name text not null,

  admin_status text not null default 'pending',
  -- pending | approved | rejected | revision_requested
  influencer_status text not null default 'pending',
  -- pending | approved | rejected

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger edited_videos_updated_at
  before update on edited_videos
  for each row execute function set_updated_at();

alter table edited_videos enable row level security;

create policy "Admin/ops can manage edited videos"
  on edited_videos for all
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
      and p.role in ('admin', 'ops')
    )
  );

create policy "Editor can manage own uploads"
  on edited_videos for all
  using (uploaded_by = auth.uid());

create policy "Influencer can view own deal edited videos"
  on edited_videos for select
  using (
    exists (
      select 1 from deals d
      where d.id = edited_videos.deal_id
      and d.influencer_profile_id = auth.uid()
    )
  );

-- Comment threads per edited video
create table if not exists edited_video_comments (
  id uuid primary key default gen_random_uuid(),
  edited_video_id uuid not null references edited_videos(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  author_display_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

alter table edited_video_comments enable row level security;

create policy "Admin/ops/editor/influencer can comment on edited videos"
  on edited_video_comments for all
  using (
    exists (
      select 1 from profiles p where p.id = auth.uid()
      and p.role in ('admin', 'ops')
    )
    or author_id = auth.uid()
    or exists (
      select 1 from edited_videos ev
      join deals d on d.id = ev.deal_id
      where ev.id = edited_video_comments.edited_video_id
      and d.influencer_profile_id = auth.uid()
    )
  );
