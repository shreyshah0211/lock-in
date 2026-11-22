# Locked rewards

Research behind this: `reports/Locked rewards for gym goals.md`.

## What it is and why

You pick something you want (a hoodie), set a goal, and lock it. You only get it if
you hit the goal. The lock is the point: a self-reward only motivates when missing the
goal really means no reward. No money is taken on failure, and Lock In never holds money.

## Goals

- A Rewards tab on Home, next to Friends.
- Paste a product link; the app fills in photo, name, price and sizes.
- Two kinds of goal: gym days by a date (default), or a weight by a date (guarded).
- Lock by holding a button. 24 hours to undo, then nothing can be edited.
- On a win: celebration, then one tap opens the store's checkout with the item in the cart.
- On a miss: marked missed, offer to lock it again.

## Not in this version

- Charging a card, holding money, or ordering without the user's tap (needs a company,
  a server and legal review).
- Forfeits, pots, bets, friends as referees.

## Must never happen

- A real gym day not being counted. Every check-in counts, and so does a gym visit of
  20 minutes or more noticed by the phone.
- A weight goal that asks for unsafe loss.
- Reward or weight data leaving the phone for this feature.

## Approaches considered

1. **Promise plus checkout link (chosen).** The money stays with the user until they
   tap pay on the brand's own store. Shippable now, no custody.
2. **Card on file, buy-for-me order on success.** Closest to "it orders it to your
   door", but needs a backend, a company, payment keys and a lawyer. Later.
3. **Charge up front, refund on a miss.** Holding funds for a month is the
   money-transmission line. Rejected.

## Design

- `S.rewards`: list, newest last. One can be active at a time.
  `{id, name, img, price, cur, url, buy, store, size, kind: 'gym'|'weight', target,
  fromKg, toKg, start, end, lockedAt, state: 'locked'|'won'|'missed'|'quit', doneAt,
  bought, pausedAt, paused}`.
- Gym days: distinct days from lock to end with a check-in or a 20-minute gym visit.
  Suggested target: recent pace times 1.2. The card shows how many days can still be missed.
- Period: to the end of this month, or 30 days when the month has under two weeks left.
- Weight: needs a recent weigh-in, age 18+ and height from Body goals. At most 1% of
  body weight a week down, 0.5% up, never below BMI 18.5. Judged on the 7-entry average.
- Lock: undo within 24 hours. After that only "Pause for injury" (once, up to 14 days,
  moves the end date) and "Give up" (recorded as missed).
- Product link: the iPhone app fetches the page (new `page` op in AppBridge, https only).
  Shopify stores: `/products/<handle>.js` for sizes and a `/cart/<variant>:1` checkout
  link. Other stores: Open Graph and JSON-LD, checkout link is the product page.
  If nothing can be read, the user types the name and price.
- Sample mode shows one locked sample reward so the tab is not empty.

## Left to the builder

Layout, copy, icons, tests.
