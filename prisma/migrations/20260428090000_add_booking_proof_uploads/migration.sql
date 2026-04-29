ALTER TABLE "Booking"
ADD COLUMN IF NOT EXISTS "lenderHandoffProofUrl" TEXT,
ADD COLUMN IF NOT EXISTS "lenderHandoffProofUploadedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "borrowerReturnProofUrl" TEXT,
ADD COLUMN IF NOT EXISTS "borrowerReturnProofUploadedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Booking_lenderHandoffProofUploadedAt_idx"
ON "Booking" ("lenderHandoffProofUploadedAt");

CREATE INDEX IF NOT EXISTS "Booking_borrowerReturnProofUploadedAt_idx"
ON "Booking" ("borrowerReturnProofUploadedAt");

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.schemata
    WHERE schema_name = 'storage'
  ) THEN
    CREATE POLICY "Authenticated users can upload their own transaction proofs"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'item-images'
      AND (storage.foldername(name))[2] = auth.uid()::text
      AND (storage.foldername(name))[1] = 'transaction-proofs'
    );
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.schemata
    WHERE schema_name = 'storage'
  ) THEN
    CREATE POLICY "Authenticated users can update their own transaction proofs"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'item-images'
      AND (storage.foldername(name))[2] = auth.uid()::text
      AND (storage.foldername(name))[1] = 'transaction-proofs'
    )
    WITH CHECK (
      bucket_id = 'item-images'
      AND (storage.foldername(name))[2] = auth.uid()::text
      AND (storage.foldername(name))[1] = 'transaction-proofs'
    );
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.schemata
    WHERE schema_name = 'storage'
  ) THEN
    CREATE POLICY "Authenticated users can delete their own transaction proofs"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'item-images'
      AND (storage.foldername(name))[2] = auth.uid()::text
      AND (storage.foldername(name))[1] = 'transaction-proofs'
    );
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
