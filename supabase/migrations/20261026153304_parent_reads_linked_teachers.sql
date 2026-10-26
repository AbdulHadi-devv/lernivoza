create policy "profiles_select_teacher_of_my_child"
  on public.profiles for select
  using (
    exists (
      select 1 from public.teacher_student_links tsl
      where tsl.teacher_id = profiles.id
        and public.is_parent_of(tsl.student_id)
    )
  );