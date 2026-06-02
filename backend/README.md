# Backend Setup

## Required Railway Environment Variables

- `PORT` - server port (Railway usually injects one automatically)
- `MONGO_URI` - full MongoDB Atlas/Railway Mongo connection string
- `CLIENT_URL` - frontend URL for generated links (example: `https://your-app.vercel.app`)

## Run Locally

```bash
npm install
npm run dev
```

## API Endpoints

- `POST /api/admin/create-client`
- `GET /api/public/event/:eventId`
- `POST /api/public/event/:eventId/rsvp`
- `POST /api/client/login`
- `GET /api/client/:userId/guests`
- `POST /api/client/:userId/guests/manual`
