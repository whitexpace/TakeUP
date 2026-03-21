-- Create a public bucket for listing item images
INSERT INTO storage.buckets (id, name, public)
VALUES ('item-images', 'item-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload only under their own folder:
-- items/{auth.uid()}/{itemId}/{cover|gallery|original|thumb}/{filename}
DROP POLICY IF EXISTS "item_images_insert_own_folder" ON storage.objects;
CREATE POLICY "item_images_insert_own_folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'item-images'
  AND (storage.foldername(name))[1] = 'items'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Allow authenticated users to update only their own files
DROP POLICY IF EXISTS "item_images_update_own_folder" ON storage.objects;
CREATE POLICY "item_images_update_own_folder"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'item-images'
  AND (storage.foldername(name))[1] = 'items'
  AND (storage.foldername(name))[2] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'item-images'
  AND (storage.foldername(name))[1] = 'items'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Allow authenticated users to delete only their own files
DROP POLICY IF EXISTS "item_images_delete_own_folder" ON storage.objects;
CREATE POLICY "item_images_delete_own_folder"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'item-images'
  AND (storage.foldername(name))[1] = 'items'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Public read access is enabled by bucket.public = true.
-- If you switch the bucket to private later, add a SELECT policy instead.
