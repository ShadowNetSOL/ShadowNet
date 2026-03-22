Security Overview

ShadowNet is designed as a relay-based proxy system with privacy-focused request handling and blockchain intelligence tooling for the Solana ecosystem.

This document outlines the system’s security model, limitations, and protections.
## Security Principles

ShadowNet follows a pragmatic security model:

- **Minimise trust assumptions** where possible  
- **Fail safely** (invalid or risky requests are rejected)  
- **Prefer transparency over guarantees**  
- **Limit data exposure rather than claim full anonymity**  
⸻

🧠 Threat Model

ShadowNet is designed to mitigate:
	•	Direct IP exposure to third-party services
	•	Basic tracking via request metadata
	•	Accidental client-side leakage through standard browser APIs

ShadowNet does not protect against:
	•	Malicious or compromised relay infrastructure
	•	Advanced fingerprinting techniques
	•	Browser-level exploits or extensions
	•	Nation-state or ISP-level surveillance

⸻

🌐 Proxy & Relay Security

The proxy system includes multiple safeguards:

Input Validation
	•	Only http and https protocols are allowed
	•	URL parsing and normalization is enforced
	•	Blocked port list prevents access to sensitive services
	•	Requests to private/internal IP ranges are denied

SSRF Protection
	•	DNS resolution is used to detect private IP ranges
	•	Loopback and internal network addresses are blocked
	•	Invalid or malformed URLs are rejected

Rate Limiting & Abuse Prevention
	•	Global rate limiting applied to API routes
	•	Request throttling to reduce abuse patterns
	•	Timeout protection on upstream requests

⸻

🧩 Client-Side Controls

ShadowNet injects a controlled script layer to enforce consistent routing:
	•	Overrides fetch and XMLHttpRequest
	•	Rewrites dynamically created resource URLs
	•	Intercepts navigation attempts

Additional protections:
	•	Disables WebRTC to prevent IP leaks
	•	Blocks geolocation APIs
	•	Prevents service worker registration

⸻

📦 Data Handling
	•	ShadowNet does not intentionally persist user browsing data
	•	Requests are processed in-memory and forwarded to upstream services
	•	No user authentication or identity tracking is implemented

Note: Standard server logs (e.g. request metadata) may still exist depending on deployment configuration.
### Logging & Data Retention

- ShadowNet does not intentionally store browsing history or full request payloads  
- Minimal request metadata (e.g. timestamps, hostnames) may be logged for debugging and abuse prevention  
- Logs are not designed for long-term storage or user profiling  
- No session-level tracking or user identifiers are implemented  
⸻

⚠️ ## Known Limitations

- Relay-based architecture introduces a trusted intermediary (server)
- Full anonymity is not guaranteed
- Some modern websites may bypass or break under proxy rewriting
- External/public relay endpoints are used temporarily and are not controlled or audited
- Dedicated ShadowNet relay infrastructure is still in development and not independently audited
- Proxy-based architecture requires trust in the server layer
⸻

🔐 Cryptographic & Key Management
	•	ShadowNet does not require private key custody for core proxy functionality
	•	Any blockchain-related features rely on standard libraries within the Solana ecosystem

Users should always manage sensitive keys locally and avoid sharing private credentials with any service.

⸻

🚨 Reporting Vulnerabilities

If you discover a security issue:
	•	Report responsibly via repository issues or direct contact
	•	Include steps to reproduce and impact assessment
	•	Avoid public disclosure until the issue is reviewed

⸻

📌 Disclaimer

ShadowNet is an experimental system under active development.

It should not be relied upon for:
	•	Strong anonymity guarantees
	•	Protection against advanced adversaries
	•	Secure handling of sensitive credentials
