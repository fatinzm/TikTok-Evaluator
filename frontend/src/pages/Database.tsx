import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, Video, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Navigation from "@/components/Navigation";
import VideoModerationAssistant from "@/components/VideoModerationAssistant";

interface VideoValidationResult {
  videoUrl: string;
  tiktokUrl?: string;
  result: {
    status: 'approved' | 'rejected';
    reason: string;
    extractedText: string;
    duration: number;
    suggestions: string[];
    slackOutput: string;
  } | null;
  isValidating: boolean;
}

const Database = () => {
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [videos, setVideos] = useState<VideoValidationResult[]>([]);
  const { toast } = useToast();

  // Duration tolerance in seconds for max limits (allows slight overage)
  const DURATION_TOLERANCE = 1.0;

  // Helper function to capture video frame at specific timestamp
  const captureVideoFrameAtTime = async (videoUrl: string, timeInSeconds: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const videoElement = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      
      videoElement.crossOrigin = 'anonymous';
      videoElement.src = videoUrl;
      
      const timeout = setTimeout(() => {
        reject(new Error('Frame extraction timeout'));
      }, 10000);
      
      const handleCanPlay = () => {
        clearTimeout(timeout);
        videoElement.removeEventListener('canplay', handleCanPlay);
        videoElement.removeEventListener('error', handleError);
        
        try {
          canvas.width = videoElement.videoWidth || 720;
          canvas.height = videoElement.videoHeight || 1280;
          
          videoElement.currentTime = timeInSeconds;
          
          const handleSeeked = () => {
            videoElement.removeEventListener('seeked', handleSeeked);
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
            const base64 = canvas.toDataURL('image/png');
            resolve(base64);
          };
          
          videoElement.addEventListener('seeked', handleSeeked);
        } catch (err) {
          clearTimeout(timeout);
          reject(err);
        }
      };
      
      const handleError = () => {
        clearTimeout(timeout);
        videoElement.removeEventListener('canplay', handleCanPlay);
        videoElement.removeEventListener('error', handleError);
        reject(new Error('Failed to load video for frame extraction'));
      };
      
      videoElement.addEventListener('canplay', handleCanPlay);
      videoElement.addEventListener('error', handleError);
    });
  };

  const fetchTikTokVideos = async () => {
    if (!username.trim()) {
      toast({
        title: "Username required",
        description: "Please enter a TikTok username",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setVideos([]);

    try {
      console.log("🔄 Attempting to fetch from backend:", "http://localhost:8000/download");
      console.log("📤 Request payload:", { username: username.replace('@', '') });
      
      const response = await fetch("http://localhost:8000/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username: username.replace('@', '') }),
      });

      console.log("📥 Response status:", response.status);
      console.log("📥 Response headers:", response.headers);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("📊 Response data:", data);
      
      if (data.status === "success") {
        let videoResults: VideoValidationResult[] = data.video_urls.map((url: string) => ({
          videoUrl: `http://localhost:8000${url}`,
          result: null,
          isValidating: false,
        }));
        
        // Try to fetch canonical TikTok URLs via edge function
        try {
          const handle = username.replace('@', '');
          const { data: scrapeData, error: scrapeError } = await supabase.functions.invoke('tiktok-scraper', {
            body: { handle }
          });
          if (!scrapeError && scrapeData?.results) {
            const canonical = scrapeData.results.map((r: any) => `https://www.tiktok.com/@${handle}/video/${r.videoId}`);
            videoResults = videoResults.map((v, i) => ({ ...v, tiktokUrl: canonical[i] }));
          } else if (scrapeError) {
            console.warn('tiktok-scraper error:', scrapeError);
          }
        } catch (e) {
          console.warn('Failed to fetch canonical TikTok URLs:', e);
        }
        
        setVideos(videoResults);
        
        toast({
          title: "Videos fetched successfully",
          description: `Retrieved ${data.video_urls.length} videos for @${username}`,
        });
      } else {
        throw new Error(data.message || "Failed to fetch videos");
      }
    } catch (error) {
      console.error("❌ Error fetching TikTok videos:", error);
      console.error("🔍 Error details:", {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
      let errorMessage = "Failed to connect to backend";
      
      if (error instanceof Error) {
        if (error.message === "Failed to fetch") {
          errorMessage = "Cannot connect to backend at localhost:8000. Please ensure:\n1. Backend server is running\n2. CORS is configured\n3. No firewall blocking the connection";
        } else {
          errorMessage = error.message;
        }
      }

      toast({
        title: "Error fetching videos",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      fetchTikTokVideos();
    }
  };

  const validateVideo = async (videoIndex: number) => {
    const updatedVideos = [...videos];
    updatedVideos[videoIndex].isValidating = true;
    setVideos(updatedVideos);

    try {
      const video = updatedVideos[videoIndex];
      console.log(`🎥 Starting validation for video ${videoIndex + 1}:`, video.videoUrl);
      
      // Create a video element to analyze
      const videoElement = document.createElement('video');
      videoElement.src = video.videoUrl;
      videoElement.crossOrigin = 'anonymous';
      videoElement.muted = true;
      videoElement.preload = 'metadata';
      
      // Wait for video metadata to load properly with more robust error handling
      const duration = await new Promise<number>((resolve, reject) => {
        const timeout = setTimeout(() => {
          cleanup();
          reject(new Error('Video loading timeout'));
        }, 15000);

        let resolved = false;
        
        const cleanup = () => {
          clearTimeout(timeout);
          videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
          videoElement.removeEventListener('loadeddata', handleLoadedData);
          videoElement.removeEventListener('canplay', handleCanPlay);
          videoElement.removeEventListener('error', handleError);
        };

        const handleLoadedMetadata = () => {
          const dur = videoElement.duration;
          console.log(`📏 Video ${videoIndex + 1} duration from metadata:`, dur);
          
          if (!resolved && dur && dur > 0 && !isNaN(dur)) {
            resolved = true;
            cleanup();
            resolve(dur);
          }
        };

        const handleLoadedData = () => {
          const dur = videoElement.duration;
          console.log(`📏 Video ${videoIndex + 1} duration from loadeddata:`, dur);
          
          if (!resolved && dur && dur > 0 && !isNaN(dur)) {
            resolved = true;
            cleanup();
            resolve(dur);
          }
        };

        const handleCanPlay = () => {
          const dur = videoElement.duration;
          console.log(`📏 Video ${videoIndex + 1} duration from canplay:`, dur);
          
          if (!resolved && dur && dur > 0 && !isNaN(dur)) {
            resolved = true;
            cleanup();
            resolve(dur);
          }
        };

        const handleError = (e: any) => {
          if (!resolved) {
            resolved = true;
            cleanup();
            console.error(`❌ Video ${videoIndex + 1} failed to load:`, {
              error: e,
              url: videoElement.src,
              readyState: videoElement.readyState,
              networkState: videoElement.networkState,
              currentSrc: videoElement.currentSrc,
              videoWidth: videoElement.videoWidth,
              videoHeight: videoElement.videoHeight
            });
            
            // Try to fetch the URL directly to see if it's accessible
            fetch(videoElement.src, { method: 'HEAD' })
              .then(response => {
                console.error(`Video ${videoIndex + 1} HEAD request:`, {
                  status: response.status,
                  statusText: response.statusText,
                  headers: Object.fromEntries(response.headers.entries())
                });
              })
              .catch(fetchError => {
                console.error(`Video ${videoIndex + 1} HEAD request failed:`, fetchError);
              });
              
            reject(new Error(`Failed to load video ${videoIndex + 1} - Network state: ${videoElement.networkState}, Ready state: ${videoElement.readyState}`));
          }
        };


        videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
        videoElement.addEventListener('loadeddata', handleLoadedData);
        videoElement.addEventListener('canplay', handleCanPlay);
        videoElement.addEventListener('error', handleError);
        
        // Try to load the video
        videoElement.load();
        
        // Also try setting src again in case of caching issues
        setTimeout(() => {
          if (!resolved) {
            const originalSrc = videoElement.src;
            videoElement.src = '';
            videoElement.src = originalSrc + '?t=' + Date.now();
            videoElement.load();
          }
        }, 3000);
      });
      
      // Extract first frame using canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not get canvas context');

      // Wait for video to be ready for frame extraction
      const imageBase64 = await new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Frame extraction timeout'));
        }, 10000);

        const handleCanPlay = () => {
          clearTimeout(timeout);
          videoElement.removeEventListener('canplay', handleCanPlay);
          videoElement.removeEventListener('error', handleError);
          
          try {
            // Set canvas dimensions
            canvas.width = videoElement.videoWidth || 720;
            canvas.height = videoElement.videoHeight || 1280;
            
            // Seek to 0.5 seconds to avoid potential black frames
            videoElement.currentTime = 0.5;
            
            const handleSeeked = () => {
              videoElement.removeEventListener('seeked', handleSeeked);
              
              // Draw the frame
              ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
              console.log(`🖼️ Frame extracted for video ${videoIndex + 1}, canvas size:`, canvas.width, 'x', canvas.height);
              
              // Convert to base64
              const base64 = canvas.toDataURL('image/png');
              console.log(`📸 Base64 image length for video ${videoIndex + 1}:`, base64.length);
              resolve(base64);
            };
            
            videoElement.addEventListener('seeked', handleSeeked);
          } catch (err) {
            clearTimeout(timeout);
            reject(err);
          }
        };

        const handleError = (e: any) => {
          clearTimeout(timeout);
          videoElement.removeEventListener('canplay', handleCanPlay);
          videoElement.removeEventListener('error', handleError);
          reject(new Error('Failed to prepare video for frame extraction'));
        };

        videoElement.addEventListener('canplay', handleCanPlay);
        videoElement.addEventListener('error', handleError);
      });
      
      // Extract text using GPT-4o Vision
      console.log(`🔍 Extracting text from video ${videoIndex + 1}...`);
      const { data: textData, error: textError } = await supabase.functions.invoke('extract-text-from-video', {
        body: { 
          imageBase64,
          language: 'english' // Default to english, could be dynamic based on user preference
        }
      });
      
      if (textError) {
        console.error('Supabase function error:', textError);
        throw new Error('Failed to extract text from video: ' + textError.message);
      }
      
      let extractedText = textData?.extractedText || '';
      console.log(`📝 Extracted text from video ${videoIndex + 1}:`, extractedText);

      // If OCR produced a generic refusal like "I'm sorry, I can't assist with that", retry once with a different frame
      const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
      const refusalPattern = normalize("I'm sorry, I can't assist with that");
      if (normalize(extractedText) === refusalPattern) {
        try {
          console.warn('⚠️ Extracted refusal text detected — retrying OCR with a different frame...');
          const retryTime = Math.min(2, Math.max(1, duration - 1));
          const retryImageBase64 = await captureVideoFrameAtTime(video.videoUrl, retryTime);
          const { data: retryData, error: retryError } = await supabase.functions.invoke('extract-text-from-video', {
            body: {
              imageBase64: retryImageBase64,
              language: 'english'
            }
          });
          if (!retryError && retryData?.extractedText) {
            extractedText = retryData.extractedText;
            console.log(`🔁 Retry extracted text for video ${videoIndex + 1}:`, extractedText);
          } else if (retryError) {
            console.warn('Retry OCR failed:', retryError);
          }
        } catch (retryErr) {
          console.warn('Retry OCR error:', retryErr);
        }
      }
      
      // Validate using the same logic as VideoModerationAssistant
      const result = await validateVideoContent(extractedText, duration, videoIndex);
      
      const finalVideos = [...videos];
      finalVideos[videoIndex].isValidating = false;
      finalVideos[videoIndex].result = result;
      setVideos(finalVideos);
      
    } catch (error) {
      console.error(`❌ Validation error for video ${videoIndex + 1}:`, error);
      const finalVideos = [...videos];
      finalVideos[videoIndex].isValidating = false;
      finalVideos[videoIndex].result = {
        status: 'rejected',
        reason: error instanceof Error ? error.message : 'Validation failed',
        extractedText: '',
        duration: 0,
        suggestions: [],
        slackOutput: '❌ Validation failed: ' + (error instanceof Error ? error.message : 'Unknown error')
      };
      setVideos(finalVideos);
    }
  };

  const validateVideoContent = async (extractedText: string, duration: number, videoIndex: number) => {
    // Check for original content patterns
    const originalPatterns = [
      /story\s+time/i,
      /let\s+me\s+tell\s+you/i,
      /so\s+basically/i,
      /this\s+one\s+time/i,
      /i\s+was\s+just/i,
      /guys?\s+i\s+need\s+to\s+rant/i,
      /can\s+we\s+talk\s+about/i
    ];
    
    const isOriginalContent = originalPatterns.some(pattern => pattern.test(extractedText));
    
    if (isOriginalContent) {
      return {
        status: 'rejected' as const,
        reason: 'Original video detected',
        extractedText,
        duration,
        suggestions: [],
        slackOutput: '❌ Validated Post — This appears to be an original video. Feedback not supported yet.'
      };
    }
    
    // Detect video format based on duration
    const videoFormat = detectVideoFormat(duration);
    
    // Apply format-specific validation
    if (duration >= 10 && duration <= 20 + DURATION_TOLERANCE) {
      // Short Text + In-App Footage: 10-20 seconds (updated range)

      // Additional validation for Short Text + In-App Footage format
      const shortFormatChecks = await validateShortFormat(extractedText, duration, videos[videoIndex].videoUrl, videos[videoIndex].tiktokUrl);
      if (shortFormatChecks.status === 'rejected') {
        return shortFormatChecks;
      }
      
      // Validate against short hooks  
      const { isValid, suggestions, mostSimilarHook } = await validateHook(extractedText, 'short');
      
      if (isValid) {
        const slackOutput = `✅ Validated Post: Hook matched + ${duration.toFixed(1)}s (short format) + app footage detected`;
        return {
          status: 'approved' as const,
          reason: 'Hook matches validated short format, duration is correct, and format requirements met',
          extractedText,
          duration,
          suggestions: [],
          slackOutput
        };
      } else {
        // Create friendly feedback message for hook mismatch
        const link = videos[videoIndex].tiktokUrl || videos[videoIndex].videoUrl;
        const usernameFromUrl = videos[videoIndex].tiktokUrl?.match(/@([^/]+)/)?.[1] || link.match(/([^/]+)_video_\d+\.mp4$/)?.[1] || 'there';
        const suggestion = mostSimilarHook;
        
        const friendlyMessage = `Hey ${usernameFromUrl}! 👋\n\nJust some feedback on your latest video - the hook text didn't quite match our validated short format patterns. \n\nYour text: "${extractedText}"\n\nTry something like: "${suggestion}"\n\nWhat you did well:\n• ✅ Duration fits short format (${duration.toFixed(1)}s)\n• ✅ App footage detected\n\nVideo: ${link}`;
        
        return {
          status: 'rejected' as const,
          reason: 'Hook text does not match validated short formats',
          extractedText,
          duration,
          suggestions,
          slackOutput: friendlyMessage
        };
      }
    } else if (duration >= 5 && duration <= 10 + DURATION_TOLERANCE) {
      // Long Text: 5-10 seconds

      // Additional validation for Long Text format
      const longFormatChecks = await validateLongFormat(extractedText, duration, videoIndex);
      if (longFormatChecks.status === 'rejected') {
        return longFormatChecks;
      }
      
      // Validate against long hooks
      const { isValid, suggestions, mostSimilarHook } = await validateHook(extractedText, 'long');
      
      if (isValid) {
        const slackOutput = `✅ Validated Post: Hook matched + ${duration.toFixed(1)}s (long format) + text/action ratio verified`;
        return {
          status: 'approved' as const,
          reason: 'Hook matches validated long format, duration is correct, and format requirements met',
          extractedText,
          duration,
          suggestions: [],
          slackOutput
        };
      } else {
        // Create friendly feedback message for long format hook mismatch
        const link = videos[videoIndex].tiktokUrl || videos[videoIndex].videoUrl;
        const usernameFromUrl = videos[videoIndex].tiktokUrl?.match(/@([^/]+)/)?.[1] || link.match(/([^/]+)_video_\d+\.mp4$/)?.[1] || 'there';
        const suggestion = mostSimilarHook;
        
        const friendlyMessage = `Hey ${usernameFromUrl}! 👋\n\nJust some feedback on your latest video - the hook text didn't quite match our validated long format patterns.\n\nYour text: "${extractedText}"\n\nTry something like: "${suggestion}"\n\nWhat you did well:\n• ✅ Duration fits long format (${duration.toFixed(1)}s)\n• ✅ Text/action ratio looks good\n\nVideo: ${link}`;
        
        return {
          status: 'rejected' as const,
          reason: 'Hook text does not match validated long formats',
          extractedText,
          duration,
          suggestions,
          slackOutput: friendlyMessage
        };
      }
    } else {
      // Duration doesn't fit either format - create friendly feedback message
      const link = videos[videoIndex].tiktokUrl || videos[videoIndex].videoUrl;
      const usernameFromUrl = videos[videoIndex].tiktokUrl?.match(/@([^/]+)/)?.[1] || link.match(/([^/]+)_video_\d+\.mp4$/)?.[1] || 'there';
      
      const friendlyMessage = duration < 5 
        ? `Hey ${usernameFromUrl}! 👋\n\nJust some feedback from us - your last video (${duration.toFixed(1)}s) wasn't quite long enough for our formats. For your next video, could you try making it:\n\n📱 Short format (with app footage): 10-20 seconds\n📝 Long format (text + action): 5-10 seconds\n\nYour content idea was great though! Just needs a bit more time to really showcase it properly 🎥\n\nVideo: ${link}`
        : `Hey ${usernameFromUrl}! 👋\n\nJust some feedback from us - your last video (${duration.toFixed(1)}s) was a bit too long for our formats. For your next video, could you try keeping it to:\n\n📱 Short format (with app footage): 10-20 seconds\n📝 Long format (text + action): 5-10 seconds\n\nThe content was engaging! Just need to tighten up the timing a bit 🎯\n\nVideo: ${link}`;
      
      return {
        status: 'rejected' as const,
        reason: `Duration ${duration.toFixed(1)}s doesn't fit short format (10-20s) or long format (5-10s)`,
        extractedText,
        duration,
        suggestions: ['Adjust video length to fit format requirements'],
        slackOutput: friendlyMessage
      };
    }
  };

  // Validation for Short Text + In-App Footage format
  const validateShortFormat = async (extractedText: string, duration: number, videoUrl: string, tiktokUrl?: string) => {
    // Check for face-first video structure (4-5 seconds of face)
    const expectedFaceDuration = Math.min(5, Math.max(4, duration * 0.3)); // 4-5 seconds or 30% of video
    
    // Estimate text reading time (average 200 words per minute)
    const wordCount = extractedText.split(/\s+/).length;
    const estimatedReadingTime = (wordCount / 200) * 60; // seconds
    
      // Check if face duration makes sense for the format
      if (duration >= 10 && duration <= 20 + DURATION_TOLERANCE) {
        // Face should be 4-5 seconds, rest should be app footage
        const appFootageDuration = duration - expectedFaceDuration;
        
        if (appFootageDuration < 5 || appFootageDuration > 16) {
          const usernameFromUrl = videoUrl.match(/([^/]+)_video_\d+\.mp4$/)?.[1] || 'there';
          
          const friendlyMessage = `Hey ${usernameFromUrl}! 👋\n\nJust some feedback on your latest video structure - for short format videos, we need:\n\n😮 4-5 seconds of your face (shocked/annoyed expression)\n📱 5-16 seconds of clear app demonstration\n\nYour current structure: ${expectedFaceDuration.toFixed(1)}s face + ${appFootageDuration.toFixed(1)}s footage\n\nThe content idea is great! Just need to adjust the timing to give more focus to the app demo part 🎥\n\nVideo: ${videoUrl}`;
          
          return {
            status: 'rejected' as const,
            reason: `Short format should have 4-5s face + 5-16s app footage (current structure: ${expectedFaceDuration.toFixed(1)}s face + ${appFootageDuration.toFixed(1)}s footage)`,
            extractedText,
            duration,
            suggestions: ['Ensure 4-5 seconds of shocked/annoyed face followed by app demonstration'],
            slackOutput: friendlyMessage
          };
        }

      // Analyze video frames at 4s, 5s, 6s to detect app footage visually
      console.log('📱 Analyzing video frames for app footage detection...');
      
      try {
        // Capture frames at key timestamps
        const framePromises = [4, 5, 6].map(async (timestamp) => {
          return await captureVideoFrameAtTime(videoUrl, timestamp);
        });
        
        const frameImages = await Promise.all(framePromises);
        console.log('🖼️ Captured frames for app footage analysis:', frameImages.length);
        
        // Analyze frames with GPT-4o Vision
        const { data: appFootageData, error: appFootageError } = await supabase.functions.invoke('detect-app-footage', {
          body: { frameImages }
        });
        
        if (appFootageError) {
          console.error('App footage detection error:', appFootageError);
          // Continue with validation - don't fail just because of app footage detection
        } else {
          const { hasAppFootage, confidence, description } = appFootageData;
          console.log('📱 App footage detection result:', { hasAppFootage, confidence, description });
          
            if (!hasAppFootage || confidence < 0.7) {
              const usernameFromUrl = videoUrl.match(/([^/]+)_video_\d+\.mp4$/)?.[1] || 'there';
              const link = tiktokUrl || videoUrl;
              
              const friendlyMessage = `Hey ${usernameFromUrl}! 👋

Main takeaway: your intro face clip runs too long — start your app footage sooner.

For short format:
• Keep the face intro for 3-4s → then insert app footage after
• Include buttons/screens and an upload or selection moment

What you did well:
• ✅ Hook and overall timing were on point

Video: ${link}`;
              
              return {
                status: 'rejected' as const,
                reason: 'Short format should show app footage with image upload feature',
                extractedText,
                duration,
                suggestions: ['Include clear app demonstration showing mobile interface'],
                slackOutput: friendlyMessage
              };
            }
        }
      } catch (error) {
        console.error('Frame analysis error:', error);
        // Continue with validation - don't fail the entire validation
      }
    }

    return {
      status: 'approved' as const,
      reason: 'Short format structure validated',
      extractedText,
      duration,
      suggestions: [],
      slackOutput: ''
    };
  };

  // Validation for Long Text format  
  const validateLongFormat = async (extractedText: string, duration: number, videoIndex: number) => {
    // For now, long format videos are automatically approved
    // TODO: Add hook matching validation if needed

    // Check for background action indicators
    const backgroundActionIndicators = [
      /typing/i, /working/i, /computer/i, /laptop/i, /keyboard/i,
      /writing/i, /coding/i, /busy/i, /office/i, /desk/i
    ];
    
    // Check for lighting and visibility indicators (good text contrast)
    const textLength = extractedText.length;
    if (textLength < 50) {
      return {
        status: 'rejected' as const,
        reason: 'Long format requires substantial text overlay for good visibility and engagement',
        extractedText,
        duration,
        suggestions: [
          'Ensure text fills up the screen properly',
          'Use good lighting and high contrast for text visibility',
          'Include more comprehensive text content'
        ],
        slackOutput: `❌ Validated Post: Text content too brief for long format (${textLength} characters)`
      };
    }

    return {
      status: 'approved' as const,
      reason: 'Long format structure validated',
      extractedText,
      duration,
      suggestions: [],
      slackOutput: ''
    };
  };

  // Format detection based on duration
  const detectVideoFormat = (duration: number): 'short' | 'long' => {
    // Short format: 10-20 seconds, Long format: 5-10 seconds
    
    const shortMidpoint = 15; // Middle of 10-20 range
    const longMidpoint = 7.5; // Middle of 5-10 range
    
    const distanceToShort = Math.abs(duration - shortMidpoint);
    const distanceToLong = Math.abs(duration - longMidpoint);
    
    return distanceToLong < distanceToShort ? 'long' : 'short';
  };

  // Validated hooks arrays separated by format and language
  const validatedHooksLongEnglish = [
    "idk if its just me.. but is anyone else annoyed that everytime you try to buy new clothes you wished you could buy the same item BUT THRIFTED?? so its cheaper and better for the planet）so i built an app so when ur shopping irl you can just take a picture and find the same item in second-hand across vinted, ebay etc.",
    "ok be honest...is this a good idea?? i made an app like Vinted and Pinterest but in iri!! You can take a picture of any item and find the same item in second-hand across 50+ marketplaces",
    "ok be honest. is this a good idea?? I made an app like Pinterest + Vinted combined you can take a picture of any item on the go and find the same item in second-hand. It scans the internet and finds items across all your favourite marketplaces so you know you're getting the best deal",
    "idk if its just me... but does anyone else wish they could find the clothes from Pinterest outfits on Vinted?? Where you can upload a pic of the outfit and it finds the same items on Vinted so you can buy it so I built an app that lets you upload your Pinterest posts and automatically find the items on Vinted, and other secondhand sites!!",
    "idk if its just me... but does anyone else wish Vinted had an image search feature?? Where you can upload a pic of clothes and it finds the same item on Vinted so you can buy it so I built an app that lets you upload pics of clothes and automatically find the same on Vinted, and other sites!!",
    "i was definetly born in the right generations bcs wdym there is an app now that can find any clothes I want from pinterest but THRIFTED (on Vinted, Sellpy, etc) and I just need to upload a photo???",
    "i wish vinted had a feature for Image Search where you upload a pic and find the same item on Vinted so I did their job and built an app that lets you upload any pic, and then find the same item on Vinted, ebay, and other secondhand sites!!",
    "idk if its just me... but does anyone else wish Vinted had an item search by image feature?? i wish I could buy the clothes I see on Pinterest on Vinted so I built an app that lets you upload pics of clothes / PInterest posts and automatically find the same on Vinted, and other second hand sites!!",
    "i was definetly born in the right generation because wdym there's an app that finds my pinterest outfits on vinted for me ??!",
    "Omg surely i can't be the only one??  bc wdym there is an app now that can find any clothes I want from pinterest but THRIFTED (on Vinted, Sellpy, etc) and I just need to upload a photo???",
    "I was today years old when I realized I don't need to scroll for hours on Vinted anymore—I just upload a Pinterest outfit and this app finds the same items in second-hand. Who built this???",
    "I was today years old when i found out that the fashion industry is a scam bc wdym you can just take a screenshot of ANY item put it into this app and find the exact same cheaper and second-hand",
    "girl im sorry but the italian grandma selling her vintage (insert item) on Vinted for 3€ will not tag it under  (insert gen z version of the item) you NEED to be using an image search app that let's you upload an inspo pic and then searches Vinted",
    "hate to break it to you but the italian grandma selling her vintage (insert item) on Vinted for 3€ will not tag it under  (insert gen z version of the item) you NEED to be using an image search app that let's you upload an inspo pic and then searches Vinted"
  ];

  const validatedHooksLongGerman = [
    "ich komme definitiv aus der richtigen generation weil was meintst du es gibt einfach ne app die meine pintrest outfits für mich auf vinted findet???",
    "bin ich die einzige die vinted fast nie mehr benutzt seitdem so viele shein klamotten als vintage verkauft werden hab jetz eine andere app wo man fast fashion rausfiltern kann und es durchsucht vinted, sellpy USW.",
    ",,Kaufs doch einfach auf SHIEN WARUM wurde ich von SHEIN kaufen wenn es ne kostenlose App gibt die meine pinterest outfits second hand für mich findet??",
    "Unpopular opinion, aber die italienische Nonna, die ihre vintage Cavalli Mesh-Tops für 4 € verkauft, taggt sie halt nicht unter Y2K It-Girl Aesthetic. Du brauchst ne Bildsuch-App, wo du einfach dein Inspo-Pic hochlädst und die dann Vinted für dich durchscannt."
  ];

  const validatedHooksShortEnglish = [
    "if you're a pinterest girlie, I just made an app that lets u find any Pinterest Outfit on Vinted",
    "i just found this app that finds clothes on Vinted from my Pinterest boards...",
    "sick and tired of Shein polluting the environment so I finally did something about it and made this to BANKRUPT them...",
    "Vinted is never gonna add this, but I found an app that lets u find any Pinterest outfits on Vinted...",
    "wdym i can just take a picture of any item and find the exact same in second-hand 😭😭",
    ",,i want a (item name here) but i'm too broke :(,, lemme help you out! :)",
    "WHERE was this when i blew my student loan on (brand name here)??😭😭",
    "If Vinted knew about THIS they woulg go crazy 🙆‍♀️",
    "sick of *brand name here* ruining our planet with fast fashion so I built an app to BANKRUPT them",
    "3 YEARS ON VINTED AND IM ONLY FINDING THIS OUT NOW??",
    "it feels ILLEGAL to know this Vinted Hack",
    "My friend who works at XYZ showed me this trick and IM NOT OKAY",
    "the *brand name here* employee who LEAKED this is definetly getting fired"
  ];

  const validatedHooksShortGerman = [
    "leute omg.. ich habe gerade eine App gefunden die eure pinterest Outfit Traume erfultt...",
    "wurde Vinted DAS wissen wurden die safe so ausrasten!!"
  ];

  const detectLanguage = (text: string): 'english' | 'german' => {
    const normalizedText = text.toLowerCase();
    const germanIndicators = [
      'ich', 'bin', 'eine', 'der', 'die', 'das', 'und', 'oder', 'aber', 'weil', 'wenn', 'was', 'wie',
      'definitiv', 'generation', 'einfach', 'gibt', 'app', 'für', 'mich', 'auf', 'vinted', 
      'pinterest', 'outfits', 'findet', 'seitdem', 'nie', 'mehr', 'benutzt', 'shein', 'klamotten'
    ];
    
    const germanMatches = germanIndicators.filter(word => normalizedText.includes(word)).length;
    return germanMatches >= 3 ? 'german' : 'english';
  };

  // Fetch validated hooks from Supabase by format - ALWAYS use Supabase as primary source
  const getHooksByFormat = async (format?: 'short' | 'long'): Promise<string[]> => {
    try {
      const { data, error } = await supabase
        .from('hooks')
        .select('hook_text')
        .eq('content_type', format || 'mixed');
      
      if (error) {
        console.error('Failed to load hooks from Supabase:', error.message);
        throw error;
      }
      
      const hooks = (data || []).map((h: { hook_text: string }) => h.hook_text).filter(Boolean);
      console.log(`📚 Loaded ${hooks.length} ${format || 'mixed'} hooks from Supabase`);
      
      if (hooks.length === 0) {
        console.warn(`No ${format || 'mixed'} hooks found in Supabase table`);
      }
      
      return hooks;
    } catch (error) {
      console.error('Critical: Could not fetch hooks from Supabase:', error);
      // Only as absolute last resort, use minimal fallback
      if (format === 'short') return ['My friend who works at [brand] showed me this trick and IM NOT OKAY'];
      if (format === 'long') return ['idk if its just me... but does anyone else wish Vinted had an image search feature??'];
      return [];
    }
  };

  // Compute most similar hook from a list
  const pickMostSimilarHook = (text: string, hooks: string[]): string => {
    let best = '';
    let bestScore = 0;
    const normalized1 = text.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const words1 = normalized1.split(' ');
    hooks.forEach(hook => {
      const normalized2 = hook.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
      const words2 = normalized2.split(' ');
      const overlap = words1.filter(w => words2.includes(w)).length;
      const score = overlap / Math.max(words1.length, words2.length);
      if (score > bestScore) { bestScore = score; best = hook; }
    });
    return best;
  };

  const getSemanticSimilarity = (text1: string, text2: string): boolean => {
    const normalized1 = text1.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const normalized2 = text2.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const words1 = normalized1.split(' ');
    const words2 = normalized2.split(' ');
    
    const wordOverlap = words1.filter(word => words2.includes(word)).length;
    const wordScore = wordOverlap / Math.max(words1.length, words2.length);
    
    return wordScore > 0.6;
  };

  const validateHookWithGPT = async (text: string, format?: 'short' | 'long') => {
    // Load hooks from Supabase by format - ALWAYS use Supabase as primary source
    let hooks: string[] = [];
    try {
      hooks = await getHooksByFormat(format);
      if (hooks.length === 0) {
        console.error(`CRITICAL: No ${format || 'mixed'} hooks found in Supabase table. Please add hooks to the database.`);
        return {
          isValid: false,
          suggestions: ['Please add validated hooks to the Supabase hooks table'],
          mostSimilarHook: '',
          confidence: 0,
          reason: 'No hooks available in database for validation'
        };
      }
    } catch (error) {
      console.error('Failed to load hooks from Supabase for validation:', error);
      return {
        isValid: false,
        suggestions: ['Database connection error - unable to validate'],
        mostSimilarHook: '',
        confidence: 0,
        reason: 'Could not connect to hooks database'
      };
    }

    try {
      const { data, error } = await supabase.functions.invoke('semantic-hook-validation', {
        body: {
          extractedText: text,
          validHooks: hooks,
          contentType: format || 'mixed'
        }
      });

      if (error) {
        console.error('Semantic validation error:', error);
        // Fallback to old logic if GPT validation fails
        return validateHookFallback(text, format);
      }

      const { isValid, matchedHook, confidence, reason } = data;
      
      console.log('🤖 GPT Validation Result:', { isValid, matchedHook, confidence, reason });

      return {
        isValid: isValid && confidence > 0.5, // Lowered from 0.7 to be more lenient
        suggestions: isValid ? [] : [matchedHook || pickMostSimilarHook(text, hooks)],
        mostSimilarHook: matchedHook || pickMostSimilarHook(text, hooks),
        confidence,
        reason
      };
    } catch (error) {
      console.error('Error calling semantic validation:', error);
      // Even in fallback, still try to use hooks from Supabase
      const fallbackHooks = await getHooksByFormat(format).catch(() => []);
      return validateHookFallbackWithList(text, fallbackHooks);
    }
  };

  const validateHookFallbackWithList = (text: string, hooks: string[]) => {
    let mostSimilarHook = '';
    let bestSimilarity = 0;
    const isValid = hooks.some(hook => {
      const similarity = getSemanticSimilarity(text, hook);
      if (similarity && bestSimilarity === 0) {
        mostSimilarHook = hook;
        bestSimilarity = 1;
      }
      return similarity;
    });
    if (!isValid) {
      mostSimilarHook = pickMostSimilarHook(text, hooks);
    }
    return { isValid, suggestions: [], mostSimilarHook };
  };

  const validateHookFallback = async (text: string, format?: 'short' | 'long') => {
    // ALWAYS try Supabase first, even in fallback
    try {
      const hooks = await getHooksByFormat(format);
      return validateHookFallbackWithList(text, hooks);
    } catch (error) {
      console.error('Supabase hooks unavailable in fallback:', error);
      return {
        isValid: false,
        suggestions: ['Unable to validate - database hooks unavailable'],
        mostSimilarHook: 'Please check Supabase hooks table'
      };
    }
  };

  const validateHook = async (text: string, format?: 'short' | 'long') => {
    // ALWAYS use Supabase hooks table - this is the primary validation source
    return await validateHookWithGPT(text, format);
  };

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
        <div className="max-w-6xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold text-foreground mb-2 font-grotesk">
              Explore a TikTok Profile
            </h1>
            <p className="text-lg text-muted-foreground">
              Fetch and validate TikTok videos from any username
            </p>
          </div>

          {/* Input Section */}
          <Card className="shadow-lg border-2 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 font-grotesk">
                <Download className="h-5 w-5 text-primary" />
                Fetch TikTok Videos
              </CardTitle>
              <CardDescription>
                Enter a TikTok username to download and validate their 5 latest videos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">TikTok Username</Label>
                <div className="flex gap-2">
                  <Input
                    id="username"
                    type="text"
                    placeholder="@username or username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={isLoading}
                    className="flex-1"
                  />
                  <Button 
                    onClick={fetchTikTokVideos}
                    disabled={isLoading || !username.trim()}
                    className="px-6"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Fetching...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Fetch Videos
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Videos Section */}
          {videos.length > 0 && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-foreground font-grotesk">
                Downloaded Videos ({videos.length})
              </h2>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {videos.map((video, index) => (
                  <Card key={index} className="shadow-lg border-2 border-secondary/20">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Video className="h-5 w-5 text-secondary" />
                          Video {index + 1}
                        </span>
                        {video.result && (
                          <Badge variant={video.result.status === 'approved' ? 'default' : 'destructive'}>
                            {video.result.status === 'approved' ? (
                              <CheckCircle className="h-3 w-3 mr-1" />
                            ) : (
                              <XCircle className="h-3 w-3 mr-1" />
                            )}
                            {video.result.status}
                          </Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <video
                        src={video.videoUrl}
                        controls
                        className="w-full rounded-lg"
                        style={{ maxHeight: '400px' }}
                      />
                      
                      <Button
                        onClick={() => validateVideo(index)}
                        disabled={video.isValidating || video.result !== null}
                        className="w-full"
                        variant={video.result ? 'secondary' : 'default'}
                      >
                        {video.isValidating ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Validating...
                          </>
                        ) : video.result ? (
                          'Validation Complete'
                        ) : (
                          'Validate Video'
                        )}
                      </Button>

                      {video.result && (
                        <div className="mt-4 p-3 bg-muted rounded-lg space-y-2">
                          <p className="text-sm"><strong>Duration:</strong> {video.result.duration.toFixed(1)}s</p>
                          <p className="text-sm"><strong>Extracted Text:</strong> {video.result.extractedText}</p>
                          {video.result.reason && (
                            <p className="text-sm"><strong>Reason:</strong> {video.result.reason}</p>
                          )}
                          <div className="space-y-2">
                            <h4 className="font-medium">Slack Output:</h4>
                            <div className="relative">
                              <pre className="text-sm bg-muted p-3 rounded whitespace-pre-wrap overflow-x-auto">
                                {video.result.slackOutput}
                              </pre>
                              <Button
                                variant="outline"
                                size="sm"
                                className="absolute top-2 right-2"
                                onClick={() => {
                                  navigator.clipboard.writeText(video.result.slackOutput);
                                  toast({
                                    title: "Copied!",
                                    description: "Slack message copied to clipboard",
                                  });
                                }}
                              >
                                📋 Copy
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Database;