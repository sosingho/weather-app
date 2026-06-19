# WhatsApp Weather Signal Notifier

This Next.js app monitors Hong Kong Observatory weather warnings and sends a WhatsApp template message when a warning signal goes up or off.

## Environment

Create `.env.local` from `.env.example` and fill in:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `CRON_SECRET`
- `ADMIN_TOKEN`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_TO`
- `WHATSAPP_TEMPLATE_NAME`

Use `WHATSAPP_DRY_RUN=true` while testing locally.

## Getting Started

Install dependencies and run the development server:

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Commands

```bash
pnpm lint
pnpm test
pnpm build
```

## Cron

Vercel runs `GET /api/cron/weather-signals` every 5 minutes from `vercel.json`. The route requires:

```text
Authorization: Bearer <CRON_SECRET>
```

## WhatsApp Template

The Meta-approved template should accept four body variables:

1. Alert status
2. Warning name
3. HKT timestamp
4. Short warning detail

The dashboard test-send button uses `ADMIN_TOKEN`.
