# 🌐 Relay Network

## Current Implementation

ShadowNet currently operates a **relay-capable proxy system**, not a fully independent relay network.

Requests may be routed through:

- Internal proxy server (`/api/proxy`)
- External public relay services (temporary fallback only):
  - allorigins.win
  - thingproxy
  - corsproxy.io

These public relays are used to maintain availability and bypass basic restrictions during early development.

---

## ⚠️ Temporary Infrastructure

The use of public relay services is **temporary**.

- These services are **not operated or controlled by ShadowNet**
- They are used strictly as **interim infrastructure**
- Privacy and logging policies of these services **cannot be guaranteed**

---

## 🚧 Planned Relay Network

ShadowNet is actively developing a **dedicated relay node network**, which will replace public relays.

Planned improvements include:

- Region-based nodes (US, EU, Asia)
- Custom-operated relay servers
- Independent deployment per node
- Transparent node registry
- Public uptime and audit reporting
- Reduced reliance on third-party infrastructure

---

## 🔐 Privacy Model (Current vs Future)

**Current:**
- Mixed routing (internal proxy + public relays)
- Best-effort privacy
- No guarantees on third-party nodes

**Future:**
- Fully controlled relay infrastructure
- Verifiable no-log policies
- Stronger anonymity guarantees

---

## 🧠 Transparency Statement

ShadowNet is currently an **experimental privacy tool**.

> It should not be relied on for strong anonymity guarantees at this stage.

The project is under active development, and infrastructure is evolving.

We encourage independent review and contributions.
