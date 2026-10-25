-- Realtime batch: live admin updates across tabs. Additive: one function, 10 triggers, one policy.
-- Rollback:
--   drop policy "admin_content_receive" on realtime.messages;
--   drop the 10 <table>_broadcast triggers;
--   drop function private.broadcast_content_change();

-- Live admin updates: a change note on a private Realtime topic only the admin can receive.
create or replace function private.broadcast_content_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  r jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  begin
    perform realtime.send(
      jsonb_build_object('table', tg_table_name, 'op', lower(tg_op), 'key', coalesce(r ->> 'id', r ->> 'key', r ->> 'skill_id')),
      'change',
      'admin:content',
      true
    );
  exception when others then
    -- Live updates are a convenience; the save itself must always go through.
    null;
  end;
  return null;
end;
$$;
revoke execute on function private.broadcast_content_change() from public, anon, authenticated;

create trigger profile_broadcast after insert or update or delete on public.profile for each row execute function private.broadcast_content_change();
create trigger roles_broadcast after insert or update or delete on public.roles for each row execute function private.broadcast_content_change();
create trigger experiences_broadcast after insert or update or delete on public.experiences for each row execute function private.broadcast_content_change();
create trigger projects_broadcast after insert or update or delete on public.projects for each row execute function private.broadcast_content_change();
create trigger skills_broadcast after insert or update or delete on public.skills for each row execute function private.broadcast_content_change();
create trigger skill_links_broadcast after insert or update or delete on public.skill_links for each row execute function private.broadcast_content_change();
create trigger certificates_broadcast after insert or update or delete on public.certificates for each row execute function private.broadcast_content_change();
create trigger activities_broadcast after insert or update or delete on public.activities for each row execute function private.broadcast_content_change();
create trigger education_broadcast after insert or update or delete on public.education for each row execute function private.broadcast_content_change();
create trigger why_cards_broadcast after insert or update or delete on public.why_cards for each row execute function private.broadcast_content_change();

create policy "admin_content_receive" on realtime.messages for select to authenticated using (realtime.topic() = 'admin:content' and private.is_admin());
