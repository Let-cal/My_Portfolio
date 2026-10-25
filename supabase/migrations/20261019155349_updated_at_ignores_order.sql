-- Reordering a list only changes sort_index; keep updated_at so "Sửa gần nhất" shows real edits.
-- Additive: replaces the trigger function body only. Rollback: restore the body to
--   begin new.updated_at = now(); return new; end;
create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  -- A reorder only moves sort_index; it is not an edit, so "last edited" keeps its time.
  if (to_jsonb(new) - 'sort_index' - 'updated_at') = (to_jsonb(old) - 'sort_index' - 'updated_at') then
    new.updated_at = old.updated_at;
  else
    new.updated_at = now();
  end if;
  return new;
end;
$$;
