# SOURCES.md — Registre consolidat de fonts

**Data de consulta de totes les fonts:** 2026-09-16, llevat que s'indiqui altrament.
Nivells de confiança: **High** (font primària/oficial), **Medium** (font secundària reputada o
resum de tercers d'una font primària), **Low** (font no verificada independentment).

---

## Composio

| Font | URL | Extret | Confiança |
|---|---|---|---|
| GitHub REST API (metadades repo) | api.github.com/repos/ComposioHQ/composio | Estrelles, forks, issues, llicència, topics, dates | High |
| Raw LICENSE | raw.githubusercontent.com/ComposioHQ/composio/next/LICENSE | Text MIT complet, copyright "Sampark Inc. 2025" | High |
| Raw CONTRIBUTING.md | raw.githubusercontent.com/ComposioHQ/composio/next/CONTRIBUTING.md | Clàusula ISC per a contribucions, workflow, comandes de scaffolding | High |
| Arbre de directoris del repo (`ts/packages/core/src`, `models/`, `services/`, `python/composio`, `ts/packages/cli`, `docs/public/data`) | github.com/ComposioHQ/composio/tree/next/... | Estructura confirmada, fitxers de models, dades de catàleg | High |
| Raw `composio.ts` (primeres 40 línies) | raw.githubusercontent.com/.../composio.ts | Sense capçalera de llicència; `baseURL` per defecte cap a backend.composio.dev | High |
| Blog Composio — Tool Router | composio.dev/blog/introducing-tool-router-(beta) | Propòsit, mostra de codi, referència "Rube", framing "v0 of skills" | High |
| Docs — Authenticating Tools | docs.composio.dev/docs/authenticating-tools | Fluxos OAuth/API-key/Bearer/Basic, auth config vs. connected account | High |
| Docs — How Composio Works | docs.composio.dev/docs/how-composio-works | Definició de sessió, codi de creació/represa | High |
| Docs — Triggers | docs.composio.dev/docs/triggers | Tipus/instàncies de trigger, entrega realtime vs. polling | High |
| Docs — MCP overview | docs.composio.dev/docs/mcp-overview | Composio com a servidor MCP, forma d'endpoint, guia cap a sessions | High |
| Docs — Local sandbox | docs.composio.dev/docs/sandbox/local | Mecanisme de workbench local, estat experimental | High |
| Pàgina de preus | composio.dev/pricing | Nivells Free/Scale/Enterprise, add-ons mesurats, xifra "1500+ toolkits" | High |
| GitHub Discussion #1037 | github.com/ComposioHQ/composio/discussions/1037 | Reclams comunitaris sobre self-hosting, sense confirmació oficial | Low |
| DeepWiki — Composio overview / Tools and Toolkits | deepwiki.com/ComposioHQ/composio | Síntesi d'arquitectura, camps de ToolSchema, meta-tools | Medium (resum de tercers, no font primària) |
| codeline.co — repo review | codeline.co/thoughts/repo-review/2025/composio-1000-toolkits-for-ai-agents | Crítica de l'abstracció de provider i dependència de backend | Low (opinió de tercers) |
| Docs — Meta Tools / Search Tools | docs.composio.dev/toolkits/meta-tools[/search_tools] | Comportament de `COMPOSIO_SEARCH_TOOLS` | Medium (via resum de resultat de cerca) |
| Llocs de comparació de tercers (Nango, bitdoze, openconnector.dev, selfhostedworld) | múltiples | Reclams que el backend/credencials/sandbox són propietaris | Low |
| Cerca de GitHub — Rube | github.com/ComposioHQ/Rube (404 en fetch directe) | Descripció del producte Rube | Low (no confirmat per fetch directe) |

## MCP (Model Context Protocol)

| Font | URL | Extret | Confiança |
|---|---|---|---|
| Índex de l'espec MCP (2026-07-28) | modelcontextprotocol.io/specification/2026-07-28 | Visió general, seguretat, detalls clau | High |
| Blog MCP — espec 2026-07-28 | blog.modelcontextprotocol.io/posts/2026-07-28/ | Resum de release, nucli stateless, tiers d'SDK | High |
| Changelog de l'espec | modelcontextprotocol.io/specification/2026-07-28/changelog | Canvis majors/menors/deprecats vs. 2025-11-25 | High |
| Arquitectura | modelcontextprotocol.io/specification/2026-07-28/architecture | Definicions host/client/server, negociació de capacitats | High |
| Transports | modelcontextprotocol.io/specification/2026-07-28/basic/transports | Bindings stdio/Streamable HTTP | High |
| Tools / Resources / Prompts spec | modelcontextprotocol.io/specification/2026-07-28/server/{tools,resources,prompts} | Primitives completes | High |
| Authorization spec | modelcontextprotocol.io/specification/2026-07-28/basic/authorization | OAuth 2.1, RFC 8707/9207/9728, CIMD vs. DCR | High |
| Security Best Practices | modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices | Confused deputy, token passthrough, SSRF, etc. | High |
| Versioning spec | modelcontextprotocol.io/specification/2026-07-28/basic/versioning | Negociació per request, `server/discover` | High |
| Sampling / Elicitation / Roots spec | modelcontextprotocol.io/specification/2026-07-28/client/{sampling,elicitation,roots} | Deprecació de sampling/roots, modes d'elicitation | High |
| modelcontextprotocol/servers (GitHub) | github.com/modelcontextprotocol/servers | Servidors de referència, llicència dual | High |
| TypeScript SDK / Python SDK (GitHub) | github.com/modelcontextprotocol/{typescript-sdk,python-sdk} | Llicència, estabilitat v2 | Medium (resum de fetch) |
| Registre oficial MCP | registry.modelcontextprotocol.io | Existència, propòsit | Medium (fetch directe sense contingut) |
| MCP joins AAIF / Linux Foundation / Anthropic | blog.modelcontextprotocol.io, linuxfoundation.org, anthropic.com | Governança, membres platinum | High |
| TechCrunch — OpenAI adopta MCP | techcrunch.com/2025/03/26/... | Data d'adopció | Medium |
| Claude Code MCP docs | code.claude.com/docs/en/mcp | Config, àmbits, transports, runtime v1/v2 | High |
| CVEs de seguretat (mcp-remote, MCPoison, nginx-ui) | diverses fonts secundàries | Incidents de seguretat citats | **Low — NOT independently verified against NVD/MITRE** |

## Claude Code / VS Code / Agent SDK

| Font | URL | Extret | Confiança |
|---|---|---|---|
| MCP | code.claude.com/docs/en/mcp | Config, transports, àmbits, auth | High |
| Memory | code.claude.com/docs/en/memory | CLAUDE.md, rules, auto memory | High |
| Hooks | code.claude.com/docs/en/hooks | Esdeveniments, handlers, contracte I/O | High |
| Sub-agents | code.claude.com/docs/en/sub-agents | Frontmatter, àmbits, invocació | High |
| VS Code | code.claude.com/docs/en/vs-code | Funcionalitats de l'extensió, servidor MCP `ide` | High |
| Settings | code.claude.com/docs/en/settings | Fitxers i precedència | High |
| Permissions | code.claude.com/docs/en/permissions | Modes, sintaxi de regles | High |
| Skills | code.claude.com/docs/en/skills | Format SKILL.md, invocació | High |
| Authentication | code.claude.com/docs/en/authentication | Emmagatzematge de credencials, precedència | High |
| Agent SDK Overview | code.claude.com/docs/en/agent-sdk/overview | SDK vs. CLI vs. Client SDK vs. Managed Agents | High |
| Sandboxing (via resum de cerca) | code.claude.com/docs/en/sandboxing | Suport de plataforma, aïllament fs/xarxa | Medium (no fetch directe) |
| GitHub — torarnv/claude-remote-shell | github.com/torarnv/claude-remote-shell | Evidència que SSH-backed Bash és un workaround comunitari | Low |
| GitHub issues anthropics/claude-code #21299, #18964 | github.com/anthropics/claude-code/issues/... | Limitacions conegudes, inconsistència de docs | Low |

## SSH / Seguretat / Arquitectura remota

Font completa a `research/SSH-SECURITY-NOTES.md` (50 fonts numerades). Destacades:

| Font | URL | Extret | Confiança |
|---|---|---|---|
| OpenBSD sshd(8) man page | man.openbsd.org/sshd | Opcions authorized_keys (`command=`, `restrict`, etc.) | High (primària) |
| Debian authorized_keys(5) | manpages.debian.org | Format authorized_keys | High (primària) |
| Vincent Bernat — Safer SSH agent forwarding | vincent.bernat.ch/en/blog/2020-safer-ssh-agent-forwarding | Risc d'agent forwarding, alternativa ProxyJump, incident Matrix.org | High |
| OWASP GenAI — LLM Top 10 | genai.owasp.org/llm-top-10 | LLM01 Prompt Injection, LLM06 Excessive Agency | High (primària) |
| OWASP Cheat Sheet — LLM Prompt Injection Prevention | cheatsheetseries.owasp.org | Patró dual-LLM/quarantena | High (primària) |
| Paramiko official docs | docs.paramiko.org | Timeout/exit-code en exec_command | High (primària) |
| Microsoft Security Blog — Least privilege for AI agents | microsoft.com/en-us/security/blog/2026/07/16/... | Agent com a identitat de primer ordre, credencials JIT | High (primària) |
| InfoQ — AI Agent Gateway pattern | infoq.com/articles/building-ai-agent-gateway-mcp/ | Patró OPA + ephemeral runners | Medium-High |
| unixy.io — Secrets Management 2026 | unixy.io/blog/secrets-management-2026/ | SOPS+age vs. Vault, adequació per equips petits | Medium |
| CSF Tools — NIST SP 800-53 AC-17 | csf.tools/reference/nist-sp-800-53/r5/ac/ac-17/ | Requisits formals d'accés remot | High (derivat de NIST) |

---

## Notes generals sobre fiabilitat

- Totes les fonts oficials (docs.composio.dev, modelcontextprotocol.io, code.claude.com,
  man.openbsd.org, genai.owasp.org, cheatsheetseries.owasp.org) es tracten com a **High**.
- Resums generats per eines de tercers (DeepWiki) o per motors de cerca sense fetch directe del
  document original es marquen **Medium** i s'haurien de reverificar abans de citar-los com a fet
  consolidat en decisions d'arquitectura.
- Cap CVE citat en aquest bloc de recerca ha estat verificat directament contra NVD/MITRE — **cal
  fer-ho abans de citar-los com a confirmats** en qualsevol document públic o decisió de seguretat.
- Discussions/issues de GitHub es tracten com a **Low** (il·lustratives, no autoritatives) llevat
  que siguin de mantenidors oficials confirmant un fet.
