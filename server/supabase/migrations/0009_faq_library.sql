-- AI Bajan knowledge library: every verified answer (FAQ) records its supporting source, who
-- approved it and when, and when it must be reviewed again; withdrawn entries keep the reason.
-- Additive and idempotent.
alter table {{schema}}.website_with_rag_faqs
  add column if not exists source_url text not null default '',
  add column if not exists source_title text not null default '',
  add column if not exists approved_by uuid references {{schema}}.website_with_rag_admins(id) on delete set null,
  add column if not exists approved_at timestamptz,
  add column if not exists review_due date,
  add column if not exists withdrawal_reason text not null default '';

-- Existing approved entries: approval time from their last update, first review in six months.
update {{schema}}.website_with_rag_faqs
   set approved_at = coalesce(approved_at, updated_at),
       review_due = coalesce(review_due, (current_date + 180))
 where approval_status = 'approved' and (approved_at is null or review_due is null);
