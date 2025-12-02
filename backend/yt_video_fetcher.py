import os
import subprocess
import time
import sys
import tempfile
import base64
import re
from urllib.parse import quote
from typing import List
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
from selenium.common.exceptions import NoSuchElementException
import undetected_chromedriver as uc


def fetch_latest_video_urls(username: str, max_videos: int = 5):  # increase to 5
    url = f"https://www.tiktok.com/@{username}"
    options = uc.ChromeOptions()
    options.headless = True
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--disable-blink-features=AutomationControlled")
    options.add_argument("--disable-gpu")
    options.add_argument("--disable-infobars")
    options.add_argument("--start-maximized")
    options.add_argument("user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/115 Safari/537.36")

    driver = uc.Chrome(options=options)
    
    try:
        driver.get(url)
        time.sleep(3)

        # Scroll to force video elements to load
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(3)

        links = driver.find_elements(By.XPATH, '//a[contains(@href, "/video/")]')
        seen = set()
        video_links = []
        for link in links:
            href = link.get_attribute("href")
            if href and "/video/" in href and href not in seen:
                seen.add(href)
                video_links.append(href)
            if len(video_links) >= max_videos:
                break

        return video_links
    finally:
        driver.quit()

def download_latest_tiktok_videos(username: str, output_dir: str = "downloads"):
    os.makedirs(output_dir, exist_ok=True)
    urls = fetch_latest_video_urls(username, max_videos=5)
    for idx, url in enumerate(urls):
        safe_filename = f"{username}_video_{idx}.mp4"
        subprocess.run([
            "yt-dlp",
            url,
            "-o", os.path.join(output_dir, safe_filename)
        ])