-- Create hooks table to cache Google Sheets data
CREATE TABLE public.hooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hook_text TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('long', 'short')),
  sheet_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hooks ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access (since hooks should be visible to everyone)
CREATE POLICY "Anyone can view hooks" 
ON public.hooks 
FOR SELECT 
USING (true);

-- Create policy for system updates (for the edge function to update hooks)
CREATE POLICY "System can manage hooks" 
ON public.hooks 
FOR ALL 
USING (true)
WITH CHECK (true);

-- Create index for better performance
CREATE INDEX idx_hooks_content_type ON public.hooks(content_type);
CREATE INDEX idx_hooks_updated_at ON public.hooks(updated_at);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_hooks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_hooks_updated_at
BEFORE UPDATE ON public.hooks
FOR EACH ROW
EXECUTE FUNCTION public.update_hooks_updated_at();