# 🌑 ShadowNet
## ⚠️ Experimental Project Notice

ShadowNet is an experimental privacy-focused platform currently under active development.
> ⚠️ ShadowNet is currently in active development and should be considered experimental infrastructure.
- Relay infrastructure is in progress and not yet independently audited
- Public relay services are used temporarily as fallback nodes
- Privacy features aim to reduce tracking, but do not guarantee anonymity
- This project should not be relied on for sensitive or high-risk use cases

For full details, see RELAYS.md and SECURITY.md.
<!-- Hero Section -->
![Hero Banner](https://ibb.co/Df0KnTh2)  
![Gradient Hero](https://img.shields.io/badge/ShadowNet-Privacy--Focused-blueviolet?style=for-the-badge&logo=blockchain)

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![GitHub Workflow](https://img.shields.io/badge/GitHub-Workflow-blueviolet.svg)
![Solana](https://img.shields.io/badge/Solana-mainnet-success)

**Privacy-native access layer for Web3**  
Interact with decentralized applications while reducing direct exposure of your IP, session data, and device fingerprint.
For details on relay infrastructure, see RELAYS.md
[![🌐 Get Started](https://img.shields.io/badge/Get_Started-app--shadownet.net-brightgreen?style=for-the-badge)](https://app-shadownet.net)

---

## 🎬 Live Demo & Features

**Animated Demo GIF:**  
[![ShadowNet Demo](https://makeagif.com/i/2R7sLJ)](https://app-shadownet.net)

**Key Features:**

- 🔐 **Stealth Sessions** – randomized fingerprints, isolated sessions, IP cloaking  
- 🧩 **Anonymous Solana Wallets** – Ed25519 keypairs, zero retention  
- 🌐 **Global Relay Network** 
- **Hybrid relay system (temporary public + planned private nodes)**
- Public relay endpoints are used during early development
- Dedicated ShadowNet relay infrastructure is currently in development
- Future releases will introduce independently audited, no-log relay nodes
- - Some relay endpoints may be rate-limited or unavailable depending on external providers
- 🕵️ **Intel Hub** – on-chain + social intelligence for anonymous due diligence  
- ⚡ **User-friendly** – clean interface, full Web3 compatibility  

**Live Preview Thumbnail:**  
[![ShadowNet Live Preview](https://replit.com/@ShadowNetSOL/ShadowNet.svg?sanitize=true)](https://app-shadownet.net)

> ✨ Click the GIF, live preview, or **Get Started** button to open the live site instantly.  
> Mobile-friendly: GIFs and features stack vertically.

---

## 🧠 What is ShadowNet?

**ShadowNet** is a **privacy-native access layer for the decentralized web**. It empowers individuals, researchers, and builders to interact with **Web3 applications and the open internet** without exposing their **identity, location, or device fingerprint**. 

ShadowNet combines four independent modules — **stealth sessions, anonymous wallets, a global relay network, and on-chain intelligence (Intel Hub)** — to deliver a **comprehensive, privacy-focused session and relay architecture**.

### 🌟 Core Features

#### 1. Stealth Sessions
- Fully sandboxed sessions with **fresh randomized fingerprints**. 
- Randomized attributes: **user-agent, screen resolution, color depth, timezone, language, platform, WebGL strings, canvas hash, audio hash, font list**.  
- Traffic routed via **relay nodes**, masking your real IP.  
- **Session isolation** prevents cookies, cache, or storage from leaking across sessions.  
- **How to use:** Stealth Sessions → enter target URL → select relay node → **INITIATE STEALTH** → **LAUNCH TARGET SITE**. Session lasts up to one hour.

#### 2. Anonymous Wallet Generation
- Generates **Solana Ed25519 keypairs** via **BIP-39 mnemonics**.  
- Fully compatible with **Phantom and other Solana wallets**.  
- ** Keys are generated per session and not intended for persistent storage within the platform. Users are responsible for secure handling.
- **Importing:** Copy private key → Phantom → Add / Connect Wallet → Import Private Key → paste.  
- **Security guidance:** Store keys offline or encrypted; ShadowNet cannot recover lost keys.

#### 3. Global Relay Network
- **Curated network of relay-based routing infrastructure (centrally operated in current version)**.  
- Select nodes by **latency, geographic location, or jurisdiction**.  
- Node status: online, maintenance, offline; auto-refresh available.  
- Destination servers only see relay IP, never your real IP.

#### 4. Intel Hub
- Aggregates **on-chain and social intelligence**.  
- **Wallet Analyzer:** transaction history, PnL, frequently held assets.  
- **X CA Checker:** scans X (Twitter) accounts for Solana contract addresses mentioned.  
- **Smart Followers:** identifies high-signal on-chain followers for social alpha indicators.

---

### 🔐 Why ShadowNet?

Modern tracking infrastructure is highly sophisticated. Websites track users via dozens of **passive signals**: canvas, WebGL, audio, fonts, screen geometry, etc. Standard privacy tools cover some vectors but rarely all. ShadowNet closes **every gap** across **all layers**:

- **Device & fingerprint anonymization**  
- **Session isolation & IP cloaking**  
- **Anonymous wallet generation**  
- **Encrypted traffic routing through audited relay nodes**  
- **On-chain & social intelligence analysis without revealing identity**

> **Not just a VPN. The entire stack.**  
> ShadowNet is designed to minimise exposure across device, session, and network layers*, providing ** enhanced privacy access to Web3 environments**.

---

### 🛡 Security & Architecture

- **Minimal Data Retention:** ShadowNet is designed to avoid persisting sensitive session data  
- **Session Isolation:** Sandboxed browsing reduces cross-session tracking  
- **Relay Model:** Requests are routed through a controlled proxy layer  
- **Transparency:** System behaviour and limitations are documented in the codebase    
- **Session Isolation:** Sandboxed browsing prevents cross-session correlation.  
- **Client-side Keys:** Wallet keypairs generated server-side, transmitted once over TLS, no copy retained.

---

## 🛠 Tech Stack

<div style="background-color:#f0f4f8; padding:10px; border-radius:6px">

- **Blockchain:** Solana  
- **Language:** TypeScript / JavaScript  
- **Package Manager:** pnpm  
- **Build Tools:** TypeScript, Node.js environment  

</div>

---
## 🔐 Security Model

ShadowNet includes several defensive mechanisms:

- URL validation and protocol enforcement
- Private IP range blocking (SSRF protection)
- Rate limiting and request throttling
- Timeout protection for outbound requests
- Header sanitisation and controlled response handling

See SECURITY.md for full details and limitations.

## 📦 Getting Started

<div style="background-color:#e8f5e9; padding:10px; border-radius:6px">

### Prerequisites

- Node.js ≥ 18  
- pnpm package manager  
- Solana CLI (optional for local dev)  
- Phantom or Solflare wallet (if applicable)

### Installation

```bash
git clone https://github.com/ShadowNetSOL/ShadowNet.git
cd ShadowNet
pnpm install
pnpm run dev
Open http://localhost:3000 to view the dApp locally.
</div>
🧪 Usage
<div style="background-color:#fff3e0; padding:10px; border-radius:6px">
Connect your Solana wallet
	•	Use Stealth Sessions for private browsing
	•	Generate anonymous wallets and import them into Phantom
	•	Route traffic via Relay Network nodes
	•	Explore Intel Hub for on-chain and social intelligence
</div>
👥 Contributing
<div style="background-color:#ede7f6; padding:10px; border-radius:6px">
We welcome contributions!
	1.	Fork the repository
	2.	Create a feature branch (git checkout -b feature/YourFeature)
	3.	Commit your changes
	4.	Push to your fork
	5.	Open a Pull Request
Include tests or documentation updates for new features.
</div>
📄 License
<div style="background-color:#fbe9e7; padding:10px; border-radius:6px">
ShadowNet is licensed under the MIT License — see the LICENSE file.
</div>
📫 Contact
<div style="background-color:#e3f2fd; padding:10px; border-radius:6px">
ShadowNetSOL
	•	GitHub: https://github.com/ShadowNetSOL
	•	Live Site: https://app-shadownet.net
</div>
