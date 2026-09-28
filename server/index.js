import "dotenv/config";
import express from "express";
import cors from "cors";
import fs from "node:fs/promises";
import path from "node:path";
import { HindsightClient } from "@vectorize-io/hindsight-client";

const app = express();

app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT || 3001);
const DATA_FILE = path.join(process.cwd(), "server", "incidents.json");
const BANK_ID = process.env.HINDSIGHT_BANK_ID || "recallops-demo";

async function readIncidents() {
  try {
    return JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
  } catch {
    return [];
  }
}

async function writeIncidents(items) {
  await fs.writeFile(DATA_FILE, JSON.stringify(items, null, 2));
}

function hindsight() {
  const key = process.env.HINDSIGHT_API_KEY;

  if (!key) {
    throw new Error(
      "HINDSIGHT_API_KEY is not configured. Add it to .env."
    );
  }

  return new HindsightClient({
    baseUrl:
      process.env.HINDSIGHT_BASE_URL ||
      "https://api.hindsight.vectorize.io",
    apiKey: key,
  });
}

// -------------------- HEALTH --------------------

app.get("/api/health", async (_req, res) => {
  res.json({
    ok: true,
    hindsightConfigured: Boolean(process.env.HINDSIGHT_API_KEY),
    bankId: BANK_ID,
  });
});

// -------------------- INCIDENTS --------------------

app.get("/api/incidents", async (_req, res) => {
  res.json(await readIncidents());
});

// -------------------- ANALYZE INCIDENT --------------------

app.post("/api/incidents/analyze", async (req, res) => {
  const { title, service, severity, description, symptoms } = req.body;

  if (!title || !service || !description) {
    return res.status(400).json({
      error: "Title, service and description are required.",
    });
  }

  try {
    const client = hindsight();

    const query = `Software incident. Service: ${service}. Title: ${title}. Description: ${description}. Symptoms: ${symptoms || "none"}`;

    const recalled = await client.recall(BANK_ID, query, {
      limit: 5,
    });

    const memories = (recalled.results || []).map((m) => ({
      text: m.text,
      score: m.score,
    }));

    const prompt = `
You are RecallOps, an incident response assistant for a software engineering team.
Analyze this incident using the team's recalled memories when relevant.

Incident:
Title: ${title}
Service: ${service}
Severity: ${severity}
Description: ${description}
Symptoms: ${symptoms || "Not provided"}

Recalled memories:
${
  memories.length
    ? memories.map((m) => "- " + m.text).join("\n")
    : "No relevant memories found."
}

Return a concise response with:
1) a practical incident analysis,
2) likely causes,
3) 3-5 recommended next steps.

Do not invent that a past incident exists if the recalled memories are empty.
If memories are relevant, explicitly explain how they inform the recommendation.
`;

    const reflection = await client.reflect(BANK_ID, prompt);

    const answer = reflection.text || "No analysis returned.";

    const nextSteps = answer
      .split(/\n/)
      .filter((x) => /^\s*(?:[-*]|\d+[.)])/.test(x))
      .slice(0, 5)
      .map((x) =>
        x.replace(/^\s*(?:[-*]|\d+[.)])\s*/, "")
      );

    res.json({
      incident: {
        title,
        service,
        severity,
        description,
        symptoms,
        status: "Open",
      },
      answer,
      nextSteps:
        nextSteps.length
          ? nextSteps
          : [
              "Inspect recent deployment and logs.",
              "Compare with related historical incidents.",
              "Validate service dependencies and credentials.",
            ],
      memories,
    });
  } catch (e) {
    res.status(500).json({
      error: e.message || "Hindsight analysis failed.",
    });
  }
});

// -------------------- RESOLVE INCIDENT --------------------

app.post("/api/incidents/resolve", async (req, res) => {
  const { incident, rootCause, resolution, lessons } = req.body;

  if (!incident || !rootCause || !resolution) {
    return res.status(400).json({
      error: "Incident, root cause and resolution are required.",
    });
  }

  try {
    const client = hindsight();

    const memory = `
Incident response record:
Title: ${incident.title}
Service: ${incident.service}
Severity: ${incident.severity}
Description: ${incident.description}
Symptoms: ${incident.symptoms || "Not provided"}
Root cause: ${rootCause}
Resolution: ${resolution}
Lessons learned: ${lessons || "None recorded"}
This incident was resolved successfully by the team.
`;

    await client.retain(BANK_ID, memory);

    const items = await readIncidents();

    const saved = {
      id: crypto.randomUUID(),
      ...incident,
      rootCause,
      resolution,
      lessons,
      status: "Resolved",
      date: "Just now",
      memoryUsed: false,
    };

    items.unshift(saved);

    await writeIncidents(items);

    res.json({
      ok: true,
      incident: saved,
    });
  } catch (e) {
    res.status(500).json({
      error: e.message || "Could not store incident memory.",
    });
  }
});

// -------------------- MEMORY RECALL --------------------

app.post("/api/memory/recall", async (req, res) => {
  const { query } = req.body;

  if (!query) {
    return res.status(400).json({
      error: "Query is required.",
    });
  }

  try {
    const client = hindsight();

    const result = await client.recall(BANK_ID, query, {
      limit: 10,
    });

    res.json({
      memories: result.results || [],
    });
  } catch (e) {
    res.status(500).json({
      error: e.message || "Memory recall failed.",
    });
  }
});

// -------------------- LOAD DEMO DATA --------------------

app.post("/api/demo/load", async (_req, res) => {
  try {
    const client = hindsight();

    const demos = [
      `Incident response record: Payment API 500 errors. Service: Payment API. Symptoms: repeated 500 responses from /payments endpoint. Root cause: Expired API certificate. Resolution: Renewed the certificate and restarted the payment service. Lessons learned: Check certificate expiry during payment API incidents.`,

      `Incident response record: Database connection failures. Service: Order Database. Symptoms: connection pool exhausted. Root cause: Connection leak in worker. Resolution: Fixed the connection leak and increased pool monitoring. Lessons learned: Check pool utilization and long-lived connections first.`,

      `Incident response record: High CPU on notification worker. Service: Notification Worker. Symptoms: CPU spike after deployment. Root cause: Infinite retry loop. Resolution: Fixed retry backoff logic and deployed a patch. Lessons learned: Inspect retry loops after unusual CPU spikes.`,
    ];

    for (const d of demos) {
      await client.retain(BANK_ID, d);
    }

    const items = await readIncidents();

    const existingTitles = new Set(
      items.map((x) => x.title)
    );

    const demoRecords = [
      {
        id: "demo-1",
        title: "Payment API 500 errors",
        service: "Payment API",
        severity: "Critical",
        description:
          "Customers could not complete payments. API returned HTTP 500 errors.",
        symptoms:
          "Repeated 500 responses from /payments endpoint",
        rootCause: "Expired API certificate",
        resolution:
          "Renewed the certificate and restarted the payment service.",
        lessons:
          "Check certificate expiry during payment API incidents.",
        status: "Resolved",
        date: "14 days ago",
        memoryUsed: true,
      },

      {
        id: "demo-2",
        title: "Database connection failures",
        service: "Order Database",
        severity: "High",
        description:
          "Order service intermittently failed to connect to PostgreSQL.",
        symptoms: "Connection pool exhausted",
        rootCause: "Connection leak in worker",
        resolution:
          "Fixed the connection leak and increased pool monitoring.",
        lessons:
          "Check pool utilization and long-lived connections first.",
        status: "Resolved",
        date: "9 days ago",
        memoryUsed: true,
      },

      {
        id: "demo-3",
        title: "High CPU on notification worker",
        service: "Notification Worker",
        severity: "Medium",
        description:
          "Worker CPU reached 100% and message processing slowed down.",
        symptoms: "CPU spike after a deployment",
        rootCause: "Infinite retry loop",
        resolution:
          "Fixed retry backoff logic and deployed a patch.",
        lessons:
          "Inspect retry loops after unusual CPU spikes.",
        status: "Resolved",
        date: "5 days ago",
        memoryUsed: true,
      },
    ].filter(
      (x) => !existingTitles.has(x.title)
    );

    await writeIncidents([
      ...demoRecords,
      ...items,
    ]);

    res.json({
      ok: true,
      message:
        "Demo incident history loaded and retained in Hindsight.",
    });
  } catch (e) {
    res.status(500).json({
      error:
        e.message || "Could not load demo data.",
    });
  }
});

// -------------------- SERVE REACT FRONTEND --------------------

const DIST_DIR = path.join(process.cwd(), "dist");

app.use(express.static(DIST_DIR));

app.get("/", (_req, res) => {
  res.sendFile(path.join(DIST_DIR, "index.html"));
});

app.use((req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api/")) {
    return next();
  }

  res.sendFile(path.join(DIST_DIR, "index.html"));
});

// -------------------- START SERVER --------------------

const server = app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `RecallOps backend running on port ${PORT}`
    );
  }
);

server.on("error", (err) => {
  console.error("SERVER ERROR:", err);
});