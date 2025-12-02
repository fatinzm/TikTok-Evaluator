import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TikTokVideo {
  id: string;
  desc: string;
  createTime: number;
  video: {
    playAddr: string;
    downloadAddr: string;
    duration: number;
  };
  music: {
    playUrl: string;
    duration: number;
  };
  stats: {
    playCount: number;
    shareCount: number;
    commentCount: number;
    diggCount: number;
  };
}

interface ScrapingRequest {
  handle: string;
  isScheduled?: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { handle, isScheduled = false }: ScrapingRequest = await req.json();

    if (!handle) {
      throw new Error('TikTok handle is required');
    }

    console.log(`Starting scraping for handle: ${handle}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get real TikTok videos using RapidAPI
    const tiktokVideos: TikTokVideo[] = await getRealTikTokVideos(handle);
    
    const results = [];
    
    for (const video of tiktokVideos) {
      try {
        console.log(`Processing video: ${video.id}`);
        
        // Extract text from video using existing system
        const extractedText = await extractTextFromVideo(video, supabaseUrl, supabaseKey);
        const duration = video.video.duration;
        
        // Validate the hook with stricter criteria
        const validation = validateTikTokHookStrict(extractedText, duration);
        
        // Store result in database
        const { error: insertError } = await supabase
          .from('tiktok_feedback')
          .insert({
            handle,
            video_url: video.video.playAddr,
            result: validation.status,
            hook_text: extractedText,
            duration,
            suggested_hook: validation.suggestions?.[0] || null
          });

        if (insertError) {
          console.error('Error inserting feedback:', insertError);
        }

        results.push({
          videoId: video.id,
          status: validation.status,
          hookText: extractedText,
          duration,
          suggestions: validation.suggestions,
          reason: validation.reason,
          videoUrl: video.video.playAddr
        });

      } catch (error) {
        console.error(`Error processing video ${video.id}:`, error);
        results.push({
          videoId: video.id,
          status: 'error',
          error: error.message,
          videoUrl: video.video.playAddr || null
        });
      }
    }

    return new Response(JSON.stringify({ 
      handle, 
      results,
      message: `Processed ${results.length} videos for @${handle}`
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("Error in tiktok-scraper function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

// Use TikTok-Api Python service for real video fetching
async function getRealTikTokVideos(handle: string): Promise<TikTokVideo[]> {
  console.log(`Fetching videos for @${handle} using TikTok-Api Python service`);
  
  // Get Python service URL from environment or use default
  const pythonServiceUrl = Deno.env.get('PYTHON_TIKTOK_SERVICE_URL') || 'http://localhost:8000';
  
  try {
    console.log(`Calling Python service at: ${pythonServiceUrl}/scrape/${handle}`);
    
    const response = await fetch(`${pythonServiceUrl}/scrape/${handle}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        handle: handle,
        count: 10
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Python service error:', errorText);
      throw new Error(`Python service failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`Python service returned ${data.videos.length} videos`);

    if (!data.videos || !Array.isArray(data.videos)) {
      throw new Error('Invalid response structure from Python service');
    }

    // Transform the response to our TikTokVideo interface
    const videos: TikTokVideo[] = data.videos.map((video: any, index: number) => ({
      id: video.id || `${handle}_video_${index + 1}`,
      desc: video.desc || '',
      createTime: video.createTime || Date.now() / 1000,
      video: {
        playAddr: video.video?.playAddr || '',
        downloadAddr: video.video?.downloadAddr || '',
        duration: video.video?.duration || 8
      },
      music: {
        playUrl: video.music?.playUrl || '',
        duration: video.music?.duration || 0
      },
      stats: {
        playCount: video.stats?.playCount || 0,
        shareCount: video.stats?.shareCount || 0,
        commentCount: video.stats?.commentCount || 0,
        diggCount: video.stats?.diggCount || 0
      }
    }));

    console.log(`Successfully processed ${videos.length} videos from Python service`);
    return videos;

  } catch (error) {
    console.error('Error calling Python service:', error);
    throw new Error(`Failed to fetch TikTok videos: ${error.message}`);
  }
}

// Updated function to extract text from video using existing system
async function extractTextFromVideo(video: TikTokVideo, supabaseUrl: string, supabaseKey: string): Promise<string> {
  console.log(`Extracting text from video: ${video.id}`);
  
  try {
    // Download the video file
    const videoResponse = await fetch(video.video.playAddr);
    if (!videoResponse.ok) {
      throw new Error(`Failed to download video: ${videoResponse.status}`);
    }

    const videoBlob = await videoResponse.arrayBuffer();
    console.log(`Downloaded video (${videoBlob.byteLength} bytes)`);

    // Convert video to base64 for processing
    const videoBase64 = `data:video/mp4;base64,${btoa(String.fromCharCode(...new Uint8Array(videoBlob)))}`;
    
    // Call the existing extract-text-from-video function
    const extractResponse = await fetch(`${supabaseUrl}/functions/v1/extract-text-from-video`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        imageBase64: videoBase64,
        language: 'english'
      }),
    });

    if (!extractResponse.ok) {
      const errorData = await extractResponse.text();
      console.error('Text extraction failed:', errorData);
      throw new Error(`Text extraction failed: ${extractResponse.status}`);
    }

    const extractData = await extractResponse.json();
    const extractedText = extractData.extractedText || '';
    
    console.log(`Extracted text from video ${video.id}: "${extractedText}"`);
    return extractedText;

  } catch (error) {
    console.error('Error extracting text from video:', error);
    // Fallback to video description if text extraction fails
    return video.desc || 'Unable to extract text from video';
  }
}

function validateTikTokHookStrict(extractedText: string, duration: number): {
  status: 'approved' | 'rejected' | 'original';
  reason?: string;
  suggestions?: string[];
} {
  const validatedHooksEnglish = [
    "idk if its just me.. but is anyone else annoyed that everytime you try to buy new clothes you wished you could buy the same item BUT THRIFTED",
    "ok be honest...is this a good idea?? i made an app like Vinted and Pinterest but in irl",
    "ok be honest. is this a good idea?? I made an app like Pinterest + Vinted combined",
    "im COOKED... i spent 8 months building the most INSANE app idea to It's like Pinterest + Vinted combined",
    "idk if its just me... but does anyone else wish they could find the clothes from Pinterest outfits on Vinted??",
    "idk if its just me... but does anyone else wish Vinted had an image search feature??",
    "i was definitely born in the right generation bcs wdym there is an app now that can find any clothes I want from Pinterest but THRIFTED",
    "i wish vinted had a feature for Image Search where you upload a pic and find the same item on Vinted",
    "idk if its just me... but does anyone else wish Vinted had an item search by image feature??",
    "i was definitely born in the right generation because wdym there's an app that finds my pinterest outfits on vinted for me ??!"
  ];

  const validatedHooksGerman = [
    "ich komme definitiv aus der richtigen generation weil was meinst du es gibt einfach ne app die meine pintrest outfits für mich auf vinted findet???",
    "bin ich die einzige die vinted fast nie mehr benutzt seitdem so viele shein klamotten als vintage verkauft werden hab jetz eine andere app wo man fast fashion rausfiltern kann und es durchsucht vinted, sellpy USW."
  ];

  const normalizedText = extractedText.toLowerCase().trim();
  
  // Check if it's original content (story format, personal rants)
  const originalContentPatterns = [
    /\b(morning routine|day in my life|story time|today i|yesterday|this morning)\b/i,
    /\b(let me tell you|so basically|guys today|hey everyone)\b/i,
    /\b(my experience|what happened|random story)\b/i
  ];
  
  for (const pattern of originalContentPatterns) {
    if (pattern.test(normalizedText)) {
      return {
        status: 'original',
        reason: 'This appears to be an original video. Feedback not supported yet.'
      };
    }
  }

  // Check duration
  const isDurationValid = duration >= 7 && duration <= 9;
  
  // Check hook validation with stricter criteria
  const allHooks = [...validatedHooksEnglish, ...validatedHooksGerman];
  const isHookValid = allHooks.some(hook => 
    getStrictSemanticSimilarity(normalizedText, hook.toLowerCase())
  );

  if (isHookValid && isDurationValid) {
    return { status: 'approved' };
  }

  const suggestions = generateStrictSuggestions(extractedText, allHooks);
  let reason = '';
  
  if (!isDurationValid && !isHookValid) {
    reason = 'Hook mismatch + wrong duration';
  } else if (!isDurationValid) {
    reason = 'Wrong duration (should be 7-9 seconds)';
  } else if (!isHookValid) {
    reason = 'Hook mismatch';
  }

  return {
    status: 'rejected',
    reason,
    suggestions
  };
}

function getStrictSemanticSimilarity(text1: string, text2: string): boolean {
  const normalized1 = normalizeText(text1);
  const normalized2 = normalizeText(text2);
  const words1 = normalized1.split(' ').filter(word => word.length > 2);
  const words2 = normalized2.split(' ').filter(word => word.length > 2);

  // Extract key phrases with stricter matching
  const keyPhrases1 = extractStrictKeyPhrases(normalized1);
  const keyPhrases2 = extractStrictKeyPhrases(normalized2);

  // Count matching key phrases with higher threshold
  const matchingPhrases = keyPhrases1.filter(phrase => keyPhrases2.includes(phrase));

  // Calculate similarity with stricter thresholds
  const phraseScore = matchingPhrases.length / Math.max(keyPhrases1.length, keyPhrases2.length);
  const wordOverlap = words1.filter(word => words2.includes(word)).length;
  const wordScore = wordOverlap / Math.max(words1.length, words2.length);
  
  // Stricter thresholds: require both higher phrase score AND word score
  return (phraseScore > 0.5 && wordScore > 0.6) || (phraseScore > 0.7 && wordScore > 0.4);
}

function extractStrictKeyPhrases(text: string): string[] {
  const phrases = [];

  // More specific key concept matching
  if (text.includes('vinted') && text.includes('pinterest')) phrases.push('platform_combination');
  if (text.includes('app') && (text.includes('vinted') || text.includes('pinterest'))) phrases.push('app_platform_reference');
  if (text.includes('thrift') || text.includes('second hand') || text.includes('vintage')) phrases.push('secondhand_concept');
  if ((text.includes('image search') || text.includes('photo') || text.includes('picture')) && text.includes('vinted')) phrases.push('vinted_image_search');
  if (text.includes('clothes') || text.includes('outfit') || text.includes('fashion')) phrases.push('fashion_related');
  if ((text.includes('find') || text.includes('search')) && (text.includes('pinterest') || text.includes('vinted'))) phrases.push('platform_search');
  if (text.includes('born in the right generation')) phrases.push('generation_phrase');
  if (text.includes('good idea') && text.includes('honest')) phrases.push('validation_seeking');
  if (text.includes('fast fashion') || text.includes('shein')) phrases.push('fast_fashion_rejection');
  
  return phrases;
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function generateStrictSuggestions(text: string, validHooks: string[]): string[] {
  const normalized = normalizeText(text);
  const suggestions = [];

  // Find most similar hook with stricter criteria
  const similarities = validHooks.map(hook => ({
    hook,
    similarity: calculateStrictSimilarity(normalized, normalizeText(hook))
  })).sort((a, b) => b.similarity - a.similarity);

  // Only suggest hooks with meaningful similarity (higher threshold)
  const topHooks = similarities.filter(({ similarity }) => similarity > 0.3).slice(0, 2);
  
  if (topHooks.length > 0) {
    topHooks.forEach(({ hook }) => {
      suggestions.push(hook);
    });
  } else {
    // Stricter fallback suggestions
    suggestions.push("Try using one of the validated hook patterns that specifically mentions both 'Vinted' and 'Pinterest'");
  }

  return suggestions.slice(0, 3);
}

function calculateStrictSimilarity(text1: string, text2: string): number {
  const words1 = text1.split(' ').filter(word => word.length > 2);
  const words2 = text2.split(' ').filter(word => word.length > 2);
  const overlap = words1.filter(word => words2.includes(word)).length;
  
  // Stricter similarity calculation
  const similarity = overlap / Math.max(words1.length, words2.length);
  
  // Bonus for exact phrase matches
  const phrases1 = extractStrictKeyPhrases(text1);
  const phrases2 = extractStrictKeyPhrases(text2);
  const phraseOverlap = phrases1.filter(phrase => phrases2.includes(phrase)).length;
  const phraseBonus = phraseOverlap > 0 ? 0.2 : 0;
  
  return similarity + phraseBonus;
}

serve(handler);
