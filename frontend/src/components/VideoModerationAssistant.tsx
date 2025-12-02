import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, XCircle, Upload, Clock, MessageSquare, FileVideo, Loader2, Eye, Lightbulb, RefreshCw, User } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ModerationResult {
  status: 'approved' | 'rejected';
  reason?: string;
  extractedText: string;
  duration: number;
  suggestions?: string[];
  positiveAspects?: string[];
  faceDetectionResults?: {
    frame3: boolean;
    frame4: boolean;
    frame5: boolean;
  };
}

interface VideoModerationAssistantProps {
  contentType: 'short' | 'long' | null;
}

const VideoModerationAssistant = ({ contentType }: VideoModerationAssistantProps) => {
  const [extractedText, setExtractedText] = useState('');
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [moderationResult, setModerationResult] = useState<ModerationResult | null>(null);
  
  const [uploadedVideo, setUploadedVideo] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [videoPreview, setVideoPreview] = useState<string>('');
  const [faceDetectionResults, setFaceDetectionResults] = useState<{frame3: boolean; frame4: boolean; frame5: boolean} | null>(null);
  
  // Hard coded validated hooks
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

  // Get the appropriate hooks based on content type and language
  const getValidatedHooks = (language: 'english' | 'german') => {
    if (contentType === 'long') {
      return language === 'english' ? validatedHooksLongEnglish : validatedHooksLongGerman;
    } else {
      return language === 'english' ? validatedHooksShortEnglish : validatedHooksShortGerman;
    }
  };

  const validatedHooksEnglish = getValidatedHooks('english');
  const validatedHooksGerman = getValidatedHooks('german');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  // Log available hooks on component mount
  useEffect(() => {
    console.log(`Content type: ${contentType}`);
    console.log(`English hooks array:`, validatedHooksEnglish);
    console.log(`German hooks array:`, validatedHooksGerman);
    console.log(`Loaded ${validatedHooksEnglish.length} English hooks and ${validatedHooksGerman.length} German hooks for ${contentType} content`);
  }, [contentType, validatedHooksEnglish, validatedHooksGerman]);
  
  // Auto-detect language from extracted text
  const detectLanguage = (text: string): 'english' | 'german' => {
    const normalizedText = text.toLowerCase();
    
    // German-specific words/phrases that are strong indicators
    const germanIndicators = [
      'ich', 'bin', 'eine', 'der', 'die', 'das', 'und', 'oder', 'aber', 'weil', 'wenn', 'was', 'wie',
      'definitiv', 'generation', 'einfach', 'gibt', 'app', 'für', 'mich', 'auf', 'vinted', 
      'pinterest', 'outfits', 'findet', 'seitdem', 'nie', 'mehr', 'benutzt', 'shein', 'klamotten',
      'vintage', 'verkauft', 'anderen', 'fast', 'fashion', 'rausfiltern', 'kann', 'durchsucht',
      'komme', 'aus', 'richtigen', 'meintst', 'du', 'es', 'ne', 'meine', 'pintrest'
    ];
    
    // Count German indicators
    const germanMatches = germanIndicators.filter(word => normalizedText.includes(word)).length;
    
    // If we have multiple German indicators, it's likely German
    if (germanMatches >= 3) {
      return 'german';
    }
    
    // Check against validated hooks for better accuracy
    const englishMatches = validatedHooksEnglish.filter(hook => 
      getSemanticSimilarity(text, hook)
    ).length;
    
    const germanMatches2 = validatedHooksGerman.filter(hook => 
      getSemanticSimilarity(text, hook)
    ).length;
    
    // If we have more matches with German hooks, it's German
    if (germanMatches2 > englishMatches) {
      return 'german';
    }
    
    // Default to English
    return 'english';
  };

  const getDetectedLanguage = (text: string) => detectLanguage(text);
  
  const normalizeText = (text: string): string => {
    return text.toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  };
  const getSemanticSimilarity = (text1: string, text2: string): boolean => {
    const normalized1 = normalizeText(text1);
    const normalized2 = normalizeText(text2);
    const words1 = normalized1.split(' ');
    const words2 = normalized2.split(' ');

    // Extract key phrases and concepts with stricter matching
    const keyPhrases1 = extractKeyPhrases(normalized1);
    const keyPhrases2 = extractKeyPhrases(normalized2);

    // Count matching key phrases with higher threshold
    const matchingPhrases = keyPhrases1.filter(phrase => keyPhrases2.some(phrase2 => phrase.includes(phrase2) || phrase2.includes(phrase)));

    // Calculate similarity based on key phrases and word overlap with stricter thresholds
    const phraseScore = matchingPhrases.length / Math.max(keyPhrases1.length, keyPhrases2.length);
    const wordOverlap = words1.filter(word => words2.includes(word)).length;
    const wordScore = wordOverlap / Math.max(words1.length, words2.length);
    
    // Stricter thresholds: require both higher phrase score AND word score
    return (phraseScore > 0.5 && wordScore > 0.6) || (phraseScore > 0.7 && wordScore > 0.4);
  };
  const extractKeyPhrases = (text: string): string[] => {
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
  };
  const validateHook = (text: string): {
    isValid: boolean;
    suggestions: string[];
  } => {
    const detectedLanguage = getDetectedLanguage(text);
    const hooks = detectedLanguage === 'english' ? validatedHooksEnglish : validatedHooksGerman;

    // Check for semantic similarity with stricter criteria
    const isValid = hooks.some(hook => getSemanticSimilarity(text, hook));

    // Generate suggestions for improvement
    const suggestions = generateHookSuggestions(text, hooks);
    return {
      isValid,
      suggestions
    };
  };
  const generateHookSuggestions = (extractedText: string, validHooks: string[]): string[] => {
    const normalized = normalizeText(extractedText);
    const suggestions = [];

    // Find the most similar hooks with stricter similarity scoring
    const similarities = validHooks.map(hook => ({
      hook,
      similarity: calculateSimilarityScore(normalized, normalizeText(hook))
    })).sort((a, b) => b.similarity - a.similarity);

    // Only suggest hooks with meaningful similarity (higher threshold)
    const topHooks = similarities.filter(({ similarity }) => similarity > 0.3).slice(0, 2);
    
    // Generate specific modification suggestions based on what the user wrote
    const userWords = normalized.split(' ');
    const hasAppMention = userWords.some(word => ['app', 'application', 'platform'].includes(word));
    const hasActionWords = userWords.some(word => ['built', 'made', 'created', 'developed'].includes(word));
    const hasQuestionWords = userWords.some(word => ['honest', 'good', 'idea', 'think'].includes(word));
    const hasGenerationPhrase = normalized.includes('born in the right generation') || normalized.includes('right generation');
    const hasPlatformCombo = normalized.includes('vinted') && normalized.includes('pinterest');
    
    // Create more targeted suggestions with stricter requirements
    topHooks.forEach(({ hook, similarity }) => {
      if (similarity > 0.4) { // Higher threshold for suggestions
        let suggestion = '';
        
        // More specific word replacement suggestions
        if (hasAppMention && !hook.toLowerCase().includes('app')) {
          suggestion += `Replace generic "app/platform" with specific mentions like "Vinted" and "Pinterest" - `;
        }
        
        if (!hasPlatformCombo && (hook.toLowerCase().includes('vinted') && hook.toLowerCase().includes('pinterest'))) {
          suggestion += `Your hook needs to mention both "Vinted" AND "Pinterest" specifically - `;
        }
        
        if (hasActionWords && hook.toLowerCase().includes('found')) {
          suggestion += `Instead of "built/made", try "found" or "discovered" like: `;
        }
        
        if (hasQuestionWords && !hook.toLowerCase().includes('honest')) {
          suggestion += `Make it more casual with "be honest" or similar phrasing: `;
        }
        
        if (!hasGenerationPhrase && hook.toLowerCase().includes('born in the right generation')) {
          suggestion += `Add the viral phrase "born in the right generation": `;
        }
        
        // Add the hook as an example
        suggestion += `"${hook}"`;
        
        if (suggestion.length > 20) { // Only add meaningful suggestions
          suggestions.push(suggestion);
        }
      }
    });
    
    // Stricter fallback suggestions when no close matches found
    const detectedLanguage = getDetectedLanguage(extractedText);
    if (suggestions.length === 0) {
      if (detectedLanguage === 'english') {
        if (!normalized.includes('vinted') || !normalized.includes('pinterest')) {
          suggestions.push('Your hook must mention both "Vinted" AND "Pinterest" specifically - these are required platforms');
        }
        if (!hasQuestionWords && !hasGenerationPhrase) {
          suggestions.push('Use an engaging opening like "ok be honest..." or "i was definitely born in the right generation..."');
        }
        if (!normalized.includes('thrift') && !normalized.includes('second hand') && !normalized.includes('vintage')) {
          suggestions.push('Emphasize the secondhand/thrifting aspect with words like "thrifted", "vintage", or "second hand"');
        }
      } else {
        // German-specific stricter suggestions
        if (!normalized.includes('vinted')) {
          suggestions.push('Dein Hook muss "Vinted" spezifisch erwähnen');
        }
        if (!hasGenerationPhrase) {
          suggestions.push('Nutze die beliebte Phrase "definitiv aus der richtigen generation"');
        }
      }
    }

    return [...new Set(suggestions)].slice(0, 2); // Remove duplicates and limit to 2
  };
  const calculateSimilarityScore = (text1: string, text2: string): number => {
    const words1 = text1.split(' ').filter(word => word.length > 2); // Filter out short words
    const words2 = text2.split(' ').filter(word => word.length > 2);
    const overlap = words1.filter(word => words2.includes(word)).length;
    
    // Stricter similarity calculation
    const similarity = overlap / Math.max(words1.length, words2.length);
    
    // Bonus for exact phrase matches
    const phrases1 = extractKeyPhrases(text1);
    const phrases2 = extractKeyPhrases(text2);
    const phraseOverlap = phrases1.filter(phrase => phrases2.includes(phrase)).length;
    const phraseBonus = phraseOverlap > 0 ? 0.2 : 0;
    
    return similarity + phraseBonus;
  };
  const captureVideoFrame = (video: HTMLVideoElement, timeInSeconds: number): Promise<string> => {
    return new Promise((resolve, reject) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        reject(new Error('Canvas not found'));
        return;
      }
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      const handleSeeked = () => {
        video.removeEventListener('seeked', handleSeeked);
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob(blob => {
          if (!blob) {
            reject(new Error('Failed to create image blob'));
            return;
          }
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Failed to read image blob'));
          reader.readAsDataURL(blob);
        }, 'image/png');
      };

      video.addEventListener('seeked', handleSeeked);
      video.currentTime = timeInSeconds;
    });
  };
  const detectFaceWithGPT4o = async (imageBase64: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke('detect-face', {
        body: { imageBase64 }
      });
      
      if (error) {
        console.error('Face detection error:', error);
        return false;
      }
      
      return data.hasFace || false;
    } catch (error) {
      console.error('Error calling face detection function:', error);
      return false;
    }
  };
  const extractTextWithGPT4o = async (imageBase64: string): Promise<string> => {
    try {
      const { data, error } = await supabase.functions.invoke('extract-text-from-video', {
        body: { imageBase64, language: getDetectedLanguage(extractedText) }
      });
      
      if (error) {
        throw new Error(error.message || 'Failed to extract text');
      }
      
      return data.extractedText || '';
    } catch (error) {
      console.error('Error calling extract-text-from-video function:', error);
      throw error;
    }
  };
  const reanalyzeWithGPT4o = async () => {
    if (!videoRef.current) {
      toast({
        title: "Error",
        description: "Video not found. Please upload a video first.",
        variant: "destructive"
      });
      return;
    }

    setIsReanalyzing(true);
    try {
      console.log('Re-analyzing video with GPT-4o Vision...');
      
      // For short videos, capture and analyze frames at different times
      if (contentType === 'short') {
        const video = videoRef.current;
        
        // Extract text from frame at 1 second
        const textFrame = await captureVideoFrame(video, 1);
        const extractedText = await extractTextWithGPT4o(textFrame);
        
        // Check for faces at 3, 4, and 5 seconds
        const frame3 = await captureVideoFrame(video, 3);
        const frame4 = await captureVideoFrame(video, 4);
        const frame5 = await captureVideoFrame(video, 5);
        
        const face3 = await detectFaceWithGPT4o(frame3);
        const face4 = await detectFaceWithGPT4o(frame4);
        const face5 = await detectFaceWithGPT4o(frame5);

        const detectionResults = { frame3: face3, frame4: face4, frame5: face5 };
        setFaceDetectionResults(detectionResults);
        setExtractedText(extractedText);
        console.log('Face detection results:', detectionResults);
      } else {
        // For long videos, just extract text from frame at 1 second
        const imageBase64 = await captureVideoFrame(videoRef.current, 1);
        const extractedText = await extractTextWithGPT4o(imageBase64);
        setExtractedText(extractedText);
      }
      
      // Clear previous moderation result so user can moderate again
      setModerationResult(null);
      
      toast({
        title: "Re-analysis Complete",
        description: "Video has been re-analyzed. Please moderate the video again.",
      });
    } catch (error) {
      console.error('Error during re-analysis:', error);
      toast({
        title: "Re-analysis Failed",
        description: error instanceof Error ? error.message : "Failed to re-analyze video.",
        variant: "destructive"
      });
    } finally {
      setIsReanalyzing(false);
    }
  };
  const handleVideoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      toast({
        title: "Invalid File",
        description: "Please upload a video file.",
        variant: "destructive"
      });
      return;
    }

    setUploadedVideo(file);
    const videoUrl = URL.createObjectURL(file);
    setVideoPreview(videoUrl);

    setTimeout(() => {
      if (videoRef.current) {
        extractTextFromVideo(file);
      } else {
        toast({
          title: "Processing Error",
          description: "Failed to load video element. Please try again.",
          variant: "destructive"
        });
      }
    }, 100);
  };
  const extractTextFromVideo = async (videoFile: File) => {
    setIsProcessing(true);
    try {
      const video = videoRef.current;
      if (!video) {
        throw new Error('Video element not found. Please wait for video to load and try again.');
      }

      console.log('Video element found, starting processing...');

      // Wait for video to load metadata
      await new Promise<void>((resolve, reject) => {
        const handleLoadedMetadata = () => {
          console.log('Video metadata loaded, duration:', video.duration);
          setVideoDuration(video.duration);
          video.removeEventListener('loadedmetadata', handleLoadedMetadata);
          video.removeEventListener('error', handleError);
          resolve();
        };

        const handleError = () => {
          video.removeEventListener('loadedmetadata', handleLoadedMetadata);
          video.removeEventListener('error', handleError);
          reject(new Error('Failed to load video'));
        };

        if (video.readyState >= 1) {
          handleLoadedMetadata();
        } else {
          video.addEventListener('loadedmetadata', handleLoadedMetadata);
          video.addEventListener('error', handleError);
          video.load();
        }
      });

      if (contentType === 'short') {
        // For short videos: extract text from 1 second, check faces at 3, 4, 5 seconds
        const textFrame = await captureVideoFrame(video, 1);
        const extractedText = await extractTextWithGPT4o(textFrame);
        setExtractedText(extractedText);

        console.log('Checking for faces at 3, 4, and 5 seconds...');
        const frame3 = await captureVideoFrame(video, 3);
        const frame4 = await captureVideoFrame(video, 4);
        const frame5 = await captureVideoFrame(video, 5);

        const face3 = await detectFaceWithGPT4o(frame3);
        const face4 = await detectFaceWithGPT4o(frame4);
        const face5 = await detectFaceWithGPT4o(frame5);

        const detectionResults = { frame3: face3, frame4: face4, frame5: face5 };
        setFaceDetectionResults(detectionResults);
        
        console.log('Face detection results:', detectionResults);
        
        toast({
          title: "Analysis Complete",
          description: `Text extracted and face detection completed using GPT-4o Vision.`
        });
      } else {
        // For long videos: just extract text from 1 second
        const imageBase64 = await captureVideoFrame(video, 1);
        const extractedText = await extractTextWithGPT4o(imageBase64);
        setExtractedText(extractedText);
        
        toast({
          title: "Text Extracted",
          description: "Successfully extracted text using GPT-4o Vision."
        });
      }
    } catch (error) {
      console.error('Error processing video:', error);
      toast({
        title: "Processing Error",
        description: error instanceof Error ? error.message : "Failed to process video.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };
  const moderateVideo = () => {
    if (!extractedText.trim() || videoDuration <= 0) {
      toast({
        title: "Missing Information",
        description: "Please provide both extracted text and video duration.",
        variant: "destructive"
      });
      return;
    }

    // Different validation logic based on content type
    let isDurationValid = false;
    let hookValidation = { isValid: false, suggestions: [] as string[] };
    
    if (contentType === 'short') {
      // Short videos: 12-18 seconds
      isDurationValid = videoDuration >= 12 && videoDuration <= 18;
      hookValidation = validateHook(extractedText);
    } else {
      // Long videos: 6-9 seconds
      isDurationValid = videoDuration >= 6 && videoDuration <= 9;
      hookValidation = validateHook(extractedText);
    }

    let status: 'approved' | 'rejected' = 'approved';
    let reason = '';
    const suggestions: string[] = [...hookValidation.suggestions];
    const positiveAspects: string[] = [];

    // Identify positive aspects first
    if (contentType === 'short') {
      // Check for proper face detection in first 4-5 seconds
      if (faceDetectionResults) {
        const faceInFirst4_5Seconds = faceDetectionResults.frame3 || faceDetectionResults.frame4 || faceDetectionResults.frame5;
        if (faceInFirst4_5Seconds) {
          positiveAspects.push("✅ Face detected in first 4-5 seconds");
          
          // Check if proper structure: face clip then cuts to app footage
          if (videoDuration >= 8) {
            positiveAspects.push("✅ Proper structure: Face clip (4-5s) → App footage");
          }
        }
      }
      
      // Check for app footage section (remaining duration after face clip)
      if (videoDuration >= 8) {
        positiveAspects.push("✅ Video includes app footage section");
      }
      
      // Validate opening face clip duration
      if (videoDuration >= 4 && videoDuration <= 5) {
        positiveAspects.push("✅ Good opening face clip duration (4-5 seconds)");
      }
    } else {
      // Long video positive aspects
      if (extractedText.length > 20) {
        positiveAspects.push("✅ Substantial text content extracted");
      }
      
      if (videoDuration >= 5 && videoDuration <= 8) {
        positiveAspects.push("✅ Good base video length for text overlay");
      }
    }

    // General positive aspects for both types
    if (extractedText.toLowerCase().includes('vinted') || extractedText.toLowerCase().includes('pinterest')) {
      positiveAspects.push("✅ Mentions relevant platforms (Vinted/Pinterest)");
    }
    
    if (extractedText.toLowerCase().includes('app') || extractedText.toLowerCase().includes('thrift') || extractedText.toLowerCase().includes('second hand')) {
      positiveAspects.push("✅ Contains relevant keywords for the concept");
    }

    if (hookValidation.isValid) {
      positiveAspects.push("✅ Hook matches validated patterns");
    }

    if (isDurationValid) {
      positiveAspects.push(`✅ Duration is within optimal range (${contentType === 'short' ? '12-18' : '6-9'} seconds)`);
    }

    // Add duration-specific suggestions
    if (contentType === 'short') {
      if (videoDuration > 18) {
        suggestions.unshift("Consider shortening your video to 12-18 seconds for short format");
      } else if (videoDuration < 12) {
        suggestions.unshift("Consider extending your video to at least 12 seconds for short format");
      }
    } else {
      if (videoDuration > 9) {
        suggestions.unshift("Consider shortening your video to 6-9 seconds for long text format");
      } else if (videoDuration < 6) {
        suggestions.unshift("Consider extending your video to at least 6 seconds for long text format");
      }
    }

    if (!isDurationValid && !hookValidation.isValid) {
      status = 'rejected';
      reason = 'wrong duration + hook mismatch';
    } else if (!isDurationValid) {
      status = 'rejected';
      reason = 'wrong duration';
    } else if (!hookValidation.isValid) {
      status = 'rejected';
      reason = 'hook mismatch';
    }

    const result: ModerationResult = {
      status,
      reason,
      extractedText,
      duration: videoDuration,
      suggestions,
      positiveAspects
    };

    setModerationResult(result);
    
    toast({
      title: status === 'approved' ? "Video Approved" : "Video Rejected",
      description: status === 'approved' ? "Content meets all requirements" : `Rejected: ${reason}`,
      variant: status === 'approved' ? "default" : "destructive"
    });
  };
  const resetModeration = () => {
    setModerationResult(null);
    setExtractedText('');
    setVideoDuration(0);
    setUploadedVideo(null);
    setVideoPreview('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const findMostSimilarHook = (extractedText: string): string => {
    const detectedLanguage = getDetectedLanguage(extractedText);
    const hooks = detectedLanguage === 'english' ? validatedHooksEnglish : validatedHooksGerman;
    const normalized = normalizeText(extractedText);
    
    const similarities = hooks.map(hook => ({
      hook,
      similarity: calculateSimilarityScore(normalized, normalizeText(hook))
    })).sort((a, b) => b.similarity - a.similarity);
    
    return similarities[0].hook;
  };

  const getValidationExplanation = (extractedText: string, duration: number): string => {
    const detectedLanguage = getDetectedLanguage(extractedText);
    const hooks = detectedLanguage === 'english' ? validatedHooksEnglish : validatedHooksGerman;
    const isHookValid = hooks.some(hook => getSemanticSimilarity(extractedText, hook));
    
    let durationRange = '';
    if (contentType === 'short') {
      durationRange = '12-18 seconds';
    } else {
      durationRange = '6-9 seconds';
    }
    
    const isDurationValid = contentType === 'short' 
      ? (duration >= 12 && duration <= 18)
      : (duration >= 6 && duration <= 9);
    
    let explanation = '';
    
    if (isHookValid && isDurationValid) {
      explanation = `✅ Your video passed validation because it contains a hook that matches our approved content patterns and has the optimal duration of ${duration.toFixed(1)} seconds (${durationRange} range).`;
    } else if (isHookValid) {
      explanation = `✅ Your hook content matches our approved patterns, which is why it passed validation.`;
    } else if (isDurationValid) {
      explanation = `✅ Your video duration of ${duration.toFixed(1)} seconds is in the optimal range (${durationRange}).`;
    }
    
    return explanation;
  };

  const getResultDisplay = () => {
    if (!moderationResult) return null;
    
    const isApproved = moderationResult.status === 'approved';
    const mostSimilarHook = isApproved ? findMostSimilarHook(moderationResult.extractedText) : '';
    const validationExplanation = isApproved ? getValidationExplanation(moderationResult.extractedText, moderationResult.duration) : '';
    
    return <Card className={`border-2 shadow-lg ${isApproved ? 'border-primary bg-primary/5' : 'border-destructive bg-destructive/5'}`}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center mb-4">
            {isApproved ? <CheckCircle className="h-16 w-16 text-primary" /> : <XCircle className="h-16 w-16 text-destructive" />}
          </div>
          
          <div className="text-center text-2xl font-bold mb-2 font-grotesk">
            {isApproved ? '✅ Video looks great! 🎉' : '❌ REJECTED'}
            {moderationResult.reason && !isApproved && ` – ${moderationResult.reason}`}
          </div>
          
          <div className="space-y-2 text-sm text-muted-foreground mb-4">
            <p><strong>Extracted Hook:</strong> "{moderationResult.extractedText}"</p>
            <p><strong>Duration:</strong> {moderationResult.duration.toFixed(1)} seconds</p>
            <p><strong>Content Type:</strong> {contentType === 'short' ? 'Short Text + In-App Footage' : 'Long Text'}</p>
            <p><strong>Language:</strong> {getDetectedLanguage(moderationResult.extractedText).charAt(0).toUpperCase() + getDetectedLanguage(moderationResult.extractedText).slice(1)} (auto-detected)</p>
          </div>

          {/* Show positive aspects for both approved and rejected videos */}
          {moderationResult.positiveAspects && moderationResult.positiveAspects.length > 0 && (
            <div className="mb-4 p-4 bg-green-50 rounded-md border border-green-200">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="font-semibold text-sm font-grotesk text-green-800">What's Working Well</span>
              </div>
              <div className="space-y-1">
                {moderationResult.positiveAspects.map((aspect, index) => (
                  <div key={index} className="text-xs text-green-700">
                    {aspect}
                  </div>
                ))}
              </div>
            </div>
          )}

          {isApproved && mostSimilarHook && (
            <div className="mb-4 p-4 bg-primary/10 rounded-md border border-primary/20">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm font-grotesk text-primary">Why This Passed</span>
              </div>
              <p className="text-xs text-foreground mb-3">
                {validationExplanation}
              </p>
              <div className="border-t border-primary/20 pt-3">
                <p className="text-xs font-semibold text-primary mb-2">Most Similar Validated Hook:</p>
                <div className="p-2 bg-primary/5 rounded-md text-xs border border-primary/10">
                  "{mostSimilarHook}"
                </div>
              </div>
            </div>
          )}

          {!isApproved && uploadedVideo && (
            <div className="mb-4 p-3 bg-muted/20 rounded-md border">
              <div className="flex items-center gap-2 mb-2">
                <RefreshCw className="h-4 w-4 text-secondary" />
                <span className="font-semibold text-sm font-grotesk">Try Again</span>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Sometimes GPT-4o Vision might miss text on the first try. Re-analyzing can help extract text more accurately.
              </p>
              <Button 
                onClick={reanalyzeWithGPT4o} 
                disabled={isReanalyzing}
                size="sm"
                variant="outline"
                className="w-full"
              >
                {isReanalyzing ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                    Re-analyzing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-3 w-3 mr-2" />
                    Re-analyze with GPT-4o Vision
                  </>
                )}
              </Button>
            </div>
          )}

          {moderationResult.suggestions && moderationResult.suggestions.length > 0 && <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb className="h-4 w-4 text-secondary" />
                <span className="font-semibold text-sm font-grotesk">
                  {isApproved ? 'Suggestions for Next Time:' : 'Improvement Suggestions:'}
                </span>
              </div>
              <div className="space-y-2">
                {moderationResult.suggestions.map((suggestion, index) => <div key={index} className="p-2 bg-secondary/10 rounded-md text-xs border-l-2 border-secondary">
                    {suggestion.startsWith('Consider') ? (
                      <div className="flex items-start gap-2">
                        <span className="text-secondary font-semibold">💡</span>
                        <span>{suggestion}</span>
                      </div>
                    ) : (
                      `"${suggestion}"`
                    )}
                  </div>)}
              </div>
            </div>}
        </CardContent>
      </Card>;
  };

  const getContentTypeInfo = () => {
    if (!contentType) {
      return (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <strong>No content type selected.</strong> Please go back and select your video type first.
              </p>
            </div>
          </div>
        </div>
      );
    }

    const info = contentType === 'short' ? {
      title: 'Short Text + In-App Footage',
      duration: '12-18 seconds',
      requirements: [
        '4-5 seconds of your face (shocked/annoyed expression)',
        'Rest is app footage showing image upload feature',
        'White text with black stroke overlay',
        'Face detection at 3, 4, and 5 second marks'
      ]
    } : {
      title: 'Long Text',
      duration: '6-9 seconds',
      requirements: [
        '2x speed background action (typing, working, etc.)',
        'Large text overlay that fills screen',
        'Text takes longer to read than video length',
        'Good lighting and visibility'
      ]
    };

    return (
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800 font-grotesk">
              Selected: {info.title}
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <p className="mb-1"><strong>Duration:</strong> {info.duration}</p>
              <p className="mb-1"><strong>Requirements:</strong></p>
              <ul className="list-disc list-inside ml-2">
                {info.requirements.map((req, index) => (
                  <li key={index}>{req}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-2 sm:p-4">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
        <div className="text-center px-2">
          <h1 className="text-2xl sm:text-4xl font-bold text-foreground mb-2 font-grotesk">Faircado TikTok Video Validator</h1>
          <p className="text-muted-foreground">
            {contentType === 'short' ? 'Short Text + In-App Footage' : contentType === 'long' ? 'Long Text' : 'Content Type'} Validation
          </p>
        </div>

        {getContentTypeInfo()}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Input Panel */}
          <Card className="shadow-lg border-2 border-primary/20 hover:border-primary/40 transition-colors">
            <CardHeader className="bg-primary/5 pb-4">
              <CardTitle className="flex items-center gap-2 font-grotesk text-lg sm:text-xl">
                <Upload className="h-5 w-5 text-primary" />
                Video Upload & Analysis
              </CardTitle>
              <CardDescription className="font-grotesk text-sm">
                Upload a video to automatically extract text and {contentType === 'short' ? 'detect faces' : 'analyze content'} using GPT-4o Vision
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6 pt-4 sm:pt-6">
              <div>
                <Label htmlFor="videoUpload" className="font-grotesk text-base mb-3 block">Upload Video</Label>
                
                {/* Mobile-optimized upload button */}
                <div className="relative">
                  <Input 
                    id="videoUpload" 
                    ref={fileInputRef} 
                    type="file" 
                    accept="video/*" 
                    onChange={handleVideoUpload} 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                  />
                  <Button
                    variant="outline"
                    className="w-full h-16 sm:h-20 border-2 border-dashed border-primary/40 hover:border-primary/60 hover:bg-primary/5 transition-all duration-200 font-grotesk text-base sm:text-lg"
                    disabled={isProcessing}
                  >
                    <div className="flex flex-col items-center gap-2">
                      {isProcessing ? (
                        <>
                          <Loader2 className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-primary" />
                          <span className="text-sm sm:text-base">Processing...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                          <span className="text-sm sm:text-base">Tap to upload video</span>
                          <span className="text-xs text-muted-foreground">or drag and drop</span>
                        </>
                      )}
                    </div>
                  </Button>
                </div>

                {isProcessing && (
                  <div className="flex items-center gap-2 mt-3 text-sm text-primary bg-primary/5 p-3 rounded-md">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="font-grotesk">
                      Processing video with GPT-4o Vision...
                      {contentType === 'short' && ' (extracting text and detecting faces)'}
                    </span>
                  </div>
                )}
              </div>

              {videoPreview && (
                <div>
                  <Label className="font-grotesk text-base">Video Preview</Label>
                  <video 
                    ref={videoRef} 
                    src={videoPreview} 
                    className="w-full max-h-48 sm:max-h-40 rounded-md mt-2 border-2 border-primary/20" 
                    controls 
                    muted 
                    preload="metadata" 
                  />
                </div>
              )}

              <div>
                <Label htmlFor="extractedText" className="font-grotesk text-base">Extracted Hook Text</Label>
                <Textarea 
                  id="extractedText" 
                  placeholder="Text will be automatically extracted using GPT-4o Vision..." 
                  value={extractedText} 
                  onChange={(e) => setExtractedText(e.target.value)} 
                  className="min-h-[120px] sm:min-h-[100px] border-primary/20 focus:border-primary mt-2 text-base" 
                />
                {extractedText && (
                  <div className="flex items-center gap-1 mt-2 text-primary text-xs">
                    <Eye className="h-3 w-3" />
                    <span className="font-grotesk">Extracted using GPT-4o Vision</span>
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="duration" className="font-grotesk text-base">Video Duration (seconds)</Label>
                <Input 
                  id="duration" 
                  type="number" 
                  placeholder="Auto-detected from video" 
                  value={videoDuration || ''} 
                  onChange={(e) => setVideoDuration(parseFloat(e.target.value) || 0)} 
                  min="0" 
                  step="0.1" 
                  readOnly={!!uploadedVideo} 
                  className="border-primary/20 focus:border-primary mt-2 h-12 text-base" 
                />
                <p className="text-sm text-muted-foreground mt-2 font-grotesk">
                  Valid range: {contentType === 'short' ? '12-18 seconds' : '6-9 seconds'}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button 
                  onClick={moderateVideo} 
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-grotesk h-12 text-base" 
                  disabled={!extractedText.trim() || videoDuration <= 0}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Moderate Video
                </Button>
                <Button 
                  variant="outline" 
                  onClick={resetModeration} 
                  className="border-secondary text-secondary hover:bg-secondary/10 font-grotesk h-12 sm:w-auto"
                >
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Results Panel */}
          <div className="space-y-4">
            {moderationResult && getResultDisplay()}
          </div>
        </div>

        {/* Validated Hooks Reference */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-lg sm:text-xl">Validated Hooks Reference</CardTitle>
                <CardDescription className="text-sm">
                  Currently showing {extractedText ? getDetectedLanguage(extractedText) : 'all'} hooks ({extractedText ? (getDetectedLanguage(extractedText) === 'english' ? validatedHooksEnglish.length : validatedHooksGerman.length) : validatedHooksEnglish.length + validatedHooksGerman.length} total)
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {(extractedText ? (getDetectedLanguage(extractedText) === 'english' ? validatedHooksEnglish : validatedHooksGerman) : [...validatedHooksEnglish, ...validatedHooksGerman]).map((hook, index) => (
                <div key={index} className="p-3 bg-gray-50 rounded-md text-sm">
                  "{hook}"
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Hidden canvas for video frame capture */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
    </div>
  );
};

export default VideoModerationAssistant;
