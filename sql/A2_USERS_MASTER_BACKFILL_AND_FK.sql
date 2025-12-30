-- A2 (P0 → A → C): Chuẩn hoá Master User & ràng buộc dữ liệu PITD
--
-- Mục tiêu:
--   1) Đảm bảo mọi user_id đang dùng trong PITD (public.pitd_wallets.user_id) đều tồn tại ở public.users (master)
--   2) (Khuyến nghị) Gắn FK public.pitd_wallets.user_id → public.users.id để bảo vệ dữ liệu
--
-- Lưu ý:
--   - Script này KHÔNG đụng UI / KHÔNG đụng flow login.
--   - Script chạy an toàn nhiều lần (idempotent) nhờ các lệnh IF NOT EXISTS / kiểm tra constraint.

begin;

-- 1) Backfill public.users từ public.pi_users (giữ nguyên id = pi_users.id)
insert into public.users (
  id,
  email,
  phone,
  pi_uid,
  pi_username,
  full_name,
  avatar_url,
  user_type,
  user_role,
  verification_status,
  totp_secret,
  totp_enabled,
  email_verified,
  email_verified_at,
  provider_approved,
  provider_approved_at,
  provider_approved_by,
  provider_business_name,
  provider_description,
  created_at,
  last_login_at
)
select
  p.id,
  null::text as email,
  null::text as phone,
  p.pi_uid,
  p.pi_username,
  p.full_name,
  null::text as avatar_url,
  'pi'::text as user_type,
  p.user_role,
  p.verification_status,
  null::text as totp_secret,
  false as totp_enabled,
  false as email_verified,
  null::timestamptz as email_verified_at,
  p.provider_approved,
  p.provider_approved_at,
  p.provider_approved_by,
  p.provider_business_name,
  p.provider_description,
  coalesce(p.created_at, now()) as created_at,
  now() as last_login_at
from public.pi_users p
where not exists (
  select 1 from public.users u where u.id = p.id
);

-- 2) Bổ sung mọi user_id đang tồn tại trong pitd_wallets nhưng thiếu ở public.users
--    (trường hợp hiếm: có wallet trước rồi mới có users, hoặc dữ liệu test)
insert into public.users (id, created_at, last_login_at)
select distinct w.user_id, now(), now()
from public.pitd_wallets w
where w.user_id is not null
  and not exists (select 1 from public.users u where u.id = w.user_id);

-- 3) Index hỗ trợ resolve theo pi_uid / pi_username (tăng tốc lookup)
create index if not exists idx_users_pi_uid on public.users (pi_uid);
create index if not exists idx_users_pi_username on public.users (pi_username);

-- 4) Thêm FK pitd_wallets.user_id → users.id (nếu chưa có)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'pitd_wallets_user_id_fkey'
      AND conrelid = 'public.pitd_wallets'::regclass
  ) THEN
    ALTER TABLE public.pitd_wallets
      ADD CONSTRAINT pitd_wallets_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES public.users (id)
      ON DELETE CASCADE;
  END IF;
END$$;

commit;
