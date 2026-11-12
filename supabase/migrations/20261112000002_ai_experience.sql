-- Onboarding asks how much the person has used AI; later phases use it to
-- pick a simpler or fuller set of features. Null = not answered.
alter table public.profiles
  add column ai_experience text
  check (ai_experience is null or ai_experience in ('new', 'some', 'regular'));
grant update (ai_experience) on public.profiles to authenticated;
