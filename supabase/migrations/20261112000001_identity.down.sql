-- Reverts 20261112000001_identity.sql (run manually; Supabase CLI applies up migrations only).
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.create_workspace(text);
drop function if exists public.handle_new_user();
drop table if exists public.memberships;
drop table if exists public.workspaces;
drop table if exists public.profiles;
drop function if exists public.touch_updated_at();
drop function if exists public.is_active_member(uuid);
drop type if exists public.membership_status;
drop type if exists public.membership_role;
