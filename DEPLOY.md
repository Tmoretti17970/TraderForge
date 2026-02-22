# TradeForge OS v11.0 — Launch Guide

## Quick Start (Local)

```bash
# 1. Install dependencies
npm install

# 2a. Development (HMR, instant reload)
npm run dev
# → http://localhost:5173

# 2b. Development + SSR
npm run dev:ssr
# → http://localhost:5173

# 3. Production build + serve
npm run build
npm start
# → http://localhost:5173
```

---

## Deploy to Vercel (Easiest — Free Tier)

```bash
# One command
npx vercel

# Or connect GitHub repo at vercel.com/new
# Framework: Vite
# Build: npm run build:client
# Output: dist/client
```

Done. Vercel auto-deploys on every push. Free tier includes custom domain + HTTPS.

> Note: Vercel runs as SPA (no SSR). SSR pages fall back to client-side rendering.

---

## Deploy to Railway ($5/mo — Full SSR)

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login + init
railway login
railway init

# 3. Deploy
railway up

# 4. Set environment
railway variables set NODE_ENV=production PORT=3000
```

Railway auto-detects the Dockerfile. Custom domain available in dashboard.

---

## Deploy to Fly.io (Free Tier — Full SSR)

```bash
# 1. Install flyctl
curl -L https://fly.io/install.sh | sh

# 2. Login + launch
fly auth login
fly launch
# Accept defaults, region: ord (Chicago)

# 3. Deploy
fly deploy

# 4. Open
fly open
```

Config is in `fly.toml`. Scales to zero when idle (free tier friendly).

---

## Deploy to Render (Free Tier)

1. Go to [render.com](https://render.com) → New Web Service
2. Connect your GitHub repo
3. Settings:
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `node server.js`
   - **Environment:** `NODE_ENV=production`, `PORT=3000`

---

## Deploy with Docker (Any Host)

```bash
# Build
docker build -t tradeforge .

# Run
docker run -d -p 3000:3000 --name tradeforge tradeforge

# Or with docker-compose
docker compose up -d
```

Works on: AWS ECS, Google Cloud Run, Azure Container Apps, DigitalOcean App Platform, any VPS.

---

## Deploy to VPS (Ubuntu)

```bash
# On your server:
# 1. Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 2. Clone + build
git clone https://github.com/your-repo/tradeforge.git
cd tradeforge
npm install
npm run build

# 3. Install PM2 for process management
sudo npm install -g pm2

# 4. Start
pm2 start server.js --name tradeforge --env production
pm2 save
pm2 startup

# 5. Nginx reverse proxy
sudo apt install nginx
```

Nginx config (`/etc/nginx/sites-available/tradeforge`):
```nginx
server {
    listen 80;
    server_name tradeforge.app www.tradeforge.app;

    # Redirect to HTTPS (after certbot)
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name tradeforge.app www.tradeforge.app;

    # SSL certs (certbot generates these)
    ssl_certificate /etc/letsencrypt/live/tradeforge.app/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tradeforge.app/privkey.pem;

    # Security
    add_header X-Frame-Options SAMEORIGIN;
    add_header X-Content-Type-Options nosniff;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # WebSocket support (for Binance streams proxied through your server)
    location /ws/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # Everything else
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Cache static assets
        location /assets/ {
            proxy_pass http://127.0.0.1:3000;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
}
```

```bash
# Enable site + get SSL cert
sudo ln -s /etc/nginx/sites-available/tradeforge /etc/nginx/sites-enabled/
sudo certbot --nginx -d tradeforge.app -d www.tradeforge.app
sudo systemctl restart nginx
```

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | Yes | `development` | `production` for deployed apps |
| `PORT` | No | `5173` | Server port |
| `HOST` | No | `0.0.0.0` | Bind address |
| `VITE_SITE_URL` | No | `https://tradeforge.app` | Used in SEO meta tags |

See `.env.example` for the full list.

---

## Health Check

All platforms can use the built-in health endpoint:

```
GET /health → 200 { status: "ok", version: "11.0.0", uptime: 12345 }
```

---

## Post-Launch Checklist

- [ ] Custom domain configured
- [ ] HTTPS enabled (auto on Vercel/Railway/Fly)
- [ ] `NODE_ENV=production` set
- [ ] Health check endpoint responding
- [ ] WebSocket connections working (check chart live data)
- [ ] PWA installable (check /manifest.json)
- [ ] SEO pages rendering (check /symbol/BTC)
- [ ] Mobile responsive (test on phone)
