-- One-off: apply migration 0012's rule to entries that were written before it existed.
--
-- 0012 stopped new personal details from reaching the log. Rows already there still hold whatever
-- the old trigger captured, so on an existing database a deleted student's name, phone, email,
-- address and date of birth survive until this runs.
--
-- This REWRITES existing audit entries. It keeps who, what, when and every non-identifying column,
-- and replaces the personal values with the field names in `changed` — the same shape 0012 writes.
-- It cannot be undone. To see what it will touch before applying:
--
--   select table_name, action, count(*)
--     from activity_log
--    where changed is null and private.log_columns(table_name) is not null
--    group by 1, 2 order by 1, 2;
--
-- Rows for `payments` are never selected: log_columns returns null for them, so their before and
-- after amounts are left exactly as they are.

do $$
declare redacted bigint;
begin
  with target as (
    select l.id, l.old_row, l.new_row, private.log_columns(l.table_name) as allow
      from public.activity_log l
     where l.changed is null                                   -- written before 0012
       and private.log_columns(l.table_name) is not null       -- a table we narrow at all
  ), computed as (
    select t.id,
      (select coalesce(array_agg(k order by k), '{}')
         from jsonb_object_keys(coalesce(t.old_row, t.new_row)) as k
        where not (k = any (t.allow))
          and case
                when t.old_row is null then jsonb_typeof(t.new_row -> k) <> 'null'
                when t.new_row is null then jsonb_typeof(t.old_row -> k) <> 'null'
                else (t.old_row -> k) is distinct from (t.new_row -> k)
              end) as changed,
      case when t.old_row is null then null else
        (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from jsonb_each(t.old_row) as e(k, v) where k = any (t.allow)) end as old_row,
      case when t.new_row is null then null else
        (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from jsonb_each(t.new_row) as e(k, v) where k = any (t.allow)) end as new_row
      from target t
  )
  update public.activity_log a
     set old_row = c.old_row, new_row = c.new_row, changed = c.changed
    from computed c
   where a.id = c.id;
  get diagnostics redacted = row_count;
  raise notice 'activity_log: % historical entries redacted', redacted;
end $$;
