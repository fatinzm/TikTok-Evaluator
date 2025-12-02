import os
import glob
import base64
import traceback
from typing import List
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from yt_video_fetcher import download_latest_tiktok_videos

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # You can also restrict to ["https://your-lovable-subdomain.lovable.app"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve the downloads folder as /static
if not os.path.exists("downloads"):
    os.makedirs("downloads")

# Serve video files from /downloads as /static
app.mount("/static", StaticFiles(directory="downloads"), name="static")

class DownloadRequest(BaseModel):
    username: str

@app.post("/download")
def download_videos(request: DownloadRequest):
    try:
        # Delete old videos
        old_videos = glob.glob("downloads/*.mp4")
        for f in old_videos:
            os.remove(f)

        # Download new videos
        download_latest_tiktok_videos(request.username)

        # Get last 5 new videos
        video_files = sorted(
            glob.glob(f"downloads/{request.username}_video_*.mp4"),
            key=os.path.getmtime,
            reverse=True
        )[:5]

        video_urls = [f"/static/{os.path.basename(f)}" for f in video_files]
        return {"status": "success", "video_urls": video_urls}
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))