
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from 'react-router-dom';
import { Video, Clock, User, Image } from 'lucide-react';
import Navigation from "@/components/Navigation";

const ContentType = () => {
  const navigate = useNavigate();

  const handleContentTypeSelection = (type: 'short' | 'long') => {
    // Navigate to validator with content type as URL parameter
    navigate(`/validator?type=${type}`);
  };

  return (
    <>
      <Navigation />
      <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 p-4">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold text-foreground mb-2 font-grotesk">
              What type of video are you creating?
            </h1>
            <p className="text-lg text-muted-foreground">
              Choose your video format to get the right validation criteria
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Short Text + In-App Footage */}
            <Card 
              className="shadow-lg border-2 border-primary/20 hover:border-primary/40 transition-all cursor-pointer group"
              onClick={() => handleContentTypeSelection('short')}
            >
              <CardHeader className="bg-primary/5 group-hover:bg-primary/10 transition-colors">
                <CardTitle className="flex items-center gap-3 font-grotesk text-xl">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  Short Text + In-App Footage
                </CardTitle>
                <CardDescription className="text-base">
                  Face-first videos with quick transitions to app demonstrations
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Clock className="h-4 w-4 text-primary" />
                    <span><strong>Duration:</strong> 12-18 seconds total</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <User className="h-4 w-4 text-primary" />
                    <span><strong>Opening:</strong> 4-5 seconds of your face (shocked/annoyed)</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Image className="h-4 w-4 text-primary" />
                    <span><strong>Content:</strong> App footage showing image upload feature</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Video className="h-4 w-4 text-primary" />
                    <span><strong>Hook:</strong> White text with black stroke overlay</span>
                  </div>
                </div>
                
                <Button 
                  className="w-full bg-primary hover:bg-primary/90 font-grotesk"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleContentTypeSelection('short');
                  }}
                >
                  Validate Short Format Video
                </Button>
              </CardContent>
            </Card>

            {/* Long Text */}
            <Card 
              className="shadow-lg border-2 border-secondary/20 hover:border-secondary/40 transition-all cursor-pointer group"
              onClick={() => handleContentTypeSelection('long')}
            >
              <CardHeader className="bg-secondary/5 group-hover:bg-secondary/10 transition-colors">
                <CardTitle className="flex items-center gap-3 font-grotesk text-xl">
                  <div className="p-2 bg-secondary/10 rounded-lg">
                    <Video className="h-6 w-6 text-secondary" />
                  </div>
                  Long Text
                </CardTitle>
                <CardDescription className="text-base">
                  Text-heavy videos with background action sequences
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Clock className="h-4 w-4 text-secondary" />
                    <span><strong>Duration:</strong> 6-7 seconds total</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <User className="h-4 w-4 text-secondary" />
                    <span><strong>Background:</strong> 2x speed action (typing, working, etc.)</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Video className="h-4 w-4 text-secondary" />
                    <span><strong>Content:</strong> Large text overlay that fills screen</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Image className="h-4 w-4 text-secondary" />
                    <span><strong>Focus:</strong> Text takes longer to read than video length</span>
                  </div>
                </div>
                
                <Button 
                  variant="outline"
                  className="w-full border-secondary text-secondary hover:bg-secondary/10 font-grotesk"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleContentTypeSelection('long');
                  }}
                >
                  Validate Long Text Video
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Not sure which format? Each validator will show you specific requirements and examples.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default ContentType;
