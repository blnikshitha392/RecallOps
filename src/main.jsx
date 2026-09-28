import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const demoIncidents = [
  {
    id: "demo-1",
    title: "Payment API 500 errors",
    service: "Payment API",
    severity: "Critical",
    description: "Customers could not complete payments. API returned HTTP 500 errors.",
    symptoms: "Repeated 500 responses from /payments endpoint",
    rootCause: "Expired API certificate",
    resolution: "Renewed the certificate and restarted the payment service.",
    lessons: "Check certificate expiry during payment API incidents.",
    status: "Resolved",
    date: "14 days ago",
    memoryUsed: true
  },
  {
    id: "demo-2",
    title: "Database connection failures",
    service: "Order Database",
    severity: "High",
    description: "Order service intermittently failed to connect to PostgreSQL.",
    symptoms: "Connection pool exhausted",
    rootCause: "Connection leak in worker",
    resolution: "Fixed the connection leak and increased pool monitoring.",
    lessons: "Check pool utilization and long-lived connections first.",
    status: "Resolved",
    date: "9 days ago",
    memoryUsed: true
  },
  {
    id: "demo-3",
    title: "High CPU on notification worker",
    service: "Notification Worker",
    severity: "Medium",
    description: "Worker CPU reached 100% and message processing slowed down.",
    symptoms: "CPU spike after a deployment",
    rootCause: "Infinite retry loop",
    resolution: "Fixed retry backoff logic and deployed a patch.",
    lessons: "Inspect retry loops after unusual CPU spikes.",
    status: "Resolved",
    date: "5 days ago",
    memoryUsed: true
  }
];

function App() {
  const [page, setPage] = React.useState("dashboard");
  const [incidents, setIncidents] = React.useState([]);
  const [selected, setSelected] = React.useState(null);
  const [analysis, setAnalysis] = React.useState(null);
  const [memoryQuery, setMemoryQuery] = React.useState("");
  const [memories, setMemories] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [status, setStatus] = React.useState(null);

  const loadIncidents = React.useCallback(async () => {
    const r = await fetch("/api/incidents");
    const data = await r.json();
    setIncidents(data);
  }, []);

  React.useEffect(() => { loadIncidents(); }, [loadIncidents]);

  async function loadDemo() {
    setLoading(true); setStatus(null);
    try {
      const r = await fetch("/api/demo/load", { method: "POST" });
      const data = await r.json();
      setStatus({ ok: r.ok, text: data.message });
      await loadIncidents();
    } catch {
      setStatus({ ok: false, text: "Could not load demo data." });
    } finally { setLoading(false); }
  }

  async function analyzeIncident(form) {
    setLoading(true); setStatus(null); setAnalysis(null);
    try {
      const r = await fetch("/api/incidents/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Analysis failed");
      setAnalysis(data);
      setPage("analysis");
    } catch (e) {
      setStatus({ ok: false, text: e.message });
    } finally { setLoading(false); }
  }

  async function resolveIncident(payload) {
    setLoading(true);
    try {
      const r = await fetch("/api/incidents/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Could not resolve incident");
      setStatus({ ok: true, text: "Incident resolved and added to RecallOps memory." });
      await loadIncidents();
      setPage("history");
    } catch (e) {
      setStatus({ ok: false, text: e.message });
    } finally { setLoading(false); }
  }

  async function searchMemory() {
    if (!memoryQuery.trim()) return;
    setLoading(true);
    try {
      const r = await fetch("/api/memory/recall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: memoryQuery })
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Memory search failed");
      setMemories(data.memories || []);
    } catch (e) {
      setStatus({ ok: false, text: e.message });
    } finally { setLoading(false); }
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brandMark">R</div>
          <div><strong>RecallOps</strong><span>Incident Intelligence</span></div>
        </div>
        <nav>
          {[
            ["dashboard","Dashboard"],
            ["new","New Incident"],
            ["history","Incident History"],
            ["memory","Memory Explorer"]
          ].map(([id,label]) => (
            <button key={id} className={page===id ? "nav active" : "nav"} onClick={()=>setPage(id)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebarBottom">
          <div className="memoryBadge"><span className="dot"></span> Hindsight Memory</div>
          <small>Persistent incident learning</small>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <div className="eyebrow">AI INCIDENT RESPONSE</div>
            <h1>{page === "dashboard" ? "Operations overview" :
                page === "new" ? "New incident" :
                page === "history" ? "Incident history" :
                page === "memory" ? "Memory explorer" : "Incident analysis"}</h1>
          </div>
          <button className="primary" onClick={()=>setPage("new")}>+ New Incident</button>
        </header>

        {status && <div className={status.ok ? "toast success" : "toast error"}>{status.text}</div>}

        {page === "dashboard" && (
          <Dashboard incidents={incidents} onNew={()=>setPage("new")} onDemo={loadDemo} loading={loading} />
        )}

        {page === "new" && (
          <IncidentForm onSubmit={analyzeIncident} loading={loading} />
        )}

        {page === "analysis" && analysis && (
          <Analysis
            data={analysis}
            onResolve={resolveIncident}
            loading={loading}
            onBack={()=>setPage("new")}
          />
        )}

        {page === "history" && (
          <History incidents={incidents} onSelect={(i)=>{setSelected(i);setPage("details")}} />
        )}

        {page === "details" && selected && (
          <Details incident={selected} onBack={()=>setPage("history")} />
        )}

        {page === "memory" && (
          <MemoryExplorer query={memoryQuery} setQuery={setMemoryQuery}
            onSearch={searchMemory} memories={memories} loading={loading} />
        )}
      </main>
    </div>
  );
}

function Dashboard({incidents,onNew,onDemo,loading}) {
  const resolved = incidents.filter(i=>i.status==="Resolved").length;
  const recalled = incidents.filter(i=>i.memoryUsed).length;
  return <div>
    <section className="hero">
      <div>
        <div className="pill">● MEMORY-FIRST AI AGENT</div>
        <h2>Remember incidents.<br/><em>Resolve faster.</em></h2>
        <p>RecallOps learns from previous incidents using Hindsight, then uses that experience when similar failures happen again.</p>
        <div className="heroActions">
          <button className="primary" onClick={onNew}>Analyze an incident</button>
          <button className="secondary" onClick={onDemo} disabled={loading}>{loading ? "Loading…" : "Load demo history"}</button>
        </div>
      </div>
      <div className="loop">
        <div>NEW INCIDENT</div><span>↓</span><div className="glow">HINDSIGHT RECALL</div><span>↓</span><div>MEMORY-INFORMED ACTION</div><span>↓</span><div>RESOLVE & REMEMBER</div>
      </div>
    </section>
    <div className="stats">
      <Stat label="Total incidents" value={incidents.length}/>
      <Stat label="Resolved" value={resolved}/>
      <Stat label="Memory-assisted" value={recalled}/>
      <Stat label="Open" value={incidents.length-resolved}/>
    </div>
    <section className="section">
      <div className="sectionTitle"><h3>Recent incidents</h3><button className="link" onClick={()=>location.hash="history"}>View all</button></div>
      {incidents.length===0 ? <Empty text="No incidents yet. Load demo history to see the memory workflow."/> :
      <div className="cards">{incidents.slice(0,5).map(i=><IncidentCard key={i.id} incident={i}/>)}</div>}
    </section>
  </div>
}

function Stat({label,value}) { return <div className="stat"><span>{label}</span><strong>{value}</strong></div> }

function IncidentForm({onSubmit,loading}) {
  const [form,setForm]=React.useState({title:"",service:"",severity:"High",description:"",symptoms:""});
  const set=(k,v)=>setForm({...form,[k]:v});
  return <div className="formWrap">
    <div className="formIntro"><span className="pill">STEP 1</span><h2>Describe the incident</h2><p>RecallOps will search Hindsight for relevant previous incidents before generating its analysis.</p></div>
    <form className="form" onSubmit={e=>{e.preventDefault();onSubmit(form)}}>
      <label>Incident title<input required value={form.title} onChange={e=>set("title",e.target.value)} placeholder="e.g. Payment API returning 500 errors"/></label>
      <div className="grid2">
        <label>Affected service<input required value={form.service} onChange={e=>set("service",e.target.value)} placeholder="e.g. Payment API"/></label>
        <label>Severity<select value={form.severity} onChange={e=>set("severity",e.target.value)}><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select></label>
      </div>
      <label>Description<textarea required rows="4" value={form.description} onChange={e=>set("description",e.target.value)} placeholder="What is happening?"/></label>
      <label>Symptoms<textarea rows="3" value={form.symptoms} onChange={e=>set("symptoms",e.target.value)} placeholder="Errors, logs, timing, affected users…"/></label>
      <button className="primary wide" disabled={loading}>{loading ? "Searching memory…" : "Analyze with Hindsight →"}</button>
    </form>
  </div>
}

function Analysis({data,onResolve,loading,onBack}) {
  const [showResolve,setShowResolve]=React.useState(false);
  const [rootCause,setRootCause]=React.useState("");
  const [resolution,setResolution]=React.useState("");
  const [lessons,setLessons]=React.useState("");
  return <div>
    <button className="back" onClick={onBack}>← Back</button>
    <div className="analysisGrid">
      <div className="analysisMain">
        <div className="analysisHeader"><span className={"severity "+data.incident.severity.toLowerCase()}>{data.incident.severity}</span><h2>{data.incident.title}</h2><p>{data.incident.description}</p></div>
        <div className="panel"><h3>AI analysis</h3><p className="answer">{data.answer}</p></div>
        <div className="panel"><h3>Recommended next steps</h3><ul>{(data.nextSteps||[]).map((x,i)=><li key={i}>{x}</li>)}</ul></div>
        {!showResolve ? <button className="primary" onClick={()=>setShowResolve(true)}>Resolve & Remember</button> :
        <div className="resolve panel">
          <h3>Save the outcome to Hindsight</h3>
          <label>Root cause<input value={rootCause} onChange={e=>setRootCause(e.target.value)} placeholder="What caused the incident?"/></label>
          <label>Resolution<textarea value={resolution} onChange={e=>setResolution(e.target.value)} placeholder="What fixed it?"/></label>
          <label>Lessons learned<textarea value={lessons} onChange={e=>setLessons(e.target.value)} placeholder="What should the agent remember?"/></label>
          <button className="primary" disabled={loading} onClick={()=>onResolve({incident:data.incident,rootCause,resolution,lessons})}>{loading ? "Remembering…" : "Save & Remember"}</button>
        </div>}
      </div>
      <aside className="memoryPanel">
        <div className="memoryTitle"><span className="dot"></span> HINDSIGHT MEMORY</div>
        {data.memories?.length ? <><div className="memoryFound">✓ Similar memory found</div>{data.memories.map((m,i)=><div className="memoryItem" key={i}><small>RECALLED MEMORY</small><p>{m.text}</p></div>)}</> :
        <div className="noMemory"><strong>No closely related memory found</strong><p>This may be a new incident for the team. Once resolved, save the outcome so RecallOps can use it next time.</p></div>}
      </aside>
    </div>
  </div>
}

function History({incidents,onSelect}) { return <div className="tableWrap"><div className="tableHead"><span>Incident</span><span>Service</span><span>Severity</span><span>Status</span><span>Memory</span></div>{incidents.map(i=><button className="tableRow" key={i.id} onClick={()=>onSelect(i)}><span><strong>{i.title}</strong><small>{i.date}</small></span><span>{i.service}</span><span><b className={"severity "+i.severity.toLowerCase()}>{i.severity}</b></span><span>{i.status}</span><span>{i.memoryUsed ? "✓ Recalled" : "—"}</span></button>)}</div> }

function Details({incident,onBack}) { return <div><button className="back" onClick={onBack}>← Back</button><div className="panel detail"><span className={"severity "+incident.severity.toLowerCase()}>{incident.severity}</span><h2>{incident.title}</h2><p>{incident.description}</p><hr/><div className="grid2"><div><small>Service</small><strong>{incident.service}</strong></div><div><small>Status</small><strong>{incident.status}</strong></div></div><h3>Root cause</h3><p>{incident.rootCause || "Not recorded yet."}</p><h3>Resolution</h3><p>{incident.resolution || "Not recorded yet."}</p><h3>Lessons learned</h3><p>{incident.lessons || "Not recorded yet."}</p></div></div> }

function MemoryExplorer({query,setQuery,onSearch,memories,loading}) { return <div className="memoryExplorer"><div className="formIntro"><span className="pill">HINDSIGHT</span><h2>Explore team memory</h2><p>Ask what RecallOps remembers about previous incidents.</p></div><div className="search"><input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&onSearch()} placeholder="e.g. What happened during previous payment API incidents?"/><button className="primary" onClick={onSearch} disabled={loading}>{loading?"Searching…":"Recall"}</button></div><div className="memoryResults">{memories.map((m,i)=><div className="panel memoryItem" key={i}><small>HINDSIGHT RESULT {i+1}</small><p>{m.text}</p></div>)}</div></div> }

function IncidentCard({incident}) { return <div className="incidentCard"><div className="cardTop"><span className={"severity "+incident.severity.toLowerCase()}>{incident.severity}</span><span>{incident.date}</span></div><h4>{incident.title}</h4><p>{incident.service}</p><div className="cardBottom"><span>{incident.status}</span>{incident.memoryUsed&&<span className="remembered">✓ Memory used</span>}</div></div> }
function Empty({text}) { return <div className="empty">{text}</div> }

createRoot(document.getElementById("root")).render(<App />);
