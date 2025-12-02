# TikTok Scraper Python Service

This is a Python FastAPI service that uses the TikTok-Api library to scrape TikTok videos.

## Local Development

1. Install dependencies:
```bash
pip install -r requirements.txt
python -m playwright install
```

2. Run the service:
```bash
python main.py
```

The service will be available at `http://localhost:8000`

## Docker Deployment

1. Build the Docker image:
```bash
docker build -t tiktok-scraper .
```

2. Run the container:
```bash
docker run -p 8000:8000 tiktok-scraper
```

## Deployment Options

### Railway
1. Connect your GitHub repo to Railway
2. Set environment variables if needed
3. Deploy

### Render
1. Connect your GitHub repo to Render
2. Choose "Web Service"
3. Use Docker build
4. Deploy

### Heroku
1. Install Heroku CLI
2. Create app: `heroku create your-app-name`
3. Push: `git push heroku main`

## API Endpoints

- `GET /` - Health check
- `POST /scrape/{username}` - Scrape videos for a user
- `GET /health` - Health status

## Environment Variables

- `ms_token` - (Optional) TikTok session token for better access
- `TIKTOK_BROWSER` - Browser to use (default: chromium)