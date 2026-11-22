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

## Added after the second research round (2026-11-22)

Research: `reports/Reward ideas from other apps.md`. Check-in points were removed from the app at the user's request.

- **Cover:** the photo sits under tiles. A lock starts with a head start, each gym day earns at least one piece, and the user taps the tile it lifts (`r.picks`). Quarter marks are called out after a check-in.
- **Witness:** an optional name; the user sends the deal, progress grid and outcome through the share sheet. Nothing is sent by the app itself.
- **Sealed note:** optional text hidden at lock, shown on a win, or 30 days after a miss. Stored on the phone, not encrypted.
- **Miss:** named plainly, item locked out for 30 days, kept record beside past rewards. Out-of-reach rewards can be ended at once.
- **Money set aside:** a label only. The app never touches money.
- **Store watch:** twice a day the phone re-reads the product page for price and stock.
- **Shelf:** earned rewards as a grid. **Today card:** shows the current reward.
- **Reminders:** at most one a day (`notes` op in AppBridge), following the streak reminder switch.
- **First lock** can run two weeks.

Not built, and why: shielding the store's site (needs a paid Apple account and the Family Controls entitlement), a home-screen widget (untested on a free account), real friends as witnesses, duo or group rewards (need a server), brand discounts (need partners), arrival photo for the shelf.
