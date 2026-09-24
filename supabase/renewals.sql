-- Who to chase, and who to renew. Paste in the Supabase SQL editor (service role: RLS does not apply).
-- Soonest first. "à relancer" and "expirée" are the ones to act on today.
--
-- To renew, take the id from this list:
--   update schools set paid_until = greatest(paid_until, current_date) + interval '1 month' where id = 3;
--   update schools set paid_until = greatest(paid_until, current_date) + interval '1 year'  where id = 3;
-- greatest(...) so a school that let its subscription lapse pays from today, not from an old date.

select
  s.id,
  s.name,
  coalesce(s.billing, '—') as formule,
  s.paid_until,
  case
    when s.paid_until is null then 'jamais facturée'
    when current_date <= s.paid_until then 'à jour'
    when current_date <= s.paid_until + 15 then 'à relancer'   -- échue, encore modifiable
    else 'expirée'                                             -- lecture seule
  end as etat,
  case when s.paid_until is not null and current_date <= s.paid_until
       then s.paid_until - current_date end as jours_restants,
  case
    when s.paid_until is null or current_date <= s.paid_until then null
    else greatest(s.paid_until + 15 - current_date, 0)
  end as jours_avant_blocage,
  d.full_name as directeur,
  d.email,
  o.phone,
  o.plan
from schools s
left join lateral (
  select m.full_name, m.email from school_members m
  where m.school_id = s.id and m.role = 'director'
  order by m.created_at limit 1
) d on true
left join lateral (
  select o.phone, o.plan from orders o
  where o.school_id = s.id
  order by o.id desc limit 1
) o on true
where not s.is_demo
order by s.paid_until nulls last, s.id;
