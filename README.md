TikTok Video Evaluation Tool

A Full-Stack  Project – FastAPI Backend + Vite/React Frontend

📌 Overview

This project is a full-stack application designed to fetch and evaluate the latest TikTok videos from any public profile.
It includes:

A FastAPI backend that scrapes and downloads recent TikTok videos.

A Vite + React frontend where the user enters a TikTok username.

On the frontend, the downloaded videos are evaluated using GPT based on predefined rules and heuristics (e.g. hook text, duration, content style).


📂 Project Structure
tiktok-project/
│── backend/
│   ├── main.py
│   ├── yt_video_fetcher.py
│   └── requirements.txt
│
└── frontend/
    ├── package.json
    ├── vite.config.js
    ├── src/
    └── ...

🛠 Technologies Used
🔹 Backend (FastAPI)

Python 3.x

FastAPI

Uvicorn

Selenium + undetected_chromedriver

yt-dlp (optional fallback)

🔹 Frontend (Vite + React + GPT)

React

Vite

Fetch API

Modern React hooks (useState, useEffect)

GPT-based evaluation:

The frontend sends video metadata (e.g. duration, overlay text, type of content) to a GPT model.

GPT evaluates whether each video matches the desired formats (e.g. “Short Text + In-App Footage”, “Long Text”) according to defined rules.

Note: The GPT integration is handled on the frontend side, after receiving the video URLs from the backend.

⚙️ Backend — How to Run

Navigate into the backend folder:

cd backend


Create and activate a virtual environment:

python -m venv venv

# Windows:
venv\Scripts\activate

# macOS/Linux:
source venv/bin/activate


Install dependencies:

pip install -r requirements.txt


Run the FastAPI server:

uvicorn main:app --reload 


Backend base URL:

👉 http://127.0.0.1:8000

Swagger API Docs: 👉 http://127.0.0.1:8000/docs

🌐 Frontend — How to Run

Go to the frontend directory:

cd frontend


Install dependencies:

npm install


Create a .env file with:

VITE_API_URL=http://127.0.0.1:8000
VITE_GPT_API_KEY=YOUR_API_KEY_HERE   # if used directly in frontend setup


Start the Vite dev server:

npm run dev


Frontend dev URL:

👉 http://127.0.0.1:8080

🔄 How the System Works

The user enters a TikTok username in the frontend UI.

The frontend sends a POST request to the backend:

POST http://127.0.0.1:8000/download


The FastAPI backend:

Launches a headless undetected Chrome instance

Opens the TikTok profile

Scrapes the 5 latest videos

Returns:

video URLs

Downloads the videos locally (for further analysis if needed)

The frontend receives the JSON response and then:

Displays the list of videos.

Sends video-related information (e.g. duration, overlay text, type) to GPT.

GPT evaluates whether each video matches the predefined criteria (e.g. hook structure, duration range, in-app footage, long-text format).

The evaluation result is shown in the UI (e.g. “valid / invalid” or detailed reasoning).

🧪 Example API Request (Backend)
Request
{
  "username": "..."
}

Response
{
  "status": "success",
  "video_urls": [
    "https://v16m-default.akamaized.net/.....",
    "https://v16m-default.akamaized.net/....."
  ]
}


The frontend then passes this data on to GPT for evaluation.

🧩 Common Issues
❗ ChromeDriver Version Mismatch

If you see something like:

This version of ChromeDriver only supports Chrome version XXX
Current browser version is YYY


You may need to:

Update Chrome manually, or

Adjust the undetected_chromedriver configuration, for example:

driver = uc.Chrome(version_main=142)

❗ TikTok Blocking Automation

To reduce blocking risk, this project uses:

undetected_chromedriver

Headless mode configuration

Custom user-agent

Small delays between actions

📈 Future Improvements

Move GPT evaluation to a backend endpoint (for better security of API keys).

Store evaluation results and metadata in a database (e.g. PostgreSQL).

Add visualization dashboards (charts, statistics, pass/fail rate).

Add user authentication and multi-user project management.

Support other platforms (e.g. Instagram Reels, YouTube Shorts).
