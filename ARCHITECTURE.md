# Architecture Overview

ShadowNet is a relay-based web proxy and blockchain intelligence platform designed to reduce direct client exposure to external services.

---

## 🧩 System Components

### 1. Client (Frontend)
- Built with React + Next.js  
- Handles UI, session control, and request initiation  
- Applies client-side interception (fetch/XHR/DOM rewriting)  

---

### 2. API Server (Backend)
- Built with Node.js + Express  
- Provides proxy routing and intelligence endpoints  
- Enforces validation, rate limiting, and request controls  

---

### 3. Proxy Layer

The proxy layer is responsible for:

- Fetching external resources  
- Rewriting URLs for consistent routing  
- Injecting control scripts into HTML responses  
- Filtering unsafe requests  

---

### 4. Relay Routing

Requests follow this path:

Client → ShadowNet API → Relay (optional) → Target Site → Response → Rewritten → Client

- Internal relay (`/api/proxy`) is the default path  
- External relays may be used as fallback  
- Relay selection is based on performance and availability  

---

## 🔄 Request Lifecycle

1. User submits a URL  
2. URL is validated and normalized  
3. Proxy fetches the resource  
4. Response is processed:
   - Headers sanitized  
   - HTML/CSS rewritten  
   - Control scripts injected  
5. Response returned to client  

---

## 🔒 Security Layers

- Input validation and SSRF protection  
- Private IP blocking via DNS resolution  
- Rate limiting and request throttling  
- Timeout protection for upstream calls  
- Client-side API interception  

---

## ⚠️ Trust Model

ShadowNet operates under a **trusted relay model**:

- The backend acts as an intermediary between user and destination  
- Users must trust the server not to log or alter sensitive data  
- External relays (if used) introduce additional trust assumptions  

---

## 📌 Design Goals

- Reduce direct IP exposure  
- Provide consistent browsing sessions  
- Enable blockchain intelligence tooling  
- Maintain transparency about limitations  

---

## 🚧 Limitations

- Not a decentralized system  
- Not resistant to advanced fingerprinting  
- Some sites may break due to rewriting  
- Depends on relay availability and reliability  
