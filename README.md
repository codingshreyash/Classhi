<p align="center">
  <img src="https://raw.githubusercontent.com/codingshreyash/Classhi/main/frontend/public/logo.png" width="220" alt="Classhi" />
</p>

> Kalshi-style prediction markets for CS lectures.

**Course:** CS 1660 Cloud Computing — Final Project
**Live URL:** https://d1vrs4hix1vyxh.cloudfront.net
**Presentation:** [AWS Services Overview](https://docs.google.com/presentation/d/1JhoBstbPhS3i7MwVkMsvE7GQdVNB1bqFRj1HIeuMLro/edit?usp=sharing)

---

## Overview

Classhi is a lightweight prediction market platform. Students sign up, receive $1000 play-money, and place YES/NO bets on markets created by Dan ("Will Dan say 'AWS' more than 10 times today?"). Bets shift a constant-sum price model; WebSocket pushes drive sub-3-second price updates across all browsers. Markets auto-transition from `scheduled → open → closed` via EventBridge Scheduler; Dan resolves closed markets, triggering atomic payouts to winning position holders.

The stack is 100% serverless — no EC2, no containers, no VPC. The entire infrastructure is declared in a single `template.yaml` and deploys from a clean clone via `sam build && sam deploy`. A GitHub Actions pipeline auto-deploys both backend and frontend on push to main, authenticated via OIDC (no long-lived AWS keys).

---

## Demo Accounts

All accounts use password: **`Classhi1!`**

| Email             | Role                                |
| ----------------- | ------------------------------------|
| `dpm79@pitt.edu`  | Admin (can create + resolve markets)|
| `shr172@pitt.edu` | Student                             |
| `krk131@pitt.edu` | Student                             |
| `aqm12@pitt.edu`  | Student                             |
| `hnh21@pitt.edu`  | Student                             |
| `akk97@pitt.edu`  | Student                             |

---

## Why Classhi is fun

CS 1660 lectures are good but it's easy to zone out (only because lecture is 6:00-8:00, dw Dan, you're the 🐐). The idea behind Classhi is that if you have $10 of play money riding on whether Dan says "serverless" more than 5 times, you're suddenly paying close attention for the rest of the hour.

Once you've placed a bet, you're not passively listening — you're actively tracking. And when you open the market page and see the YES price jump from 50¢ to 70¢ in the first 10 minutes, that's everyone else in the room updating their view at the same time.

The leaderboard is a small thing but it works. Seeing that you're $260 behind your friend is enough to make you care a bit more next class. Markets settle after Dan resolves them, so there's always something to check after lecture.

There's also a feedback loop for Dan: if "Will a student ask what S3 stands for?" is sitting at 80¢, the class is basically saying that without anyone having to raise their hand.

---

## Architecture

```mermaid
flowchart LR
  subgraph Browser
    UI[React SPA]
  end

  subgraph Edge
    CF[CloudFront Distribution]
    S3[(S3 Private Bucket<br/>OAC)]
  end

  subgraph Auth
    CG[Cognito User Pool]
  end

  subgraph API
    HTTP[API Gateway<br/>HTTP API + JWT]
    WS[API Gateway<br/>WebSocket API]
  end

  subgraph Compute
    L1[Lambda: Markets / Bets / Positions / Leaderboard]
    L2[Lambda: WS Connect / Disconnect / Authorizer]
    L3[Lambda: WS Broadcast<br/>DDB Streams consumer]
    L4[Lambda: Post-Confirmation]
    L5[Lambda: Scheduler Handler]
  end

  subgraph Data
    UT[(DynamoDB<br/>UsersTable)]
    MT[(DynamoDB<br/>MarketsTable + Streams)]
    PT[(DynamoDB<br/>PositionsTable + byMarket GSI)]
    CT[(DynamoDB<br/>ConnectionsTable + byMarket GSI)]
  end

  subgraph Scheduling
    EBS[EventBridge Scheduler<br/>per-market schedules]
  end

  UI -->|HTTPS| CF
  CF -->|OAC sigv4| S3
  UI -->|Amplify sign-in| CG
  UI -->|JWT Bearer| HTTP
  UI -->|wss + token query| WS

  HTTP --> L1
  WS --> L2
  L1 --> UT
  L1 --> MT
  L1 --> PT
  L1 -->|CreateSchedule| EBS
  EBS -->|at open/close time| L5
  L5 --> MT

  MT -->|Stream TRIM_HORIZON| L3
  L3 --> CT
  L3 -->|PostToConnection| WS
  WS --> UI

  L4 -->|balance=$1000| UT
  CG -->|PostConfirmation trigger| L4
```

### ASCII fallback

```
                    +-----------------------------+
Browser (React SPA) |  https://<cf>.cloudfront.net|
   |                +--------------+--------------+
   |                               |
   |  Amplify/Cognito JWT          |  OAC sigv4
   |                               v
   v                        +------+-------+
+--+-----+                  |     S3       |  private bucket, no public ACL
|Cognito |                  +--------------+
|  Pool  |
+--+-----+     HTTP API (JWT)              WebSocket API (Lambda authorizer)
   |  +----------+-----------+               +-------+-------+
   |  | /markets /me /bets   |               | $connect      |
   |  | /leaderboard /resolve|               | $disconnect   |
   |  +-----+----------+-----+               +-------+-------+
   |        |          |                             |
   v        v          v                             v
  +-------+ +----------+---+          +--------------+------+
  | Lambdas| | Market/Bet  |          | WS Authorizer / Conn|
  +-------++-+-------------+          +--+---------------+--+
          |                              |               |
          v                              v               v
  +-------+-----+   Stream    +----------+---+     +----+----------+
  | DynamoDB    +-----------> | WS Broadcast |     |ConnectionsTable|
  | (4 tables)  |             | Lambda       |     +---+-----------+
  +-------+-----+             +--------+-----+         |
          |                            |               |
          |  CreateSchedule            | PostToConn    |
          v                            v               |
  +-------+----------+     +-----------+-------+       |
  | EventBridge      |     | API GW Mgmt API   <-------+
  | Scheduler        |     | (push frames)     |
  +--+---------------+     +-------------------+
     |
     |  at open/close time
     v
  +--+---------------+
  | Scheduler Lambda |
  +------------------+
```

---

## Services & Justification

| #   | Service                                           | Purpose                                                                                                             | Why it's the right fit                                                                                                                                                                                               | Presenter |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 1   | **Amazon Cognito** (User Pool + PostConfirmation) | Email/password sign-up, login, JWT issuance, $1000 balance provisioning                                             | Managed auth — no credential handling, no password hashing code. PostConfirmation trigger hooks the first-login balance seed cleanly.                                                                                | Shreyash  |
| 2   | **API Gateway HTTP API**                          | REST routes (`/markets`, `/me`, `/leaderboard`, `/markets/{id}/bets`, `/markets/{id}/resolve`)                      | Native JWT authorizer validates Cognito tokens without a custom Lambda — lower latency + cost than REST API.                                                                                                         | Shreyash  |
| 3   | **API Gateway WebSocket API**                     | Real-time price updates pushed to subscribed clients                                                                | Managed WebSocket with stable connection IDs; Lambda authorizer handles JWT via query-string (browsers can't set WS headers).                                                                                        | Akash     |
| 4   | **AWS Lambda** (15 functions, ARM64 Node.js 20)   | All business logic: market CRUD, bet placement, payout fan-out, WebSocket handlers, scheduler callback, leaderboard | Per-route isolation; pay-per-invoke; ARM64 saves ~20% vs. x86. Zero ops burden.                                                                                                                                      | Akash     |
| 5   | **Amazon DynamoDB** (4 tables)                    | Primary data store: users, markets, positions, websocket connections                                                | Single-digit-ms reads, serverless, on-demand billing, atomic `TransactWriteItems` for lost-update-free bet placement.                                                                                                | Aidan     |
| 6   | **DynamoDB Streams** (MarketsTable)               | Event source for WebSocket price broadcast                                                                          | Decouples price updates from the bet-placement write path — the broadcaster reads the stream and fans out updates without blocking user requests. `TRIM_HORIZON` + `ReportBatchItemFailures` prevent dropped events. | Aidan     |
| 7   | **Amazon EventBridge Scheduler**                  | Per-market one-time schedules for `scheduled → open` and `open → closed` transitions                                | `ScheduleV2` supports timezones + automatic deletion (`ActionAfterCompletion: DELETE`) — unlike classic EventBridge Rules which are UTC-only. Replaces cron polling entirely.                                        | Krishna   |
| 8   | **Amazon S3** (private, OAC)                      | Host Vite-built frontend static assets                                                                              | Cheap, durable, scales to grading traffic. Public access fully blocked; only CloudFront OAC can read objects.                                                                                                        | Krishna   |
| 9   | **Amazon CloudFront** (+ OAC)                     | HTTPS edge delivery of the SPA; SPA routing fallback                                                                | HTTPS required; OAC is the current replacement for deprecated OAI; CustomErrorResponses map both 403 and 404 → `/index.html` so React Router sub-routes (`/leaderboard`, `/markets/:id`) work on direct navigation.  | Haiden    |

**Deliberate exclusions** (not part of the 9): SNS, SQS, VPC, CloudWatch alarms, X-Ray. Real-time fan-out is handled by DynamoDB Streams + WebSocket — SNS/SQS would be redundant. No networking is needed for fully-managed services; no VPC required.

---

## Project Structure

```
.
├── backend/                           # pnpm workspace: classhi-backend
│   └── src/handlers/                  # 15 Lambda handlers, 1 directory each
│       ├── create-market/
│       ├── get-leaderboard/
│       ├── get-market/
│       ├── get-me/
│       ├── get-positions/
│       ├── health/
│       ├── list-markets/
│       ├── place-bet/
│       ├── post-confirmation/
│       ├── resolve-market/
│       ├── scheduler-handler/
│       ├── ws-authorizer/
│       ├── ws-broadcast/
│       ├── ws-connect/
│       └── ws-disconnect/
├── frontend/                          # pnpm workspace: classhi-frontend
│   └── src/
│       ├── App.tsx                    # React Router + RequireAuth
│       ├── auth/                      # AuthContext + Amplify glue
│       ├── lib/api.ts                 # apiFetch wrapper
│       ├── pages/                     # LoginPage, MarketListPage, LeaderboardPage, ...
│       └── hooks/                     # useMarketWS (WebSocket)
├── .github/workflows/deploy.yml       # OIDC CI/CD (backend + frontend)
├── template.yaml                      # All AWS infra (SAM)
├── samconfig.toml                     # Deploy config (stack=classhi, region=us-east-1)
└── pnpm-workspace.yaml
```

---

## Quick Start

### Prerequisites

- Node.js 22+, pnpm 10, AWS CLI v2, AWS SAM CLI 1.158+
- AWS account with administrator access (demo project)
- `esbuild` on PATH (globally installed — SAM requires this at the system level)

### Deploy from a fresh clone

```bash
pnpm install --frozen-lockfile
sam build
sam deploy --guided              # first time only — fills in samconfig.toml
# or, on subsequent deploys:
sam deploy --no-confirm-changeset --no-fail-on-empty-changeset
```

After deploy, capture the output values:

```bash
aws cloudformation describe-stacks --stack-name classhi --region us-east-1 \
  --query "Stacks[0].Outputs" --output table
```

### Run the frontend locally

```bash
cd frontend
cp .env.example .env.local   # populate with stack outputs: UserPoolId, UserPoolClientId, HttpApiUrl, WebSocketApiUrl
pnpm run dev                 # http://localhost:5173
```

### CI/CD

Push to `main` triggers `.github/workflows/deploy.yml`:

1. `deploy-backend` runs `sam deploy` (OIDC; no long-lived keys).
2. `deploy-frontend` runs `pnpm run build` in `frontend/`, syncs `dist/` to S3, and invalidates CloudFront (`/*`).

- IAM OIDC provider for `token.actions.githubusercontent.com`
- IAM role `classhi-github-deploy` with trust scoped to this repo
- Four GitHub repo secrets: `VITE_USER_POOL_ID`, `VITE_USER_POOL_CLIENT_ID`, `VITE_HTTP_API_URL`, `VITE_WS_API_URL`

---

## Key Design Decisions

- **Phantom liquidity seed** (`volume = 100` on market creation) prevents first-bet price collapse — without it, the first $10 YES bet moves the price 50→99 instead of 50→52.
- **`TransactWriteItems` + retry-on-conflict** makes bet placement atomic across the balance → volume → position update. `ClientRequestToken` (36-char truncation) prevents double-charges on Lambda retry.
- **WebSocket JWT via query string** — browsers can't set custom headers on `new WebSocket(url)`; the Cognito ID token rides as `?token=...` and is validated by a Lambda REQUEST authorizer.
- **DynamoDB Streams `TRIM_HORIZON` + `ReportBatchItemFailures`** — LATEST misses events during event-source-mapping creation; partial batch reporting prevents re-broadcasting all 10 updates when one connection has gone stale.
- **EventBridge Scheduler with `ActionAfterCompletion: DELETE`** — schedules vanish automatically after firing; no cron polling, no cleanup scripts.
- **CloudFront `CustomErrorResponses` for BOTH 403 AND 404** — S3 + OAC returns 403 (not 404) on missing paths; without mapping 403 → `/index.html`, SPA sub-routes get "Access Denied" on direct navigation.

---

## Feature Coverage

- **Auth**: Cognito + Amplify v6 + PostConfirmation → $1000 balance on sign-up
- **Markets / Betting**: constant-sum YES/NO pricing, atomic transactions
- **Real-time**: <3s WebSocket price updates, live price history chart
- **Portfolio**: open + settled positions with P&L
- **Leaderboard**: top 20 + own rank
- **Admin**: create + resolve markets, server-side gate
- **Scheduling**: EventBridge Scheduler auto-transitions (`scheduled → open → closed`)
- **Infra**: single `sam deploy`, HTTPS via CloudFront, OIDC CI/CD

---

## Future Work

- Swap constant-sum pricing for LMSR
- Real-time leaderboard updates via WebSocket (currently polled)
- Category tags + market filtering

---

## AI Usage Acknowledgement

Claude Code was used to generate application logic for this project

---

## License

Educational use only — CS 1660 Final Project.
