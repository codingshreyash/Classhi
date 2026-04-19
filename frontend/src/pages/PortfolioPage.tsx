import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/api';

interface Position {
  marketId: string;
  marketTitle: string | null;
  marketStatus: string | null;
  side: 'YES' | 'NO';
  shares: number;
  costBasis: number;
  currentPrice: number | null;
  unrealizedPnl: number | null;
  createdAt: string;
}

export function PortfolioPage() {
  const navigate = useNavigate();
  const { email, balance, idToken, signOut } = useAuth();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchPositions() {
      try {
        const res = await apiFetch('/me/positions', idToken);
        if (!res.ok) throw new Error('non-ok response');
        const data = (await res.json()) as { positions: Position[] };
        if (!cancelled) setPositions(data.positions ?? []);
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchPositions();
    return () => {
      cancelled = true;
    };
  }, [idToken]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  function pnlColor(v: number | null): string {
    if (v == null || v === 0) return 'text-gray-500';
    return v > 0 ? 'text-classhi-green' : 'text-classhi-coral';
  }
  function pnlText(v: number | null): string {
    if (v == null) return '—';
    if (v === 0) return '$0.00';
    const sign = v > 0 ? '+' : '-';
    return `${sign}$${Math.abs(v).toFixed(2)}`;
  }

  return (
    <div className="min-h-screen bg-classhi-bg">
      <nav className="border-b border-gray-200 bg-white px-6 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <span
            className="cursor-pointer text-lg font-semibold text-[#111111]"
            onClick={() => navigate('/markets')}
          >
            Classhi
          </span>
          <div className="flex items-center gap-4">
            {email && (
              <span className="text-sm text-gray-500">
                {email}
                {balance !== null && (
                  <span className="ml-2 font-semibold text-[#111111]">
                    — ${balance.toLocaleString()}
                  </span>
                )}
              </span>
            )}
            <button
              type="button"
              onClick={() => navigate('/markets')}
              className="text-sm font-semibold text-[#111111] hover:underline"
            >
              Markets
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="text-sm font-semibold text-classhi-coral hover:underline"
            >
              Log out
            </button>
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-4xl px-6 py-8">
        <h1 className="text-2xl font-semibold text-[#111111]">Portfolio</h1>

        <section className="mt-6 rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-sm text-gray-500">Current Balance</p>
          <p className="mt-1 text-3xl font-semibold text-[#111111]">
            ${balance != null ? balance.toLocaleString() : '—'}
          </p>
        </section>

        <h2 className="mt-8 text-xl font-semibold text-[#111111]">Open Positions</h2>

        {loading && (
          <p className="mt-4 text-center text-sm text-gray-500">Loading portfolio...</p>
        )}

        {!loading && error && (
          <p className="mt-4 text-center text-sm text-classhi-coral">
            Failed to load portfolio. Please try again.
          </p>
        )}

        {!loading && !error && positions.length === 0 && (
          <div className="mt-4 py-8 text-center">
            <p className="text-sm text-gray-500">No open positions yet.</p>
            <p className="mt-1 text-sm text-gray-500">
              Place a bet on a market to get started.
            </p>
          </div>
        )}

        {!loading && !error && positions.length > 0 && (
          <div className="mt-4 flex flex-col gap-3">
            {positions.map((p) => (
              <div
                key={p.marketId}
                className="rounded-lg border border-gray-200 bg-white p-4"
              >
                <div className="flex items-start justify-between">
                  <span className="flex-1 text-sm font-semibold text-[#111111]">
                    {p.marketTitle ?? p.marketId}
                  </span>
                  <span
                    className={`ml-2 rounded px-2 py-0.5 text-xs font-semibold text-white ${
                      p.side === 'YES' ? 'bg-classhi-green' : 'bg-classhi-coral'
                    }`}
                  >
                    {p.side}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-4 text-sm text-gray-500">
                  <span>Shares: {p.shares.toFixed(2)}</span>
                  <span>
                    Current price: {p.currentPrice != null ? `${p.currentPrice}¢` : '—'}
                  </span>
                  <span className={pnlColor(p.unrealizedPnl)}>
                    Unrealized P&L: {pnlText(p.unrealizedPnl)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
