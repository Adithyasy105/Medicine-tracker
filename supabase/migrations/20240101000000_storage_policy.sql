-- 1. Create the bucket 'medicine-images' if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('medicine-images', 'medicine-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Drop existing policies to avoid conflicts (optional, but good for idempotency)
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated views" ON storage.objects;

-- 3. Allow authenticated users to upload files to the 'medicine-images' bucket
CREATE POLICY "Allow authenticated uploads"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'medicine-images');

-- 4. Allow authenticated users to view files in the 'medicine-images' bucket
CREATE POLICY "Allow authenticated views"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'medicine-images');
