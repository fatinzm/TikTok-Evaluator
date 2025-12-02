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
    const { extractedText, validHooks, contentType } = await req.json();

    const systemPrompt = `You are a TikTok content validation expert. Your job is to determine if an extracted text from a video follows the GIST and SPIRIT of any validated hook patterns.

Key rules - BE LENIENT:
1. Focus on the OVERALL MEANING and STRUCTURE rather than exact wording
2. Allow significant word changes as long as the core message is similar
3. Variable parts can be completely substituted (brand names, items, apps, etc.)
4. Different phrasing that conveys the same idea should be accepted
5. Tone and general intent should be similar (excited, shocked, helpful, etc.)

Examples of VALID matches (be this flexible):
- "My friend who works at XYZ showed me this trick" matches "My colleague at ABC taught me this hack"
- "sick of Shein ruining our planet" matches "tired of fast fashion destroying the environment"
- "found this app that finds clothes" matches "discovered this tool that locates outfits"
- "Pinterest girlie" matches "Pinterest lover" or "Pinterest user"

Be generous with matches - if the general concept and structure are similar, it should pass.

Content Type: ${contentType}

Respond with a JSON object:
{
  "isValid": boolean,
  "matchedHook": "the hook pattern it matches" or null,
  "confidence": number (0-1),
  "reason": "brief explanation of why it matches/doesn't match"
}`;

    const userPrompt = `Extracted text: "${extractedText}"

Validated hooks to match against:
${validHooks.map((hook: string, index: number) => `${index + 1}. ${hook}`).join('\n')}

Does the extracted text match any of these hook patterns in structure and meaning?`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${data.error?.message || 'Unknown error'}`);
    }

    const result = JSON.parse(data.choices[0].message.content);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in semantic-hook-validation function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      isValid: false,
      confidence: 0,
      reason: 'Validation failed due to technical error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});