-- Drop the old FK to teacher_profiles
alter table public.assessments
  drop constraint if exists assessments_teacher_id_fkey;

-- Point it at profiles instead
alter table public.assessments
  add constraint assessments_teacher_id_fkey
  foreign key (teacher_id) references public.profiles(id) on delete cascade;

-- Same fix for attendance, which has the identical problem
alter table public.attendance
  drop constraint if exists attendance_teacher_id_fkey;

alter table public.attendance
  add constraint attendance_teacher_id_fkey
  foreign key (teacher_id) references public.profiles(id) on delete cascade;