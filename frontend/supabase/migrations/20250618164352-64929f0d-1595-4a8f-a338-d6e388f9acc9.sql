
-- Create table for storing TikTok feedback results
CREATE TABLE public.tiktok_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  handle TEXT NOT NULL,
  video_url TEXT NOT NULL,
  result TEXT NOT NULL, -- 'approved' or 'rejected' or 'original'
  hook_text TEXT,
  duration NUMERIC,
  suggested_hook TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for storing creator handles for daily scraping
CREATE TABLE public.creators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  handle TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add Row Level Security (RLS) to both tables
ALTER TABLE public.tiktok_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creators ENABLE ROW LEVEL SECURITY;

-- Create policies for tiktok_feedback table (public read access for now)
CREATE POLICY "Anyone can view tiktok feedback"
  ON public.tiktok_feedback
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert tiktok feedback"
  ON public.tiktok_feedback
  FOR INSERT
  WITH CHECK (true);

-- Create policies for creators table (public read/write access for now)
CREATE POLICY "Anyone can view creators"
  ON public.creators
  FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert creators"
  ON public.creators
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update creators"
  ON public.creators
  FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete creators"
  ON public.creators
  FOR DELETE
  USING (true);

-- Enable the pg_cron extension for scheduled tasks
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable the pg_net extension for HTTP requests from cron jobs
CREATE EXTENSION IF NOT EXISTS pg_net;
