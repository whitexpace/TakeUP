# Rewards System Notes

- Rewards are activity-based. Base points come from valid completed transactions, and review bonuses come from submitting a valid review rather than from received star ratings.
- Disputed transactions are deferred while the dispute is active. Once resolved:
  - `BORROWER_AT_FAULT`: borrower base points are blocked, lender base points are allowed.
  - `LENDER_AT_FAULT`: lender base points are blocked, borrower base points are allowed.
  - `SHARED_FAULT`: both sides receive 50% of normal base points.
  - `DISMISSED` and `NO_FAULT`: both sides receive normal base points.
- Review bonuses follow the same dispute gate. Pending disputes defer the bonus, and the at-fault side does not receive the bonus after resolution.
- Reward processing is idempotent through per-event idempotency keys, so repeating completion or review processing updates existing reward events instead of duplicating them.
- Spendable balance is tracked separately from achievement-style totals:
  - `available_points` is reduced by redemptions.
  - `total_points_earned`, `borrower_points`, and `lender_points` are derived from positive applied reward events and are not reduced by boost spending.
- Listing boosts are MVP-scoped to one active 24-hour boost per item. Boost redemptions deduct points immediately and create an item boost record plus a negative reward event.
- Existing pre-event balances are preserved by backfilling a legacy manual-adjustment reward event so older balances are not lost when the event ledger recalculates totals.
