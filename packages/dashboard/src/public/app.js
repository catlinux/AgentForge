// Read-only Dashboard frontend (DEC-067) — no build step, no framework, plain fetch + DOM.

function escapeHtml(value) {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function auditEventDetail(event) {
  const { type, eventId, timestamp, ...rest } = event;
  return Object.entries(rest)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(" ");
}

async function loadAudit() {
  const res = await fetch("/api/audit");
  const { events } = await res.json();
  const body = document.getElementById("audit-body");
  body.innerHTML = events
    .map(
      (event) =>
        `<tr><td>${escapeHtml(event.timestamp)}</td><td>${escapeHtml(event.type)}</td><td>${escapeHtml(auditEventDetail(event))}</td></tr>`,
    )
    .join("");
}

async function loadRegistry() {
  const res = await fetch("/api/tools/registry");
  const { entries } = await res.json();
  const body = document.getElementById("registry-body");
  body.innerHTML = entries
    .map(
      (entry) =>
        `<tr><td>${escapeHtml(entry.qualifiedName)}</td><td>${escapeHtml(entry.origin?.id ?? "")}</td><td>${entry.stale ? "sí" : "no"}</td></tr>`,
    )
    .join("");
}

async function loadDiscovery() {
  const res = await fetch("/api/tools/discovery");
  const { views } = await res.json();
  const body = document.getElementById("discovery-body");
  body.innerHTML = views
    .map(
      (view) =>
        `<tr><td>${escapeHtml(view.qualifiedName)}</td><td>${escapeHtml(view.description ?? "")}</td></tr>`,
    )
    .join("");
}

async function loadPolicy() {
  const res = await fetch("/api/policy");
  const config = await res.json();
  const body = document.getElementById("policy-body");
  const identities = new Set([
    ...Object.keys(config.riskByIdentity ?? {}),
    ...Object.keys(config.overrides ?? {}),
  ]);
  body.innerHTML = [...identities]
    .map(
      (identity) =>
        `<tr><td>${escapeHtml(identity)}</td><td>${escapeHtml(config.riskByIdentity?.[identity] ?? "")}</td><td>${escapeHtml(config.overrides?.[identity] ?? "")}</td></tr>`,
    )
    .join("");
}

const loaders = {
  audit: loadAudit,
  registry: loadRegistry,
  discovery: loadDiscovery,
  policy: loadPolicy,
};

function activateTab(name) {
  document
    .querySelectorAll(".tab")
    .forEach((el) => el.classList.toggle("active", el.dataset.tab === name));
  document
    .querySelectorAll(".panel")
    .forEach((el) => el.classList.toggle("active", el.id === name));
  loaders[name]();
}

document.querySelectorAll(".tab").forEach((el) => {
  el.addEventListener("click", () => activateTab(el.dataset.tab));
});

activateTab("audit");
