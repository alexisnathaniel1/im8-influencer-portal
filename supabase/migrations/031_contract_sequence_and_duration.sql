-- 031: Contract duration persistence + multi-contract labelling
--
-- Adds:
--  - discovery_profiles.total_months (so the counter-proposal duration
--    carries through from Negotiation into the Deal record).
--  - deals.contract_sequence (1 for first contract, 2 for second, etc.)
--  - deals.previous_deal_id (explicit link between sequential contracts
--    for the same creator).
--
-- Backfill: computes contract_sequence for existing deals based on
-- created_at order per creator.

alter table discovery_profiles
  add column if not exists total_months int;

alter table deals
  add column if not exists contract_sequence int not null default 1,
  add column if not exists previous_deal_id uuid references deals(id) on delete set null;

-- Backfill contract_sequence for existing deals.
-- Partition by influencer_profile_id (primary), fallback to influencer_name
-- so legacy deals without a linked profile still get sensible sequencing.
with ranked as (
  select id,
         row_number() over (
           partition by coalesce(influencer_profile_id::text, influencer_name)
           order by created_at
         ) as seq
  from deals
)
update deals d
   set contract_sequence = r.seq
  from ranked r
 where d.id = r.id
   and d.contract_sequence = 1;

-- Index to make "find most recent contract for this creator" fast.
create index if not exists deals_influencer_profile_sequence_idx
  on deals (influencer_profile_id, contract_sequence desc);
