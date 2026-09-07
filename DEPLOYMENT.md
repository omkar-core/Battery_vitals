# Battery Vital — Production Deployment & Release Guide (DEPLOYMENT.md)

## 1. Deployment Architecture & Targets

Battery Vital supports a dual-target deployment model ensuring high availability, global low-latency CDN distribution, and persistent background workers:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Multi-Target Deployment                             │
│                                                                             │
│   [GitHub Repository (main)]                                                │
│         │                                                                   │
│         ├──► [Vercel Production Target]                                     │
│         │     • Global Edge CDN (Static Assets & PWA)                       │
│         │     • Serverless Functions (Next.js 14 App Router APIs)           │
│         │     • Automatic TLS 1.3 & DDoS Protection                         │
│         │                                                                   │
│         └──► [Render Infrastructure Target (render.yaml)]                   │
│               • Containerized Long-Running Node.js Web Service              │
│               • Persistent Background Telemetry Sync Worker                 │
│               • High-Availability Standalone Fallback                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Pre-Deployment Verification Checklist

Before deploying any release to production, engineers must complete and sign off on this checklist:

```bash
# 1. Linting Validation (0 warnings / errors required)
npm run lint

# 2. Automated Test Suite Execution
npm test

# 3. Production Compilation & Bundle Analysis
npm run build

# 4. Environment Variables Audit
# Verify all production secrets are configured in Vercel / Render dashboards:
# • NEXT_PUBLIC_FIREBASE_API_KEY
# • NEXT_PUBLIC_FIREBASE_DATABASE_URL
# • FIREBASE_ADMIN_PRIVATE_KEY
# • MONGODB_URI
# • GEMINI_API_KEY
```

---

## 3. Vercel Deployment Procedure (Primary)

### 3.1 Vercel Project Configuration (`vercel.json`)
The repository contains a pre-configured `vercel.json` defining security headers, routing, and caching behavior:

```json
{
  "version": 2,
  "framework": "nextjs",
  "buildCommand": "next build",
  "devCommand": "next dev",
  "installCommand": "npm install",
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Strict-Transport-Security", "value": "max-age=63072000; includeSubDomains; preload" }
      ]
    }
  ]
}
```

### 3.2 CLI Deployment Commands
```bash
# Preview Deployment (Staging)
vercel

# Production Deployment
vercel --prod
```

---

## 4. Render Infrastructure Deployment (`render.yaml`)

### 4.1 Infrastructure as Code
Render deploys Battery Vital using the root [`render.yaml`](file:///d:/Webapp/Working_webapps/Battery_vitals/render.yaml) specification:

```yaml
services:
  - type: web
    name: battery-vital
    env: node
    plan: starter
    region: oregon
    buildCommand: npm install && npm run build
    startCommand: npm run start
    autoDeploy: true
    envVars:
      - key: NODE_ENV
        value: production
      - key: NEXT_PUBLIC_APP_URL
        sync: false
      - key: MONGODB_URI
        sync: false
      - key: GEMINI_API_KEY
        sync: false
```

---

## 5. Domain Configuration & SSL/TLS

### 5.1 Custom Domain DNS Records
Point your domain registrar to the Vercel edge network:
- **Apex Domain (`battery-vital.org`)**: `A Record` pointing to `76.76.21.21`
- **Subdomain (`app.battery-vital.org`)**: `CNAME Record` pointing to `cname.vercel-dns.com`

### 5.2 Automatic Certificate Management
- Both Vercel and Render automatically provision and renew **Let's Encrypt Wildcard SSL/TLS certificates** via automated ACME DNS/HTTP-01 challenges.
- All HTTP requests are permanently redirected to HTTPS with HSTS preloaded.

---

## 6. Rollback & Incident Recovery

### 6.1 Instant Rollback Procedure
1. Navigate to the **Vercel Project Dashboard** -> **Deployments**.
2. Identify the previous stable production deployment hash.
3. Click the `...` menu and select **Instant Rollback**.
4. The edge CDN will switch 100% of incoming global traffic to the previous build within **<500 milliseconds**.

### 6.2 Database Backward Compatibility Rule
- Database schema changes must always be **additive**.
- Do not drop fields from MongoDB or Firebase RTDB schemas in the same release that updates consuming code. Support $N-1$ version compatibility.
