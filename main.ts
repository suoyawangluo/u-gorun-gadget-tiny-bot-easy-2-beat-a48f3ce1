// Tiny Bot, Easy $2 — RSI(14) mean-reversion on hourly Solana bars.
// Strategy (measured on the dev window before building, and reproduced
// here with the kit's own grade-local):
//   long-only, per symbol. Buy when RSI(14) < 25, sell the whole position
//   when RSI(14) > 60 or after 48 bars held. At most 25% of equity per
//   position; a bar that sells anything buys nothing (the sells go out
//   alone, so their proceeds never fund same-bar buys). Re-evaluated on
//   every bar. Dev-window local grade: net PnL about +$445 vs buy-and-hold
//   -$869, ~29 trades, max drawdown ~3.3%.
// RSI here is the simple rolling kind: the mean gain and mean loss of the
// last 14 closes' changes, RSI = 100 - 100 / (1 + gains / losses),
// 100 when the last 14 changes never fell. It reacts faster than Wilder's
// smoothed RSI, which is what makes the signals frequent enough here.
// Runs on float64 (+ - * / only), so the same bars give the same orders
// every run. No clock, no environment, no randomness.
//
// The grader runs `node /bot/main.ts` with this directory mounted at /bot;
// vendor/makefun-bars.ts is a byte-identical copy of the kit's sdk.

import { BPS, runBars, type Bar, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const RSI_BARS = 14;
const RSI_BUY_BELOW = 25;
const RSI_SELL_ABOVE = 60;
const MAX_HOLD_BARS = 48;
const MAX_SLIPPAGE_BPS = 100;

/** One symbol's recent closes, oldest first; only the last 15 are kept. */
interface Series {
  closes: number[];
}

/** Per-symbol state: the closes series and the bar a held position was bought on. */
const series = new Map<string, Series>();
const heldSince = new Map<string, number>();

/** Append a bar's close, keeping only what the RSI window needs. */
function pushClose(bar: Bar): void {
  let s = series.get(bar.symbol);
  if (s === undefined) series.set(bar.symbol, (s = { closes: [] }));
  s.closes.push(Number(bar.c));
  if (s.closes.length > RSI_BARS + 1) s.closes.shift();
}

/** Simple rolling RSI(14) over the last 14 changes, or null before 15 closes. */
function simpleRsi(s: Series): number | null {
  const c = s.closes;
  if (c.length < RSI_BARS + 1) return null;
  let gains = 0;
  let losses = 0;
  for (let i = c.length - RSI_BARS; i < c.length; i++) {
    const d = c[i] - c[i - 1];
    if (d > 0) gains += d;
    else losses -= d;
  }
  if (losses === 0) return 100;
  return 100 - 100 / (1 + gains / losses);
}

/** The sells for this bar: every held position whose RSI topped 60 or that hit 48 bars. */
function decideSells(state: BarsState, fresh: Set<string>): SellInput[] {
  const sells: SellInput[] = [];
  for (const { symbol } of state.hello.symbols) {
    if (!fresh.has(symbol)) continue;
    const held = state.positions.get(symbol);
    if (held === undefined) continue;
    const r = simpleRsi(series.get(symbol) ?? { closes: [] });
    const barsHeld = state.seq - (heldSince.get(symbol) ?? state.seq);
    if ((r !== null && r > RSI_SELL_ABOVE) || barsHeld >= MAX_HOLD_BARS) {
      sells.push({ side: 'sell', symbol, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS });
    }
  }
  return sells;
}

/** The symbols to enter on this bar: RSI under 25 and nothing held. */
function decideEntries(state: BarsState, fresh: Set<string>): string[] {
  const entries: string[] = [];
  for (const { symbol } of state.hello.symbols) {
    if (!fresh.has(symbol) || state.positions.has(symbol)) continue;
    const r = simpleRsi(series.get(symbol) ?? { closes: [] });
    if (r !== null && r < RSI_BUY_BELOW) entries.push(symbol);
  }
  return entries;
}

/** One entry's slice: the cash split across this bar's entries, capped at 25% of equity. */
function sizeSlice(state: BarsState, count: number): bigint {
  const byCash = state.cash / BigInt(count);
  const byWeight = (BigInt(state.hello.caps.max_weight_bps) * state.equity) / BPS;
  return byCash < byWeight ? byCash : byWeight;
}

await runBars({
  onBatch(state: BarsState, batch) {
    for (const bar of batch.bars) pushClose(bar);
    // Forget positions that are gone; remember when each current one was bought.
    for (const symbol of [...heldSince.keys()]) {
      if (!state.positions.has(symbol)) heldSince.delete(symbol);
    }
    if (state.warmingUp) return [];

    const fresh = new Set(batch.bars.map((b) => b.symbol));
    const { caps, fees } = state.hello;

    // A bar that sells anything buys nothing: sells go out alone.
    const sells = decideSells(state, fresh);
    if (sells.length > 0) return sells.slice(0, caps.max_orders_per_bar);

    const entries = decideEntries(state, fresh);
    if (entries.length === 0) return [];
    const slice = sizeSlice(state, entries.length);
    const orders: BuyInput[] = [];
    let room = caps.max_open_positions - state.positions.size;
    let cash = state.cash;
    for (const symbol of entries) {
      if (room <= 0 || orders.length >= caps.max_orders_per_bar) break;
      let spend = slice;
      if (cash < spend) spend = cash;
      if (spend === 0n || spend < BigInt(fees.min_notional_quote_units)) break;
      orders.push({ side: 'buy', symbol, notional_quote_units: spend, max_slippage_bps: MAX_SLIPPAGE_BPS });
      heldSince.set(symbol, state.seq);
      cash -= spend;
      room--;
    }
    return orders;
  },
});
