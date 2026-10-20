-- Behaviour check for content history (migrations 0004 + 0005). Safe on the live database:
-- everything runs in one block that always ends with an error, so every change is rolled back.
-- Paste into the Supabase SQL Editor and run. Expected: an error whose message starts with
-- "RESULT" and reads: edits=2 after_reorder=2 restored_name=Test A position_kept=t undo_delete=t
-- links N->N project_back=t nonadmin_sees=0 anon_blocked=t
do $$
declare
  n_after_edit int; n_after_reorder int; restored_name text; pos_after int; back boolean;
  proj text; links_before int; links_after int; proj_back boolean;
  v_id bigint; first_edit bigint; nonadmin_sees int := -1; anon_blocked boolean := false;
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

  raise exception 'RESULT edits=% after_reorder=% restored_name=% position_kept=% undo_delete=% links %->% project_back=% nonadmin_sees=% anon_blocked=%',
    n_after_edit, n_after_reorder, restored_name, pos_after = 5, back,
    links_before, links_after, proj_back, nonadmin_sees, anon_blocked;
end $$;
