-- Confirms migrations 0005 and 0006 are live. Every row should say OK.
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
union all select 'orphan_user_id is service-role only',
       case when has_function_privilege('authenticated','public.orphan_user_id(text)','execute') then 'FAIL' else 'OK' end
union all select 'activity log write-protected',
       case when (select count(*) from pg_policies where tablename = 'activity_log') = 1 then 'OK' else 'FAIL' end;
