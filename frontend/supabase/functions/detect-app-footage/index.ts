import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (!openAIApiKey) {
    return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { frameImages } = await req.json();

    if (!frameImages || frameImages.length === 0) {
      return new Response(JSON.stringify({ 
        hasAppFootage: false, 
        reason: 'No frames provided for analysis' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `You are an expert at detecting mobile app interfaces in video frames. Your job is to analyze video frames and determine if they show a mobile app interface/footage.

Look for these app interface indicators:
- Mobile app UI elements (buttons, navigation bars, screens)
- App-specific interfaces (photo selection, image upload screens, search interfaces)
- Mobile app layouts and designs
- Interactive elements typical of mobile applications
- Upload interfaces, photo galleries within apps
- Any clear mobile application interface

DO NOT consider these as app footage:
- Just text overlays on backgrounds
- Photos or images without app interface elements
- Websites viewed in browsers (unless it's clearly a mobile app)
- Pure video content without UI elements

Respond with a JSON object:
{
  "hasAppFootage": boolean,
  "confidence": number (0-1),
  "description": "brief description of what you see that indicates app footage or not",
  "frameAnalysis": ["analysis of each frame"]
}`;

    // Create messages with all frame images
    const messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Analyze these video frames (captured at 4s, 5s, 6s intervals) and determine if they show mobile app interface/footage:`
          },
          ...frameImages.map((base64Image: string, index: number) => ({
            type: 'image_url',
            image_url: {
              url: base64Image,
              detail: 'high'
            }
          }))
        ]
      }
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${data.error?.message || 'Unknown error'}`);
    }

    const result = JSON.parse(data.choices[0].message.content);

    console.log('🔍 App footage detection result:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in detect-app-footage function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      hasAppFootage: false,
      confidence: 0,
      description: 'Analysis failed due to technical error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});