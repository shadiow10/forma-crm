-- A full group takes no one else. Every way a student joins a group (the group drawer, a new
-- enrolment through create_enrollment) inserts into group_students, so the rule lives here.
-- Groups already over capacity keep their students; only new places are refused.
create or replace function private.check_group_capacity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_capacity integer;
begin
  -- Already in the group: let the insert's own "on conflict" deal with it.
  if exists (select 1 from public.group_students where group_id = new.group_id and student_id = new.student_id) then
    return new;
  end if;
  -- Lock the group so two people adding at once cannot both take the last seat.
  select capacity into v_capacity from public.groups where id = new.group_id for update;
  if (select count(*) from public.group_students where group_id = new.group_id) >= v_capacity then
    raise exception 'group % is full', new.group_id using errcode = 'CL002';
  end if;
  return new;
end;
$$;
revoke all on function private.check_group_capacity() from public;

create trigger group_capacity before insert on public.group_students
  for each row execute function private.check_group_capacity();
