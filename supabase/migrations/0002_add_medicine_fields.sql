-- Add missing fields to medicines table
alter table medicines 
add column if not exists start_date date,
add column if not exists end_date date,
add column if not exists notes text;

-- Ensure days is text[] (already exists but good to be sure)
-- alter table medicines add column if not exists days text[]; 
