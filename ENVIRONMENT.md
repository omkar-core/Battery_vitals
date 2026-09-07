# Battery Vital — Environment Variables & Secrets Guide (ENVIRONMENT.md)

## 1. Environment Architecture & Security Classification

Battery Vital enforces a strict security boundary between client-facing browser variables and confidential server-side secrets:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Environment Variable Tiers                        │
│                                                                             │
│   [Client-Side Tier (NEXT_PUBLIC_*)]                                        │
│   • Exposed in browser JavaScript bundles                                   │
│   • Must contain ZERO sensitive private keys                                │
│   • Examples: Database URLs, Project IDs, Public Auth Keys                  │
│                                                                             │
│   [Server-Side Tier (CONFIDENTIAL)]                                         │
│   • Isolated exclusively in Node.js serverless runtimes                     │
│   • Stripped completely from client compilation                             │
│   • Examples: GEMINI_API_KEY, FIREBASE_ADMIN_PRIVATE_KEY, MONGODB_URI       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Complete Environment Variable Inventory

| Variable Name | Exposure | Required In | Default / Example | Purpose / Description |
|---|---|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Public | All | `AIzaSy...` | Firebase Web Client initialization |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Public | All | `battery-vital.firebaseapp.com` | OAuth authentication redirect domain |
| `NEXT_PUBLIC_FIREBASE_DATABASE_URL` | Public | All | `https://...firebaseio.com` | Realtime Database WebSocket endpoint |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Public | All | `battery-vital` | Google Cloud project identifier |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Public | All | `battery-vital.appspot.com` | Storage bucket for report exports |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Public | All | `123456789012` | Web Push notification messaging ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Public | All | `1:123456:web:abcdef` | Firebase client application ID |
| `FIREBASE_ADMIN_PROJECT_ID` | **Server** | Server | `battery-vital` | Firebase Admin SDK project context |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | **Server** | Server | `firebase-adminsdk@...` | Service account service principal |
| `FIREBASE_ADMIN_PRIVATE_KEY` | **Server** | Server | `"-----BEGIN RSA..."` | Service account RSA private key |
| `MONGODB_URI` | **Server** | Server | `mongodb+srv://...` | MongoDB Atlas cluster connection string |
| `GEMINI_API_KEY` | **Server** | Server | `AIzaSy...` | Google Generative Language API key |
| `GEMINI_MODEL` | **Server** | Server | `gemini-1.5-flash` | Selected Gemini model (`flash` or `pro`) |
| `NEXT_PUBLIC_APP_URL` | Public | All | `https://battery-vital.com` | Canonical web application origin URL |
| `NODE_ENV` | System | All | `production` / `development` | Node.js execution environment |

---

## 3. Environment Profiles & Configuration

### 3.1 Local Development (`.env.local`)
- Located in project root; strictly excluded from Git via `.gitignore`.
- Used when running `npm run dev`.
- Example template is maintained in [`.env.example`](file:///d:/Webapp/Working_webapps/Battery_vitals/.env.example).

### 3.2 Production Deployment (Vercel & Render)
- Secrets are entered via the **Vercel Project Dashboard** -> **Settings** -> **Environment Variables** or the **Render Dashboard**.
- Never commit `.env.production` or production credentials into Git history.

---

## 4. Key Formatting & Private Key Sanitation

### 4.1 Firebase RSA Private Key Escaping
When passing `FIREBASE_ADMIN_PRIVATE_KEY` in cloud dashboards or `.env` files, newlines must be formatted properly:
```bash
# In .env.local:
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7...\n-----END PRIVATE KEY-----\n"
```
In serverless code ([`src/lib/firebaseAdmin.js`](file:///d:/Webapp/Working_webapps/Battery_vitals/src/lib/firebaseAdmin.js)), normalize string escapes:
```javascript
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
```

---

## 5. Secret Rotation & Audit Checklist

1. **Rotation Frequency**: Rotate MongoDB passwords and Gemini API keys every **90 days**.
2. **Revocation**: Immediately delete compromised service account keys from the Google Cloud Console.
3. **Audit Verification**:
   ```bash
   # Verify that no tracked files contain leaked secret keys:
   git grep -i "AIzaSy"
   git grep -i "BEGIN PRIVATE KEY"
   ```
