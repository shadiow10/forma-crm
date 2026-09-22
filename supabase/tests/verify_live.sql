-- Confirms the migrations are live. Every row should say OK.
select 'schools: address columns locked' as item,
       case when has_column_privilege('authenticated','schools','slug','update') then 'FAIL' else 'OK' end as status
union all select 'ids and created_at locked',
       case when has_column_privilege('authenticated','payments','created_at','update') then 'FAIL' else 'OK' end
union all select 'enrollment total guarded',
       case when to_regclass('public.enrollments') is not null and exists (select 1 from pg_trigger where tgname = 'guard_enrollment_total') then 'OK' else 'FAIL' end
union all select 'last director protected',
       case when exists (select 1 from pg_trigger where tgname = 'keep_one_director') then 'OK' else 'FAIL' end
union all select 'teacher pay hidden',
       case when has_column_privilege('authenticated','teachers','hourly_rate','select') then 'FAIL' else 'OK' end
union all select 'teacher_pay view present',
       case when to_regclass('public.teacher_pay') is not null then 'OK' else 'FAIL' end
-- Hiding the pay column is only half of it: the rest of the table must stay readable,
-- or every page load fails with "Action non autorisée pour votre rôle".
union all select 'teachers still readable',
       case when has_column_privilege('authenticated','teachers','full_name','select')
             and has_column_privilege('authenticated','teachers','school_id','select') then 'OK' else 'FAIL' end
union all select 'teacher_pay readable by staff',
       case when has_table_privilege('authenticated','public.teacher_pay','select') then 'OK' else 'FAIL' end
union all select 'teacher_pay runs with owner rights',
       case when coalesce((select option_value from pg_class c, pg_options_to_table(c.reloptions)
                           where c.relname = 'teacher_pay' and option_name = 'security_invoker'), 'false') = 'false' then 'OK' else 'FAIL' end
union all select 'orders: visitors order through place_order only',
       case when has_function_privilege('anon','public.place_order(text,text,text,text,text,text,text,text,text)','execute')
             and (select count(*) from pg_policies where tablename = 'orders') = 0 then 'OK' else 'FAIL' end
union all select 'paid order opens the school',
       case when exists (select 1 from pg_trigger where tgname = 'open_school_on_payment') then 'OK' else 'FAIL' end
union all select 'orphan_user_id is service-role only',
       case when has_function_privilege('authenticated','public.orphan_user_id(text)','execute') then 'FAIL' else 'OK' end
union all select 'activity log write-protected',
       case when (select count(*) from pg_policies where tablename = 'activity_log') = 1 then 'OK' else 'FAIL' end;
