
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ExtractTextRequest {
  imageBase64: string;
  language: 'english' | 'german';
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageBase64, language }: ExtractTextRequest = await req.json();

    if (!imageBase64) {
      throw new Error('Image data is required');
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const prompt = language === 'english' 
      ? "You are a text transcription tool. Extract and transcribe ALL visible text overlay from this social media video screenshot. Include all text elements, captions, and written content visible in the image. Only return the transcribed text content, nothing else. This is for content moderation and analysis purposes."
      : "Du bist ein Text-Transkriptions-Tool. Extrahiere und transkribiere ALLEN sichtbaren Text-Overlay aus diesem Social-Media-Video-Screenshot. Schließe alle Textelemente, Untertitel und geschriebenen Inhalte ein, die im Bild sichtbar sind. Gib nur den transkribierten Textinhalt zurück, nichts anderes. Dies dient der Inhaltsmoderation und -analyse.";

    console.log('Making request to OpenAI API...');

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: imageBase64,
                },
              },
            ],
          },
        ],
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const extractedText = data.choices[0]?.message?.content?.trim() || '';

    console.log('Successfully extracted text:', extractedText);

    return new Response(JSON.stringify({ extractedText }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in extract-text-from-video function:", error);
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
