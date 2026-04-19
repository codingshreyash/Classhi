import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { NavBar } from '../components/NavBar';

function Node({ label, sub, accent }: { label: string; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border px-4 py-2.5 text-center min-w-[140px] ${
      accent
        ? 'border-classhi-green bg-classhi-green/10'
        : 'border-gray-200 bg-white dark:border-dark-border dark:bg-dark-card'
    }`}>
      <p className="text-sm font-semibold text-[#111111] dark:text-white leading-snug">{label}</p>
      {sub && <p className="text-xs text-gray-500 dark:text-[#8A8A90] mt-0.5">{sub}</p>}
    </div>
  );
}

function Down({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center">
      {label && <p className="text-[10px] text-gray-400 dark:text-[#8A8A90] mb-0.5">{label}</p>}
      <span className="text-classhi-green text-base leading-none">↓</span>
    </div>
  );
}

function Column({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-[#8A8A90] mb-1">{title}</p>
      {children}
    </div>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-classhi-bg dark:bg-dark-bg">
      <NavBar onSignOut={handleSignOut} />

      <main className="mx-auto max-w-6xl px-6 py-12">

        {/* Header */}
        <div className="mb-10">
          <p className="text-lg text-gray-600 dark:text-[#8A8A90]">
            A prediction market for CS 1660 — built for our final project.
          </p>
        </div>

        {/* Why section */}
        <section className="mb-14">
          <h2 className="text-xl font-condensed font-bold text-[#111111] dark:text-white mb-4">Why we built this</h2>
          <div className="space-y-4 text-[15px] leading-relaxed text-gray-700 dark:text-[#B0B0B8]">
            <p>
              The assignment was to use 9 AWS services and build something real. Our first idea
              was to build Battleship. But we wanted to build something people would actually open
              during class — so we made a prediction market for the lecture itself.
            </p>
            <p>
              The idea is simple: Dan or any student creates markets before class ("Will he say
              'serverless' more than 5 times?"), everyone bets play money, and the prices shift
              in real time as people update their views. When class ends, Dan resolves them and
              the leaderboard updates. It sounds silly but we hope it makes you pay more attention.
            </p>
            <p>
              On the technical side, the whole thing is serverless — no EC2, no containers. It uses
              Cognito for auth, API Gateway for REST + WebSocket, 15 Lambda functions, 4 DynamoDB
              tables with Streams for live price pushes, EventBridge Scheduler for auto-opening
              markets, and CloudFront + S3 for the frontend. Everything deploys from a single{' '}
              <code className="rounded bg-gray-100 px-1.5 py-0.5 text-sm font-mono text-classhi-green dark:bg-[#1a1a1f]">
                sam deploy
              </code>
              .
            </p>
          </div>
        </section>

        {/* Non-technical flowchart */}
        <section className="mb-14">
          <h2 className="text-xl font-condensed font-bold text-[#111111] dark:text-white mb-2">How a market works</h2>

          <div className="overflow-x-auto">
            <div className="flex gap-6 min-w-max items-start mx-auto">

              <Column title="Before class">
                <Node label="Market created" sub="e.g. Will Dan say 'serverless' 5+ times?" accent />
                <Down />
                <Node label="Market opens" sub="students can now place bets" />
                <Down />
                <Node label="You pick YES or NO" sub="and bet play money" />
                <Down />
                <Node label="Price shifts" sub="more YES bets → YES price rises" />
              </Column>

              <div className="flex items-center self-center pt-6">
                <span className="text-classhi-green text-2xl">→</span>
              </div>

              <Column title="During class">
                <Node label="Watch prices move" sub="everyone's bets update the odds live" />
                <Down />
                <Node label="Price reflects class consensus" sub="80¢ YES = class thinks it's likely" />
                <Down />
                <Node label="Market closes" sub="when class ends or timer runs out" />
              </Column>

              <div className="flex items-center self-center pt-6">
                <span className="text-classhi-green text-2xl">→</span>
              </div>

              <Column title="After class">
                <Node label="Dan resolves the market" sub="sets outcome to YES or NO" accent />
                <Down />
                <Node label="Winners get paid out" sub="proportional to shares held" />
                <Down />
                <Node label="Leaderboard updates" sub="top balances ranked" />
                <Down />
                <Node label="Next market opens" sub="do it again next lecture" />
              </Column>

            </div>
          </div>
        </section>

        {/* Technical flowchart */}
        <section className="mb-14">
          <h2 className="text-xl font-condensed font-bold text-[#111111] dark:text-white mb-2">How it works under the hood</h2>

          <div className="overflow-x-auto">
            <div className="flex gap-6 min-w-max items-start mx-auto">

              <Column title="Auth">
                <Node label="Sign Up / Log In" sub="aws-amplify v6" />
                <Down />
                <Node label="Cognito User Pool" sub="JWT issued" accent />
                <Down />
                <Node label="PostConfirmation λ" sub="$1000 balance seeded to DynamoDB" />
              </Column>

              <Column title="Betting">
                <Node label="Place Bet (React)" sub="JWT in Authorization header" />
                <Down label="HTTPS POST" />
                <Node label="API Gateway HTTP API" sub="native JWT authorizer" accent />
                <Down />
                <Node label="PlaceBet λ" sub="atomic TransactWriteItems" />
                <Down />
                <Node label="DynamoDB" sub="Users · Markets · Positions" />
              </Column>

              <Column title="Live Prices">
                <Node label="Bet written to MarketsTable" sub="yesPrice / noPrice updated" />
                <Down label="DynamoDB Stream" />
                <Node label="WS Broadcast λ" sub="TRIM_HORIZON consumer" accent />
                <Down label="PostToConnection" />
                <Node label="API Gateway WebSocket" sub="wss:// — token in query string" />
                <Down />
                <Node label="Browser price flash" sub="&lt; 3 seconds end-to-end" />
              </Column>

              <Column title="Scheduling">
                <Node label="Create Market λ" sub="any authenticated user" />
                <Down />
                <Node label="EventBridge Scheduler" sub="at(openAt) · at(closeAt)" accent />
                <Down />
                <Node label="Scheduler λ" sub="transitions market status" />
                <Down />
                <Node label="scheduled → open → closed" sub="fully automatic, no polling" />
              </Column>

              <Column title="Frontend">
                <Node label="Vite + React SPA" sub="pnpm build → dist/" />
                <Down />
                <Node label="S3 (private, OAC)" sub="no public access" accent />
                <Down />
                <Node label="CloudFront" sub="HTTPS edge + SPA fallback" />
                <Down />
                <Node label="GitHub Actions" sub="OIDC deploy on push to main" />
              </Column>

            </div>
          </div>
        </section>

        {/* Sign off */}
        <section className="border-t border-gray-200 dark:border-dark-border pt-8">
          <p className="text-sm text-gray-500 dark:text-[#8A8A90] mb-4">
            Built for CS 1660 Cloud Computing, Spring 2026.
          </p>
          <div className="flex flex-wrap gap-3">
            {[
              { name: 'Shreyash', url: 'https://www.linkedin.com/in/shreyash-ranjan/' },
              { name: 'Akash',    url: 'https://www.linkedin.com/in/akash-krishan/' },
              { name: 'Aidan',    url: 'https://www.linkedin.com/in/aidanqmchugh/' },
              { name: 'Haiden',   url: 'https://www.linkedin.com/in/haidenh/' },
              { name: 'Krishna',  url: 'https://www.linkedin.com/in/krishnakatakota/' },
            ].map(({ name, url }) => (
              <a
                key={name}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-sm font-semibold text-[#111111] hover:border-classhi-green hover:text-classhi-green transition-colors dark:border-dark-border dark:text-white dark:hover:border-classhi-green dark:hover:text-classhi-green"
              >
                <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                {name}
              </a>
            ))}
          </div>
        </section>

      </main>
    </div>
  );
}
