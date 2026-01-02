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
  p_idempotency_key text default null,
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
  existing_debit record;
  tx_candidates text[] := array['transfer','user_transfer','send','p2p','admin_grant','admin_revoke'];
  tx_type text;
  used_debit_type text;
  used_credit_type text;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_amount';
  end if;

  -- Enforce <= 6 decimals
  if p_amount <> round(p_amount, 6) then
    raise exception 'too_many_decimals';
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

  -- Idempotency: if we've already processed this request, return existing result
  if p_idempotency_key is not null and length(trim(p_idempotency_key)) > 0 then
    select id, balance_after, metadata
      into existing_debit
    from public.pitd_transactions
    where wallet_id = sender_w.id
      and transaction_type = 'transfer_debit'
      and (metadata->>'idempotency_key') = trim(p_idempotency_key)
    order by created_at desc
    limit 1;

    if found then
      return jsonb_build_object(
        'ok', true,
        'duplicate', true,
        'sender_wallet_id', sender_w.id,
        'sender_balance', existing_debit.balance_after,
        'debit_tx_id', existing_debit.id
      );
    end if;
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

  -- Ghi ledger DEBIT (người gửi) với transaction_type tương thích constraint hiện tại
used_debit_type := null;
foreach tx_type in array tx_candidates loop
  begin
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
      tx_type,
      p_amount,
      new_sender_balance,
      receiver_w.user_id,
      'user',
      coalesce(p_description, 'Chuyển PITD'),
      jsonb_build_object(
        'direction', 'debit',
        'tx_type_used', tx_type,
        'to_address', p_to_address,
        'to_wallet_id', receiver_w.id,
        'to_user_id', receiver_w.user_id
      ) || jsonb_build_object('idempotency_key', coalesce(trim(p_idempotency_key), '')) || coalesce(p_metadata, '{}'::jsonb),
      now()
    );
    used_debit_type := tx_type;
    exit;
  exception when check_violation then
    -- thử transaction_type tiếp theo
  end;
end loop;

if used_debit_type is null then
  raise exception 'PITD_TX_TYPE_NOT_ALLOWED';
end if;

  -- Ghi ledger CREDIT (người nhận) với transaction_type tương thích constraint hiện tại
used_credit_type := null;
foreach tx_type in array tx_candidates loop
  begin
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
      tx_type,
      p_amount,
      new_receiver_balance,
      p_sender_user_id,
      'user',
      coalesce(p_description, 'Nhận PITD'),
      jsonb_build_object(
        'direction', 'credit',
        'tx_type_used', tx_type,
        'from_wallet_id', sender_w.id,
        'from_user_id', p_sender_user_id
      ) || jsonb_build_object('idempotency_key', coalesce(trim(p_idempotency_key), '')) || coalesce(p_metadata, '{}'::jsonb),
      now()
    );
    used_credit_type := tx_type;
    exit;
  exception when check_violation then
    -- thử transaction_type tiếp theo
  end;
end loop;

if used_credit_type is null then
  raise exception 'PITD_TX_TYPE_NOT_ALLOWED';
end if;

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
grant execute on function public.pitd_transfer_atomic(uuid, text, numeric, text, text, jsonb) to anon, authenticated, service_role;
-- Legacy overload (if still present)
grant execute on function public.pitd_transfer_atomic(uuid, text, numeric, text, jsonb) to anon, authenticated, service_role;
