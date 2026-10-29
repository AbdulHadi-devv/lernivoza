create policy "profiles_select_parent_of_self"
  on public.profiles for select
  using (
    exists (
      select 1 from public.parent_child_links pcl
      where pcl.parent_id = profiles.id
        and pcl.child_id = auth.uid()
    )
  );