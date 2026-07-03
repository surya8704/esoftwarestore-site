# eSoftware Store

PrimeLicense-style digital license platform with mobile-first checkout, auto-dispatch, marketing automation, and multi-language support.

## Features

- **Commerce**: Product variants, tier pricing, coupons, cart, single-page checkout, wallet, affiliates
- **Delivery**: License key pool, auto email dispatch, confirmation codes, WhatsApp notifications
- **Restrictions**: Country/product visibility, hide price/cart, conditional payment by region
- **Marketing**: Newsletter, abandoned cart emails (1h/24h/72h), per-page tracking, email logs
- **Support**: AI chat, video knowledge base, telephonic activation scripts
- **SEO/Feeds**: Google/Bing/Yandex shopping feeds, sitemap, JSON-LD structured data
- **i18n**: 10 languages, 10 currencies, country switcher
- **Admin**: Product CRUD, order overview, role-protected JWT auth

## Product catalog

All **142 products** from [esoftwarestore.com](https://www.esoftwarestore.com) are saved in:

`backend/src/data/esoftwarestore-catalog.json`

### Refresh from live site

```bash
cd backend
npm run fetch:products
```

### Import into MySQL

```bash
cd backend
npm run import:products
```

The shop also loads `frontend/public/catalog.json` if the API is unavailable.


### 1. Database

```bash
mysql -u root -p < backend/sql/init.sql
```

### 2. Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

**Admin**: `admin@esoftware.store` / `Admin@123`

**Vendor**: `vendor@demo.store` / `Vendor@123`

### Multi-vendor dashboard (`/admin`)

| Role | Tabs |
|------|------|
| **Admin** | Overview, Vendors, Products, Orders, Payouts |
| **Vendor** | Overview, My Products, My Orders, Payouts |

Vendors can create products, view their orders, and request payouts. Admins manage vendors, approve payouts, and see platform-wide stats.

If upgrading an existing database, run `backend/sql/migrate-vendors.sql`.

## API highlights

| Endpoint | Description |
|----------|-------------|
| `GET /api/products` | Catalog with geo pricing |
| `POST /api/cart/items` | Add to cart |
| `POST /api/checkout/create-order` | Single-page checkout |
| `POST /api/checkout/verify` | Payment + auto license dispatch |
| `POST /api/newsletter/subscribe` | Newsletter |
| `POST /api/support/chat` | AI support |
| `GET /feeds/google-shopping.xml` | Google Merchant feed |
| `GET /sitemap.xml` | SEO sitemap |

## Environment

See `backend/.env.example` for Resend (email), WhatsApp, OpenAI, Razorpay, and CDN settings.

## Deploy (Vercel + Render)

**Live frontend:** https://frontend-henna-delta-45.vercel.app

### 1. Backend on [Render](https://render.com)

1. Push this repo to GitHub (if not already).
2. [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint** → connect the repo (`render.yaml` deploys `backend/`).
3. When prompted, set these **secret** env vars (copy from `backend/.env`):
   - `DATABASE_URL` — MongoDB Atlas URI
   - `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`
   - `PAYU_MERCHANT_KEY`, `PAYU_MERCHANT_SALT`
   - `JWT_SECRET` (or use auto-generated)
4. Pre-filled in `render.yaml`:
   - `CLIENT_URL` = `https://frontend-henna-delta-45.vercel.app`
   - `API_PUBLIC_URL` = `https://esoftwarestore-api.onrender.com`
5. After deploy, verify: `https://esoftwarestore-api.onrender.com/health`

> **Note:** Free Render services spin down after inactivity; first request may take ~30s.

### 2. Frontend on [Vercel](https://vercel.com) — deployed

| Setting | Value |
|---------|--------|
| Production URL | https://frontend-henna-delta-45.vercel.app |
| Root directory | `frontend` |
| `VITE_API_URL` | `https://esoftwarestore-api.onrender.com` |

Redeploy after Render is live:
```bash
cd frontend && vercel deploy --prod
```

## Architecture

```
frontend/          React + Vite + Tailwind + i18n
backend/src/
  routes/          API route handlers
  services/        email, pricing, licenses, marketing, AI, feeds
  db/schema.js     Full platform schema
  sql/init.sql     MySQL setup script
```
