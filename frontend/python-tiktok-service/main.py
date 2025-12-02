from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from TikTokApi import TikTokApi
import asyncio
import os
from datetime import datetime, timedelta
from typing import List, Optional
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="TikTok Scraper Service")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TikTokVideo(BaseModel):
    id: str
    desc: str
    createTime: int
    video: dict
    music: dict
    stats: dict

class ScrapeRequest(BaseModel):
    handle: str
    count: Optional[int] = 10

class ScrapeResponse(BaseModel):
    handle: str
    videos: List[TikTokVideo]
    message: str

async def get_user_videos(username: str, count: int = 10) -> List[dict]:
    """Fetch videos from a TikTok user using TikTok-Api"""
    ms_token = os.environ.get("ms_token", None)
    
    try:
        async with TikTokApi() as api:
            # Create session with browser automation
            await api.create_sessions(
                ms_tokens=[ms_token] if ms_token else [None], 
                num_sessions=1, 
                sleep_after=3,
                browser=os.getenv("TIKTOK_BROWSER", "chromium")
            )
            
            # Get user object
            user = api.user(username)
            
            # Fetch videos from the user
            videos = []
            async for video in user.videos(count=count):
                # Convert video object to dictionary
                video_dict = video.as_dict
                
                # Transform to our expected format
                transformed_video = {
                    "id": video_dict.get("id", ""),
                    "desc": video_dict.get("desc", ""),
                    "createTime": video_dict.get("createTime", 0),
                    "video": {
                        "playAddr": video_dict.get("video", {}).get("playAddr", ""),
                        "downloadAddr": video_dict.get("video", {}).get("downloadAddr", ""),
                        "duration": video_dict.get("video", {}).get("duration", 0)
                    },
                    "music": {
                        "playUrl": video_dict.get("music", {}).get("playUrl", ""),
                        "duration": video_dict.get("music", {}).get("duration", 0)
                    },
                    "stats": {
                        "playCount": video_dict.get("stats", {}).get("playCount", 0),
                        "shareCount": video_dict.get("stats", {}).get("shareCount", 0),
                        "commentCount": video_dict.get("stats", {}).get("commentCount", 0),
                        "diggCount": video_dict.get("stats", {}).get("diggCount", 0)
                    }
                }
                videos.append(transformed_video)
                
            return videos
            
    except Exception as e:
        logger.error(f"Error fetching videos for {username}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch videos: {str(e)}")

def filter_recent_videos(videos: List[dict], days_back: int = 1) -> List[dict]:
    """Filter videos to only include recent ones"""
    cutoff_time = datetime.now() - timedelta(days=days_back)
    cutoff_timestamp = int(cutoff_time.timestamp())
    
    recent_videos = [
        video for video in videos 
        if video.get("createTime", 0) >= cutoff_timestamp
    ]
    
    # Limit to 2 most recent videos
    return recent_videos[:2]

@app.get("/")
async def root():
    return {"message": "TikTok Scraper Service is running"}

@app.post("/scrape/{username}")
async def scrape_user_videos(username: str, request: ScrapeRequest = None):
    """Scrape videos from a TikTok user"""
    try:
        logger.info(f"Scraping videos for user: {username}")
        
        # Remove @ if present
        clean_username = username.replace("@", "")
        count = request.count if request else 10
        
        # Fetch videos
        videos = await get_user_videos(clean_username, count)
        
        # Filter to recent videos only
        recent_videos = filter_recent_videos(videos)
        
        logger.info(f"Found {len(recent_videos)} recent videos for {clean_username}")
        
        return ScrapeResponse(
            handle=clean_username,
            videos=recent_videos,
            message=f"Successfully fetched {len(recent_videos)} recent videos"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "tiktok-scraper"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)