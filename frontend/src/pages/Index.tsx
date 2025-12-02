
import React from 'react';
import { useSearchParams } from 'react-router-dom';
import VideoModerationAssistant from "@/components/VideoModerationAssistant";
import Navigation from "@/components/Navigation";

const Index = () => {
  const [searchParams] = useSearchParams();
  const contentType = searchParams.get('type') as 'short' | 'long' | null;

  return (
    <>
      <Navigation />
      <VideoModerationAssistant contentType={contentType} />
    </>
  );
};

export default Index;
