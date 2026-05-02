DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.schemata
    WHERE schema_name = 'storage'
  ) THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('chat-images', 'chat-images', true)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.schemata
    WHERE schema_name = 'storage'
  ) THEN
    CREATE POLICY "Authenticated users can upload their own chat images"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (
      bucket_id = 'chat-images'
      AND (storage.foldername(name))[1] = 'chat'
      AND (storage.foldername(name))[2] = auth.uid()::text
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
    CREATE POLICY "Authenticated users can update their own chat images"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (
      bucket_id = 'chat-images'
      AND (storage.foldername(name))[1] = 'chat'
      AND (storage.foldername(name))[2] = auth.uid()::text
    )
    WITH CHECK (
      bucket_id = 'chat-images'
      AND (storage.foldername(name))[1] = 'chat'
      AND (storage.foldername(name))[2] = auth.uid()::text
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
    CREATE POLICY "Authenticated users can delete their own chat images"
    ON storage.objects
    FOR DELETE
    TO authenticated
    USING (
      bucket_id = 'chat-images'
      AND (storage.foldername(name))[1] = 'chat'
      AND (storage.foldername(name))[2] = auth.uid()::text
    );
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
