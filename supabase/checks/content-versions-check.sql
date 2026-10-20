-- Behaviour check for content history (migrations 0004 + 0005). Safe on the live database:
-- everything runs in one block that always ends with an error, so every change is rolled back.
-- Paste into the Supabase SQL Editor and run. The editor shows "Failed to run sql query" on
-- purpose (that error is what undoes the test). Read the message:
--   "PASS: all 9 checks passed ..."  -> everything works
--   "FAIL: <list> ..."                -> the named checks did not behave as expected
do $$
declare
  n_after_edit int; n_after_reorder int; restored_name text; pos_after int; back boolean;
  proj text; links_before int; links_after int; proj_back boolean;
  v_id bigint; first_edit bigint; nonadmin_sees int := -1; anon_blocked boolean := false;
  failed text[];
begin
  -- Act as the admin, signed in.
  perform set_config('request.jwt.claims', '{"email":"letcal2003@gmail.com","role":"authenticated"}', true);
  execute 'set local role authenticated';

  -- A hidden test certificate, edited twice.
  insert into public.certificates (id, name, organization, issue_date, topic, description, published, sort_index)
  select 'test-item', 'Test A', organization, issue_date, topic, description, false, 999
  from public.certificates limit 1;
  update public.certificates set name = 'Test B' where id = 'test-item';
  update public.certificates set name = 'Test C' where id = 'test-item';
  select count(*) into n_after_edit from public.admin_list_versions('certificates', 'test-item');

  -- A reorder is not an edit.
  update public.certificates set sort_index = 5 where id = 'test-item';
  select count(*) into n_after_reorder from public.admin_list_versions('certificates', 'test-item');

  -- Restoring the first edit brings back 'Test A' and keeps the current position.
  select id into first_edit from public.admin_list_versions('certificates', 'test-item') order by id asc limit 1;
  perform public.admin_restore_version(first_edit);
  select name, sort_index into restored_name, pos_after from public.certificates where id = 'test-item';

  -- Delete, then undo.
  delete from public.certificates where id = 'test-item';
  select id into v_id from public.admin_list_versions('certificates', 'test-item') where op = 'delete' limit 1;
  perform public.admin_restore_version(v_id);
  select exists (select 1 from public.certificates where id = 'test-item') into back;

  -- Deleting a project cascades its skill links; undo brings them back.
  select project_id into proj from public.skill_links where project_id is not null
  group by project_id order by count(*) desc limit 1;
  select count(*) into links_before from public.skill_links where project_id = proj;
  delete from public.projects where id = proj;
  select id into v_id from public.admin_list_versions('projects', proj) where op = 'delete' limit 1;
  perform public.admin_restore_version(v_id);
  select exists (select 1 from public.projects where id = proj) into proj_back;
  select count(*) into links_after from public.skill_links where project_id = proj;

  -- Someone else signed in is refused (or, without the function check, sees nothing).
  perform set_config('request.jwt.claims', '{"email":"someone@else.com","role":"authenticated"}', true);
  begin
    select count(*) into nonadmin_sees from public.admin_list_versions('certificates', 'test-item');
  exception when others then nonadmin_sees := 0;
  end;
  -- The anon key cannot call it at all.
  execute 'set local role anon';
  begin
    perform public.admin_list_versions('certificates', 'test-item');
  exception when others then anon_blocked := true;
  end;

  failed := array_remove(array[
    case when n_after_edit <> 2 then format('edits=%s (want 2)', n_after_edit) end,
    case when n_after_reorder <> n_after_edit then format('reorder made a version (%s)', n_after_reorder) end,
    case when restored_name is distinct from 'Test A' then format('restored_name=%s', restored_name) end,
    case when pos_after is distinct from 5 then format('position=%s (want 5)', pos_after) end,
    case when not back then 'undo of delete' end,
    case when links_after <> links_before then format('links %s->%s', links_before, links_after) end,
    case when not proj_back then 'project restore' end,
    case when nonadmin_sees <> 0 then format('non-admin sees %s', nonadmin_sees) end,
    case when not anon_blocked then 'anon not blocked' end
  ], null);
  if cardinality(failed) = 0 then
    raise exception 'PASS: all 9 checks passed (edits=2, reorder ignored, restore keeps position, undo delete, % skill links restored, non-admin sees 0, anon blocked). Test data rolled back.', links_after;
  else
    raise exception 'FAIL: % . Test data rolled back.', array_to_string(failed, '; ');
  end if;
end $$;
