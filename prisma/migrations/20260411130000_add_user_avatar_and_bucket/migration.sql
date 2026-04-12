-- AlterTable
ALTER TABLE "User"
ADD COLUMN "avatarUrl" TEXT;

-- Create profile image bucket when running against Supabase.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.schemata
    WHERE schema_name = 'storage'
  ) THEN
    INSERT INTO storage.buckets (id, name, public)
    VALUES ('user-avatars', 'user-avatars', true)
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
