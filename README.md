# RecallOps

RecallOps is a full-stack hackathon MVP for **AI Agents That Learn Using Hindsight**.

It demonstrates a memory-first incident response workflow:

**New incident → Hindsight Recall → AI analysis → Resolve → Hindsight Retain → future incident → memory-informed recommendation**

## Current stack

- React + Vite
- Express
- Hindsight Cloud TypeScript client
- Local JSON persistence for the demo incident board
- No authentication

Hindsight Cloud supports `retain`, `recall`, and `reflect`. The backend keeps the Hindsight API key server-side.

## Setup

1. Install Node.js 18+.
2. Run:

```bash
npm install
```

3. Copy `.env.example` to `.env`.
4. Put your Hindsight Cloud key in `.env`:

```env
HINDSIGHT_API_KEY=hsk_...
```

5. Start both frontend and backend:

```bash
npm run dev
```

6. Open:

http://localhost:5173

## First demo

1. Click **Load demo history**.
2. Go to **New Incident**.
3. Enter:

Title: `Payment API failing again`

Service: `Payment API`

Severity: `Critical`

Description: `Payment requests are returning HTTP 500 errors again.`

Symptoms: `Customers cannot complete payments.`

4. Click **Analyze with Hindsight**.
5. The analysis should recall the earlier payment incident.
6. Show the **Hindsight Memory** panel.
7. Resolve the incident and use **Save & Remember**.
8. Submit a similar incident again to demonstrate persistent memory.

## Security

Never put `HINDSIGHT_API_KEY` in React/Vite client code or commit `.env` to GitHub.

## Hackathon positioning

Hindsight memory is not an optional add-on. It is the central workflow of RecallOps: past incident experience is retained, recalled, and used to inform future incident response.
