insert into public.subjects (name) values
  ('Mathematics'),
  ('English'),
  ('Physics'),
  ('Chemistry'),
  ('Biology'),
  ('Computer Science'),
  ('Urdu'),
  ('Islamiyat'),
  ('Social Studies')
on conflict (name) do nothing;