import "server-only";

// PITD Ledger helper
// Goal:
// - Always record history to pitd_transactions when PITD balance changes.
// - Keep inserts/selects resilient across small schema differences.
// - Do NOT modify UI or login flows.

type SupabaseAdmin = any;

export function normalizePitdAmount(input: any): number {
  const n = Number(input);
  if (!Number.isFinite(n)) throw new Error("INVALID_AMOUNT");
  if (n <= 0) throw new Error("INVALID_AMOUNT");

  // Max 6 decimals (spec)
  const scaled = Math.round(n * 1_000_000);
  const out = scaled / 1_000_000;
  if (out <= 0) throw new Error("INVALID_AMOUNT");
  return out;
}

export function isUuidLike(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    (v || "").trim(),
  );
}

export async function selectWalletByUserIds(
  supabaseAdmin: SupabaseAdmin,
  candidateUserIds: string[],
): Promise<null | {
  id: string;
  user_id: string;
  balance: any;
  locked_balance?: any;
  total_spent?: any;
  address?: any;
  created_at?: any;
}> {
  const ids = Array.from(
    new Set(candidateUserIds.map((v) => String(v || "").trim()).filter((v) => v && isUuidLike(v))),
  );
  if (ids.length === 0) return null;

  const { data, error } = await supabaseAdmin
    .from("pitd_wallets")
    .select("id,user_id,balance,locked_balance,total_spent,address,created_at")
    .in("user_id", ids)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.id) return null;
  return data;
}

export async function updateWalletBalance(
  supabaseAdmin: SupabaseAdmin,
  walletId: string,
  newBalance: number,
) {
  const { error } = await supabaseAdmin
    .from("pitd_wallets")
    .update({ balance: newBalance, updated_at: new Date().toISOString() })
    .eq("id", walletId);
  if (error) throw new Error(error.message);
}

type InsertTxArgs = {
  walletId: string;
  transactionType: string;
  amount: number; // signed
  balanceAfter: number;
  description?: string | null;
  referenceId?: string | null;
  referenceType?: string | null;
  metadata?: any;
};

/**
 * Insert a ledger row but tolerate environments where some optional columns differ.
 * We will retry with smaller payloads if DB complains about a missing column.
 */
export async function insertPitdTransaction(
  supabaseAdmin: SupabaseAdmin,
  args: InsertTxArgs,
) {
  const base: any = {
    wallet_id: args.walletId,
    transaction_type: args.transactionType,
    amount: args.amount,
    balance_after: args.balanceAfter,
    description: args.description ?? null,
    reference_id: args.referenceId ?? null,
    reference_type: args.referenceType ?? null,
    metadata: args.metadata ?? null,
  };

  // Variants from most-complete to minimal.
  const variants: any[] = [
    base,
    // Some schemas may not have reference_type
    (({ reference_type, ...rest }) => rest)(base),
    // Some schemas may not have balance_after
    (({ balance_after, ...rest }) => rest)(base),
    // Some schemas may not have both
    (({ reference_type, balance_after, ...rest }) => rest)(base),
  ];

  let lastErr: any = null;
  for (const payload of variants) {
    const { error } = await supabaseAdmin.from("pitd_transactions").insert(payload);
    if (!error) return;
    lastErr = error;

    // Only retry when it looks like a missing-column issue; otherwise stop.
    const msg = String(error?.message || "");
    const missingCol = msg.toLowerCase().includes("does not exist");
    if (!missingCol) break;
  }
  throw new Error(lastErr?.message || "TX_INSERT_FAILED");
}

export async function safeSelectPitdTransactions(
  supabaseAdmin: SupabaseAdmin,
  walletIds: string[],
  limit: number,
) {
  const ids = walletIds.filter(Boolean);
  if (ids.length === 0) return [];

  // Use select('*') to avoid breaking if some columns differ.
  const { data, error } = await supabaseAdmin
    .from("pitd_transactions")
    .select("*")
    .in("wallet_id", ids)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data : [];
}

// Filtered selector for history UI (tabs: received/sent, date range)
export async function safeSelectPitdTransactionsFiltered(
  supabaseAdmin: SupabaseAdmin,
  walletIds: string[],
  opts: {
    limit: number;
    // direction based on signed amount
    direction?: "in" | "out";
    // ISO strings
    from?: string;
    to?: string;
  },
) {
  const ids = walletIds.filter(Boolean);
  if (ids.length === 0) return [];

  let q = supabaseAdmin
    .from("pitd_transactions")
    .select("*")
    .in("wallet_id", ids);

  if (opts?.from) q = q.gte("created_at", opts.from);
  if (opts?.to) q = q.lte("created_at", opts.to);

  if (opts?.direction === "in") q = q.gt("amount", 0);
  if (opts?.direction === "out") q = q.lt("amount", 0);

  const limit = Math.min(Math.max(Number(opts?.limit || 50), 1), 200);

  const { data, error } = await q.order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return Array.isArray(data) ? data : [];
}
