# u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1

[![make.fun · u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1.svg)](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1?utm_source=github&utm_medium=readme&utm_campaign=u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1)
[![rank](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/suoyawangluo/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/rank.svg)](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1)
[![reward](https://make.fun/badge/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/suoyawangluo/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1/reward.svg)](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1?utm_source=github&utm_medium=readme&utm_campaign=u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1)

A tiny paper-trading bot for hourly Solana prices — my entry for the [make.fun bounty](https://make.fun/bounty/u-gorun-gadget-tiny-bot-easy-2-beat-a48f3ce1).

## Strategy

RSI(14) mean-reversion, long-only, per symbol:

- **Buy** when the simple rolling RSI(14) drops below 25.
- **Sell** the whole position when RSI(14) rises above 60, or after 48 bars held.
- At most 25% of equity per position; a bar that sells anything buys nothing.
- Re-evaluated on every bar. No network, no clock, no randomness — the same bars always give the same orders.

## Measured on the dev window (kit's `grade-local --driver process`)

- Net PnL **+$442.45** (buy-and-hold baseline: −$869.34)
- 29 trades across all 7 symbols, max drawdown 3.3%

## Layout

- `main.ts` — the bot (runs as `node /bot/main.ts` under the grader)
- `vendor/makefun-bars.ts` — byte-identical copy of the kit's bars-replay SDK shim

Referral: `xxbm6cca` — https://make.fun/r/xxbm6cca
