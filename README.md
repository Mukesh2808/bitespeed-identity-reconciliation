# Bitespeed Identity Reconciliation Service

A backend service that identifies and reconciles customer identities across multiple purchases.

## 🌐 Live Endpoint

> **Base URL:** [`https://bitespeed-identity-reconciliation-36ve.onrender.com`](https://bitespeed-identity-reconciliation-36ve.onrender.com)

### `POST /identify`

**Request:**
```json
{
  "email": "a@example.com",
  "phoneNumber": "919191"
}
```

**Response:**
```json
{
  "contact": {
    "primaryContactId": 1,
    "emails": ["a@example.com"],
    "phoneNumbers": ["919191"],
    "secondaryContactIds": []
  }
}
```

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Express
- **Database:** MongoDB (Mongoose ODM)
- **Hosting:** Render.com

## Architecture

```
src/
  server.ts                          — Entry point
  routes/identifyRoutes.ts           — POST /identify
  controllers/identifyController.ts  — Input validation
  services/identifyService.ts        — Core reconciliation logic
  repositories/contactRepository.ts  — Database access layer
  models/Contact.ts                  — Mongoose schema
  models/types.ts                    — TypeScript interfaces
  utils/db.ts                        — MongoDB connection
```

## Local Development

```bash
# Install dependencies
npm install

# Set environment variables in .env
# MONGODB_URI=mongodb://localhost:27017/bitespeed
# PORT=3000

# Start dev server (auto-restarts on changes)
npm run dev
```

## Deployment

1. Push to GitHub
2. Create a free MongoDB Atlas cluster → get connection string
3. Create a new **Web Service** on [Render.com](https://render.com)
4. Set environment variables on Render:
   - `MONGODB_URI` = your Atlas connection string
   - `PORT` = `3000`
5. Build command: `npm install && npm run build`
6. Start command: `npm start`
