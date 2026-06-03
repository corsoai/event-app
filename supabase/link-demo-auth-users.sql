update public.profiles as profile
set auth_user_id = auth_user.id
from auth.users as auth_user
where lower(auth_user.email) = lower(profile.email)
  and profile.auth_user_id is null;

select
  profile.email,
  profile.full_name,
  profile.role,
  case when profile.auth_user_id is null then 'not linked' else 'linked' end as auth_status
from public.profiles as profile
order by profile.created_at;
