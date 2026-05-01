CREATE OR REPLACE FUNCTION sync_item_status_from_availability(target_item_id text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE "Item" i
  SET "status" = CASE
    WHEN EXISTS (
      SELECT 1
      FROM "ItemAvailability" ia
      WHERE ia."itemId" = target_item_id
        AND ia."status" = 'AVAILABLE'::"ItemAvailabilityStatus"
        AND ia."endDate" > now()
        AND ia."endDate" > ia."startDate"
    )
      THEN 'AVAILABLE'::"ItemStatus"
    ELSE 'UNAVAILABLE'::"ItemStatus"
  END
  WHERE i."id" = target_item_id
    AND i."status" IN ('AVAILABLE'::"ItemStatus", 'UNAVAILABLE'::"ItemStatus");
END;
$$;

CREATE OR REPLACE FUNCTION trigger_sync_item_status_from_availability()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM sync_item_status_from_availability(OLD."itemId");
    RETURN OLD;
  END IF;

  PERFORM sync_item_status_from_availability(NEW."itemId");

  IF TG_OP = 'UPDATE' AND NEW."itemId" IS DISTINCT FROM OLD."itemId" THEN
    PERFORM sync_item_status_from_availability(OLD."itemId");
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "ItemAvailability_sync_item_status" ON "ItemAvailability";

CREATE TRIGGER "ItemAvailability_sync_item_status"
AFTER INSERT OR UPDATE OR DELETE ON "ItemAvailability"
FOR EACH ROW
EXECUTE FUNCTION trigger_sync_item_status_from_availability();

UPDATE "Item" i
SET "status" = 'UNAVAILABLE'::"ItemStatus"
WHERE i."status" = 'AVAILABLE'::"ItemStatus"
  AND NOT EXISTS (
    SELECT 1
    FROM "ItemAvailability" ia
    WHERE ia."itemId" = i."id"
      AND ia."status" = 'AVAILABLE'::"ItemAvailabilityStatus"
      AND ia."endDate" > now()
      AND ia."endDate" > ia."startDate"
  );
