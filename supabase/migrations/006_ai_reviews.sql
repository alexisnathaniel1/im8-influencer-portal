create type ai_review_status as enum ('pending', 'processing', 'completed', 'failed', 'skipped');
create type ai_recommendation as enum ('approve', 'reject', 'borderline');

create table ai_reviews (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references submissions(id) on delete cascade,
  status ai_review_status not null default 'pending',

  -- Scores (1-5)
  framework_score int check (framework_score between 1 and 5),
  framework_feedback text,
  authenticity_score int check (authenticity_score between 1 and 5),
  authenticity_feedback text,
  algorithm_score int check (algorithm_score between 1 and 5),
  algorithm_feedback text,

  -- Overall
  general_notes text,
  recommendation ai_recommendation,
  recommendation_reason text,
  brand_compliance_issues jsonb default '[]'::jsonb,
  detected_content_angle text,

  -- Meta
  model_used text,
  video_size_bytes bigint,
  processing_time_ms int,
  error_message text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table ai_reviews enable row level security;

create policy "Admin/ops can view ai_reviews"
  on ai_reviews for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid()
      and p.role in ('admin', 'ops')
    )
  );

create trigger ai_reviews_updated_at
  before update on ai_reviews
  for each row execute function set_updated_at();
