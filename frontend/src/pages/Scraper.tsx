
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Search, Download, Clock, CheckCircle, XCircle, Copy, AlertCircle, Plus, Trash2, Play } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Navigation from "@/components/Navigation";

interface ScrapingResult {
  videoId: string;
  status: 'approved' | 'rejected' | 'original' | 'error';
  hookText?: string;
  duration?: number;
  suggestions?: string[];
  reason?: string;
  error?: string;
  videoUrl?: string; // Add video URL to results
}

interface ScrapingResponse {
  handle: string;
  results: ScrapingResult[];
  message: string;
}

const Scraper = () => {
  const [handle, setHandle] = useState('');
  const [newCreatorHandle, setNewCreatorHandle] = useState('');
  const [scrapingResult, setScrapingResult] = useState<ScrapingResponse | null>(null);
  const [isScrapingLoading, setIsScrapingLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch creators from database
  const { data: creators, isLoading: creatorsLoading } = useQuery({
    queryKey: ['creators'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('creators')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  // Add creator mutation
  const addCreatorMutation = useMutation({
    mutationFn: async (handle: string) => {
      const { data, error } = await supabase
        .from('creators')
        .insert({ handle: handle.replace('@', '') })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creators'] });
      setNewCreatorHandle('');
      toast({
        title: "Creator Added",
        description: "Creator has been added to the daily scraping list."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add creator",
        variant: "destructive"
      });
    }
  });

  // Remove creator mutation
  const removeCreatorMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('creators')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creators'] });
      toast({
        title: "Creator Removed",
        description: "Creator has been removed from the daily scraping list."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to remove creator",
        variant: "destructive"
      });
    }
  });

  const handleScraping = async () => {
    if (!handle.trim()) {
      toast({
        title: "Error",
        description: "Please enter a TikTok handle",
        variant: "destructive"
      });
      return;
    }

    setIsScrapingLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('tiktok-scraper', {
        body: { handle: handle.replace('@', '') }
      });

      if (error) throw error;

      setScrapingResult(data);
      toast({
        title: "Scraping Complete",
        description: `Analyzed ${data.results.length} videos for @${data.handle}`
      });

    } catch (error: any) {
      console.error('Scraping error:', error);
      toast({
        title: "Scraping Failed",
        description: error.message || "Failed to scrape TikTok videos",
        variant: "destructive"
      });
    } finally {
      setIsScrapingLoading(false);
    }
  };

  const formatSlackMessage = (result: ScrapingResponse): string => {
    let message = `@${result.handle}\n`;
    
    result.results.forEach((video, index) => {
      if (video.status === 'approved') {
        message += `✅ Validated Post: Hook matched + ${video.duration?.toFixed(1)}s\n`;
      } else if (video.status === 'rejected') {
        message += `❌ Validated Post: ${video.reason}`;
        if (video.suggestions && video.suggestions.length > 0) {
          message += ` — try:\n"${video.suggestions[0]}"\n`;
        } else {
          message += '\n';
        }
      } else if (video.status === 'original') {
        message += `❌ Validated Post — This appears to be an original video. Feedback not supported yet.\n`;
      } else if (video.status === 'error') {
        message += `❌ Error processing video: ${video.error}\n`;
      }
    });

    return message.trim();
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: "Message copied to clipboard"
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive"
      });
    }
  };

  const addCreator = () => {
    if (!newCreatorHandle.trim()) {
      toast({
        title: "Error",
        description: "Please enter a creator handle",
        variant: "destructive"
      });
      return;
    }
    addCreatorMutation.mutate(newCreatorHandle);
  };

  const removeCreator = (id: string) => {
    removeCreatorMutation.mutate(id);
  };

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-foreground mb-2 font-grotesk">TikTok Scraper & Validator</h1>
            <p className="text-muted-foreground">Analyze TikTok videos for hook validation and content feedback</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Manual Scraping */}
            <Card className="shadow-lg border-2 border-primary/20">
              <CardHeader className="bg-primary/5">
                <CardTitle className="flex items-center gap-2 font-grotesk">
                  <Search className="h-5 w-5 text-primary" />
                  Manual Check
                </CardTitle>
                <CardDescription>
                  Check the last 2 videos from any TikTok handle
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div>
                  <Label htmlFor="handle" className="font-grotesk">TikTok Handle</Label>
                  <Input
                    id="handle"
                    placeholder="@username"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    className="border-primary/20 focus:border-primary mt-2"
                  />
                </div>

                <Button
                  onClick={handleScraping}
                  disabled={isScrapingLoading}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-grotesk"
                >
                  {isScrapingLoading ? (
                    <>
                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                      Checking Videos...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Check Last 2 Videos
                    </>
                  )}
                </Button>

                {scrapingResult && (
                  <div className="space-y-4">
                    <Separator />
                    <div>
                      <Label className="font-grotesk mb-2 block">Results for @{scrapingResult.handle}</Label>
                      <div className="space-y-4">
                        {scrapingResult.results.map((result, index) => (
                          <div key={index} className="p-4 border rounded-md bg-card">
                            <div className="flex items-center gap-2 mb-3">
                              {result.status === 'approved' ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : result.status === 'original' ? (
                                <AlertCircle className="h-4 w-4 text-yellow-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                              <Badge variant={result.status === 'approved' ? 'default' : 'destructive'}>
                                Video {index + 1}
                              </Badge>
                            </div>
                            
                            {/* Video Preview */}
                            {result.videoUrl && (
                              <div className="mb-3">
                                <div className="relative bg-gray-100 rounded-md p-4 border-2 border-dashed border-gray-300">
                                  <div className="flex items-center justify-center gap-2 text-gray-600">
                                    <Play className="h-5 w-5" />
                                    <span className="text-sm font-medium">Video Preview</span>
                                  </div>
                                  <p className="text-xs text-gray-500 mt-1 text-center">
                                    {result.videoUrl}
                                  </p>
                                  <div className="text-xs text-gray-400 mt-2 text-center">
                                    Mock video URL - would display actual video in production
                                  </div>
                                </div>
                              </div>
                            )}
                            
                            {result.hookText && (
                              <p className="text-sm text-muted-foreground mb-1">
                                <strong>Hook:</strong> "{result.hookText}"
                              </p>
                            )}
                            
                            {result.duration && (
                              <p className="text-sm text-muted-foreground mb-1">
                                <strong>Duration:</strong> {result.duration.toFixed(1)}s
                              </p>
                            )}
                            
                            {result.reason && (
                              <p className="text-sm text-red-600 mb-1">
                                <strong>Issue:</strong> {result.reason}
                              </p>
                            )}
                            
                            {result.suggestions && result.suggestions.length > 0 && (
                              <p className="text-sm text-blue-600">
                                <strong>Suggestion:</strong> "{result.suggestions[0]}"
                              </p>
                            )}
                            
                            {result.error && (
                              <p className="text-sm text-red-600">
                                <strong>Error:</strong> {result.error}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label className="font-grotesk">Slack-Ready Message</Label>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(formatSlackMessage(scrapingResult))}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </Button>
                      </div>
                      <Textarea
                        value={formatSlackMessage(scrapingResult)}
                        readOnly
                        className="min-h-[120px] font-mono text-sm"
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Creator Management */}
            <Card className="shadow-lg border-2 border-secondary/20">
              <CardHeader className="bg-secondary/5">
                <CardTitle className="flex items-center gap-2 font-grotesk">
                  <Clock className="h-5 w-5 text-secondary" />
                  Daily Scraping
                </CardTitle>
                <CardDescription>
                  Manage creators for automated daily analysis at 00:01
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-6">
                <div className="flex gap-2">
                  <Input
                    placeholder="@creator_handle"
                    value={newCreatorHandle}
                    onChange={(e) => setNewCreatorHandle(e.target.value)}
                    className="border-secondary/20 focus:border-secondary"
                  />
                  <Button
                    onClick={addCreator}
                    disabled={addCreatorMutation.isPending}
                    variant="outline"
                    className="border-secondary text-secondary hover:bg-secondary/10"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {creatorsLoading ? (
                    <p className="text-sm text-muted-foreground">Loading creators...</p>
                  ) : creators && creators.length > 0 ? (
                    creators.map((creator) => (
                      <div key={creator.id} className="flex items-center justify-between p-2 bg-secondary/5 rounded-md">
                        <span className="text-sm font-medium">@{creator.handle}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeCreator(creator.id)}
                          disabled={removeCreatorMutation.isPending}
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No creators added yet</p>
                  )}
                </div>

                <div className="text-xs text-muted-foreground bg-muted/20 p-3 rounded-md">
                  <strong>Daily Schedule:</strong> All creators in this list will be automatically checked at 00:01 daily. 
                  Results are stored in the database for review.
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
};

export default Scraper;
