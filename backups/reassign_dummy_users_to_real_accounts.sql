BEGIN;

-- Reassign items owned by dummy/generated accounts to the four real accounts,
-- then remove all remaining non-real users and their dependent dummy-only data.
--
-- Real usernames kept by this script:
--   - gpsolis2
--   - npguarin
--   - jslegaspo
--   - nppagaran
--
-- Distribution rule:
--   Items currently owned by non-real users are ranked by numericId and assigned
--   round-robin across the four real accounts.

DO $$
BEGIN
  IF (
    SELECT COUNT(*)
    FROM public."User"
    WHERE username IN ('gpsolis2', 'npguarin', 'jslegaspo', 'nppagaran')
  ) <> 4 THEN
    RAISE EXCEPTION
      'Expected exactly 4 real accounts (gpsolis2, npguarin, jslegaspo, nppagaran).';
  END IF;
END
$$;

CREATE TEMP TABLE real_users AS
SELECT
  u.id,
  u.username,
  row_number() OVER (ORDER BY u.username ASC) - 1 AS rn
FROM public."User" u
WHERE u.username IN ('gpsolis2', 'npguarin', 'jslegaspo', 'nppagaran');

CREATE TEMP TABLE dummy_users AS
SELECT
  u.id,
  u.username
FROM public."User" u
WHERE u.username NOT IN ('gpsolis2', 'npguarin', 'jslegaspo', 'nppagaran');

INSERT INTO public."Lender" ("userId", "lenderRating")
SELECT ru.id, 0
FROM real_users ru
LEFT JOIN public."Lender" l
  ON l."userId" = ru.id
WHERE l."userId" IS NULL;

INSERT INTO public."Borrower" ("userId", "borrowStatus", "borrowerRating")
SELECT ru.id, 'ACTIVE', 0
FROM real_users ru
LEFT JOIN public."Borrower" b
  ON b."userId" = ru.id
WHERE b."userId" IS NULL;

CREATE TEMP TABLE item_reassignment AS
WITH ranked_items AS (
  SELECT
    i.id AS item_id,
    i."numericId" AS item_numeric_id,
    i."lenderId" AS old_lender_user_id,
    row_number() OVER (ORDER BY i."numericId" ASC) - 1 AS rn
  FROM public."Item" i
  INNER JOIN dummy_users du
    ON du.id = i."lenderId"
)
SELECT
  ri.item_id,
  ri.item_numeric_id,
  ri.old_lender_user_id,
  ru.id AS new_lender_user_id
FROM ranked_items ri
INNER JOIN real_users ru
  ON ru.rn = ri.rn % (SELECT COUNT(*) FROM real_users);

ALTER TABLE item_reassignment
ADD COLUMN new_lender_profile_id INTEGER;

UPDATE item_reassignment ir
SET new_lender_profile_id = l.id
FROM public."Lender" l
WHERE l."userId" = ir.new_lender_user_id;

-- Reassign item owners.
UPDATE public."Item" i
SET "lenderId" = ir.new_lender_user_id
FROM item_reassignment ir
WHERE i.id = ir.item_id;

-- Keep lender-linked records aligned to the new item owner.
UPDATE public."Booking" b
SET "lenderId" = i."lenderId"
FROM public."Item" i
WHERE i.id = b."itemId"
  AND b."lenderId" IS DISTINCT FROM i."lenderId";

UPDATE public.transactions t
SET "lender_user_id" = i."lenderId"
FROM public."Item" i
WHERE i.id = t."item_id"
  AND t."lender_user_id" IS DISTINCT FROM i."lenderId";

UPDATE public."RequestOffer" ro
SET "lenderID" = l.id
FROM public."Item" i
INNER JOIN public."Lender" l
  ON l."userId" = i."lenderId"
WHERE i."numericId" = ro."itemID"
  AND ro."lenderID" IS DISTINCT FROM l.id;

-- Borrowed items linked to dummy borrowers should be cleared before removing users.
UPDATE public."Item"
SET "borrowerId" = NULL
WHERE "borrowerId" IN (SELECT id FROM dummy_users);

-- Remove dummy-user activity that would otherwise block deletion.
DELETE FROM public."CartEntry"
WHERE "borrowerId" IN (SELECT id FROM dummy_users);

DELETE FROM public."Like"
WHERE "userId" IN (SELECT id FROM dummy_users);

DELETE FROM public."RequestPost"
WHERE "requesterId" IN (SELECT id FROM dummy_users);

DELETE FROM public."AppNotification"
WHERE "recipientUserId" IN (SELECT id FROM dummy_users);

UPDATE public."AppNotification"
SET "actorUserId" = NULL
WHERE "actorUserId" IN (SELECT id FROM dummy_users);

DELETE FROM public.transaction_reviews
WHERE "reviewer_user_id" IN (SELECT id FROM dummy_users)
   OR "reviewee_user_id" IN (SELECT id FROM dummy_users);

DELETE FROM public.transaction_payments
WHERE "payer_user_id" IN (SELECT id FROM dummy_users)
   OR "payee_user_id" IN (SELECT id FROM dummy_users);

DELETE FROM public.transaction_disputes
WHERE "filed_by_user_id" IN (SELECT id FROM dummy_users);

UPDATE public.transaction_disputes
SET "admin_id" = NULL
WHERE "admin_id" IN (SELECT id FROM dummy_users);

UPDATE public.transaction_status_logs
SET "changed_by_user_id" = NULL
WHERE "changed_by_user_id" IN (SELECT id FROM dummy_users);

-- After lender sync, any remaining booking/transaction rows with dummy users are deleted.
DELETE FROM public."Booking"
WHERE "borrowerId" IN (SELECT id FROM dummy_users)
   OR "lenderId" IN (SELECT id FROM dummy_users);

DELETE FROM public.transactions
WHERE "borrower_user_id" IN (SELECT id FROM dummy_users)
   OR "lender_user_id" IN (SELECT id FROM dummy_users);

-- Removing dummy borrower/lender profiles will cascade any residual request/offer rows.
DELETE FROM public."Borrower"
WHERE "userId" IN (SELECT id FROM dummy_users);

DELETE FROM public."Lender"
WHERE "userId" IN (SELECT id FROM dummy_users);

DELETE FROM public."Admin"
WHERE "userId" IN (SELECT id FROM dummy_users);

DELETE FROM public."User"
WHERE id IN (SELECT id FROM dummy_users);

COMMIT;

-- Optional verification queries:
--   SELECT username FROM public."User" ORDER BY username;
--   SELECT i."numericId", i.name, u.username AS owner
--   FROM public."Item" i
--   JOIN public."User" u ON u.id = i."lenderId"
--   ORDER BY i."numericId";
