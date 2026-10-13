-- Public "additional notes" shown on the listing page and available to the chatbot.
-- (private_notes remains admin-only and is never indexed.) Additive and idempotent.
alter table {{schema}}.website_with_rag_listings
  add column if not exists public_notes text not null default '';
