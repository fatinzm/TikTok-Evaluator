
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting daily scraper job...');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all creator handles from the database
    const { data: creators, error: creatorsError } = await supabase
      .from('creators')
      .select('handle');

    if (creatorsError) {
      throw new Error(`Failed to fetch creators: ${creatorsError.message}`);
    }

    if (!creators || creators.length === 0) {
      console.log('No creators found in database');
      return new Response(JSON.stringify({ 
        message: 'No creators found', 
        processed: 0 
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const results = [];
    
    // Process each creator
    for (const creator of creators) {
      try {
        console.log(`Processing creator: ${creator.handle}`);
        
        // Call the tiktok-scraper function for this creator
        const response = await fetch(`${supabaseUrl}/functions/v1/tiktok-scraper`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            handle: creator.handle,
            isScheduled: true
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to process ${creator.handle}: ${response.statusText}`);
        }

        const result = await response.json();
        results.push({
          handle: creator.handle,
          success: true,
          processed: result.results?.length || 0
        });

        console.log(`Successfully processed ${creator.handle}`);
        
        // Add a small delay between requests to be respectful
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Error processing creator ${creator.handle}:`, error);
        results.push({
          handle: creator.handle,
          success: false,
          error: error.message
        });
      }
    }

    const successful = results.filter(r => r.success).length;
    const total = results.length;

    console.log(`Daily scraper completed: ${successful}/${total} creators processed successfully`);

    return new Response(JSON.stringify({
      message: `Daily scraper completed`,
      totalCreators: total,
      successfullyProcessed: successful,
      results
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in daily-scraper function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
