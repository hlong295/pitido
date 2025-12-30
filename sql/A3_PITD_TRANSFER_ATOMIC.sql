-- A3 (P0 → A → C): PITD Transfer Atomic + Ledger (chống double-spend)
--
-- Mục tiêu:
--  1) Chuyển trừ/cộng balance sang 1 transaction atomic trong DB (RPC / SQL function)
--  2) Ghi pitd_transactions 2 dòng: DEBIT (sender) + CREDIT (receiver)
--  3) Chống race condition (2 request cùng lúc) → không bị âm balance
--
-- Cách dùng:
--  - Chạy file SQL này trong Supabase SQL Editor.
--  - Sau đó API /app/api/pitd/transfer sẽ gọi RPC `pitd_transfer_atomic`.

-- (Tuỳ chọn) đảm bảo có gen_random_uuid()
create extension if not exists pgcrypto;

-- (Khuyến nghị) index để lookup ví theo address nhanh hơn
create index if not exists pitd_wallets_address_idx on public.pitd_wallets (address);

-- Atomic transfer + ledger 2 dòng
create or replace function public.pitd_transfer_atomic(
  p_sender_user_id uuid,
  p_to_address text,
  p_amount numeric,
  p_description text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_w public.pitd_wallets%rowtype;
  receiver_w public.pitd_wallets%rowtype;
  new_sender_balance numeric;
  new_receiver_balance numeric;
  debit_tx_id uuid;
  credit_tx_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  -- Lock sender wallet row
  select * into sender_w
  from public.pitd_wallets
  where user_id = p_sender_user_id
  limit 1
  for update;

  if not found then
    raise exception 'sender_wallet_not_found';
  end if;

  -- Lock receiver wallet row
  select * into receiver_w
  from public.pitd_wallets
  where address = p_to_address
  limit 1
  for update;

  if not found then
    raise exception 'recipient_wallet_not_found';
  end if;

  if receiver_w.user_id = p_sender_user_id then
    raise exception 'cannot_send_to_self';
  end if;

  if sender_w.balance < p_amount then
    raise exception 'insufficient_balance';
  end if;

  new_sender_balance := sender_w.balance - p_amount;
  new_receiver_balance := receiver_w.balance + p_amount;

  -- Apply balances
  update public.pitd_wallets
  set balance = new_sender_balance,
      total_spent = coalesce(total_spent, 0) + p_amount,
      updated_at = now()
  where id = sender_w.id;

  update public.pitd_wallets
  set balance = new_receiver_balance,
      updated_at = now()
  where id = receiver_w.id;

  -- Ledger: 2 dòng (DEBIT + CREDIT)
  debit_tx_id := gen_random_uuid();
  credit_tx_id := gen_random_uuid();

  insert into public.pitd_transactions(
    id,
    wallet_id,
    transaction_type,
    amount,
    balance_after,
    reference_id,
    reference_type,
    description,
    metadata,
    created_at
  ) values (
    debit_tx_id,
    sender_w.id,
    'transfer_debit',
    p_amount,
    new_sender_balance,
    receiver_w.user_id,
    'user',
    coalesce(p_description, 'Chuyển PITD'),
    jsonb_build_object(
      'to_address', p_to_address,
      'to_wallet_id', receiver_w.id,
      'to_user_id', receiver_w.user_id
    ) || coalesce(p_metadata, '{}'::jsonb),
    now()
  );

  insert into public.pitd_transactions(
    id,
    wallet_id,
    transaction_type,
    amount,
    balance_after,
    reference_id,
    reference_type,
    description,
    metadata,
    created_at
  ) values (
    credit_tx_id,
    receiver_w.id,
    'transfer_credit',
    p_amount,
    new_receiver_balance,
    p_sender_user_id,
    'user',
    coalesce(p_description, 'Nhận PITD'),
    jsonb_build_object(
      'from_wallet_id', sender_w.id,
      'from_user_id', p_sender_user_id
    ) || coalesce(p_metadata, '{}'::jsonb),
    now()
  );

  return jsonb_build_object(
    'ok', true,
    'sender_wallet_id', sender_w.id,
    'receiver_wallet_id', receiver_w.id,
    'sender_balance', new_sender_balance,
    'receiver_balance', new_receiver_balance,
    'debit_tx_id', debit_tx_id,
    'credit_tx_id', credit_tx_id
  );
end;
$$;

-- Cho phép gọi function qua API (RPC)
grant execute on function public.pitd_transfer_atomic(uuid, text, numeric, text, jsonb) to anon, authenticated, service_role;
