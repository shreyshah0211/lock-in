# Pitch to brands: a discount people earn at the gym

For the developer to send. Fill in the parts in [brackets] before sending. Do not state
user numbers you do not have; a small honest pilot is an easier yes than a big claim.

## The email

Subject: [Brand] as a reward people train for (small pilot, no cost)

Hi [name],

I'm a student at the University of Washington and I built Lock In, an iPhone app for
gym consistency. People pick something they want, lock it behind a goal such as 20 gym
days in a month, and can only get it if they hit the goal.

The first thing I locked was a [Brand] [item]. I'd like to make that official with a
small pilot:

- Anyone who locks a [Brand] product and hits their goal gets [15]% off that product.
- People who miss get nothing, so the discount only goes to finishers.
- Lock In never takes payment. The finisher lands on your own checkout with the item in
  the cart and the code applied, and pays you directly.
- For a month, they see your product on their screen every day they train.

What I need from you is one discount code for the pilot. No fee, no contract, and you can
end it by switching the code off. Afterwards I'll send you how many people locked a
[Brand] product, how many finished, and how many used the code.

Would you be open to a 30-day pilot starting [date]?

Thanks,
[Your name]
[Link to a 20-second screen recording of locking a reward]

## Why a brand might say yes

- The discount is conditional. A normal welcome code goes to anyone; this one goes only
  to people who trained [20] days to get it.
- Their product is the goal, not an advert next to it.
- It costs nothing unless a sale happens.

## What to be honest about

- The app is new and small. Say how many people use it today: [number].
- A single shared code can leak, like any discount code. If they want one-time codes per
  person, that needs a small server, which Lock In does not have yet.
- You have no affiliate tracking set up. If they already use Shopify Collabs or another
  affiliate programme, ask to join it: that gives them tracking and may pay you a
  commission. If it does, the app must say so to users.

## Who to send it to

- Small and mid-size brands that sell on their own Shopify store, where the cart link and
  the code work today.
- Start with brands you already wear and train in, and brands with a student or community
  programme. Look for a "collabs", "ambassadors" or "partnerships" contact on their site.
- Send five to ten, each one written for that brand.

## When a brand says yes

Add one line to `RW_PARTNERS` in `src/js/28-rewards.js`:

```js
const RW_PARTNERS = { 'brand.com': { off: 15, code: 'THEIRCODE', by: 'Name, date agreed' } };
```

From then on, anyone locking a product from that store sees "[Brand] gives finishers 15%
off", never sees the code while locked, and gets it on the checkout when they win.
