# JanSeva — Civic Issue Management Platform

A production-grade civic issue management platform built with the MERN stack, featuring geo-spatial deduplication, SLA-based escalation, crowd-validated severity, and public accountability workflows.

## Resume Pitch

> Designed a civic issue management platform with geo-spatial deduplication, SLA-based escalation, and public accountability workflows, reducing duplicate reports and improving authority response transparency.

## Features

### Core System
- Geo-tagged issue creation (GPS + manual map pin)
- Media evidence upload (photos/videos with privacy blur)
- Issue categorization with subtypes
- Severity + urgency scoring
- Duplicate detection (location + text + image similarity)

### Differentiators
- **Smart Deduplication** — Merges similar reports into clusters; shows "already reported by X users"
- **Crowd-Validated Severity** — Community upvotes/downvotes with credibility-weighted votes
- **Intelligent Routing** — Multi-department authority mapping with SLA timers and auto-escalation

### Accountability & Transparency
- Public issue lifecycle (Created → Acknowledged → In Progress → Resolved → Verified)
- Time spent in each stage with responsible department
- Resolution verification by citizens (auto-reopen if majority rejects)

### Anti-Abuse & Trust
- Reputation engine for citizens and authorities
- Rate limiting, shadow banning, anomaly detection

### Data & Intelligence
- Civic analytics dashboard with heatmaps
- Seasonal pattern analysis
- Department bottleneck detection
- Rule-based predictive insights

### Accessibility
- Offline issue capture with auto-sync
- Multi-language UI (English + Hindi)
- PWA support via service worker

### Open API
- Public issue feed (`GET /api/issues/feed`)
- Data export (`GET /api/analytics/export?format=csv|json`)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, React Router, Leaflet, Recharts |
| Backend | Node.js, Express.js |
| Database | MongoDB with 2dsphere geospatial indexes |
| Auth | JWT |
| Media | Multer + Sharp (privacy blur) |

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB running locally (or MongoDB Atlas URI)

### Installation

```bash
# Install all dependencies
npm run install:all

# Copy environment config
cp backend/.env.example backend/.env

# Seed database with sample data
npm run seed

# Start development servers (API :5000, Frontend :5173)
npm run dev
```

### Demo Accounts

| Role | Email | Password |
|------|-------|----------|
| Citizen | citizen@example.com | password123 |
| Authority | officer@janseva.gov | password123 |
| Admin | admin@janseva.gov | password123 |

## Production staff accounts

Public registration creates **citizen** accounts only. Create staff accounts from your deployment shell after setting the same `MONGODB_URI` used by the application. These commands create or update only the requested account; they never delete data.

```bash
ADMIN_NAME="JanSeva Admin" ADMIN_EMAIL="admin@yourdomain.gov" ADMIN_PASSWORD="use-a-strong-password" npm run create:admin
```

```bash
OFFICER_NAME="Municipal Officer" OFFICER_EMAIL="officer@yourdomain.gov" OFFICER_PASSWORD="use-a-strong-password" AUTHORITY_NAME="Municipal Corporation" AUTHORITY_CODE="MUNICIPAL" AUTHORITY_DEPARTMENT="Municipal" AUTHORITY_ISSUE_TYPES="roads,water,sanitation,environment,other" AUTHORITY_SLA_HOURS=72 npm run create:authority
```

Do not run `npm run seed` in production: it removes existing users, authorities, and issues before creating demo records.

## API Endpoints

### Auth
- `POST /api/auth/register` — Register citizen/authority
- `POST /api/auth/login` — Login
- `GET /api/auth/me` — Current user profile

### Issues
- `GET /api/issues` — List issues (filter by status, category, geo radius)
- `GET /api/issues/:id` — Issue detail with lifecycle timeline
- `POST /api/issues` — Create issue (with media upload)
- `POST /api/issues/:id/vote` — Upvote/downvote severity
- `POST /api/issues/:id/verify` — Verify resolution
- `PATCH /api/issues/:id/status` — Update status (authority only)
- `GET /api/issues/feed` — Public transparency feed
- `POST /api/issues/sync` — Sync offline reports

### Analytics
- `GET /api/analytics/dashboard` — Admin dashboard stats
- `GET /api/analytics/heatmap` — Geo heatmap data
- `GET /api/analytics/chronic-zones` — Recurring problem zones
- `GET /api/analytics/export` — CSV/JSON data export

## Architecture

```
janseva/
├── backend/
│   ├── models/          # User, Issue, Authority, IssueCluster, AuditLog
│   ├── services/        # Deduplication, Routing, Reputation, Analytics
│   ├── controllers/     # Request handlers
│   ├── routes/          # API routes
│   ├── middleware/      # Auth, rate limiting, file upload
│   └── scripts/seed.js  # Database seeder
├── frontend/
│   └── src/
│       ├── components/  # Map, IssueCard, LifecycleTimeline, Navbar
│       ├── pages/       # Home, Issues, Report, Dashboard, Auth
│       ├── context/     # Auth + i18n + offline queue
│       └── services/    # API client
└── package.json         # Root scripts
```

## Key Algorithms

**Duplicate Detection Score:**
```
score = (locationScore × 0.4) + (textSimilarity × 0.4) + (imageHashSimilarity × 0.2)
threshold = 0.6 within 100m radius
```

**Crowd Severity:**
```
computed = userSeverity × 0.3 + crowdRatio × 0.5 + timeEscalation + 1
voteWeight = reputationLevel (new: 0.5, trusted: 1, verified: 1.5, champion: 2)
```

**SLA Escalation:**
- Auto-check every hour for breached SLA deadlines
- Escalates to parent authority in the hierarchy

## License

MIT
