import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { apiFetch } from '../lib/api';

interface Market {
  marketId: string;
  title: string;
  description: string;
  status: 'scheduled' | 'open' | 'closed' | 'resolved';
  yesPrice: number;
  noPrice: number;
  volume: number;
  openAt: string;
  closeAt: string;
  createdAt: string;
  createdBy: string;
}

function formatDetailed(closeAt: string): string {
  const diff = new Date(closeAt).getTime() - Date.now();
  if (diff <= 0) return 'Closed';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const parts: string[] = [];
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

function StatusBadge({ status }: { status: Market['status'] }) {
  const isOpen = status === 'open';
  return (
    <span
      className={`inline-block rounded px-3 py-1 text-sm font-semibold uppercase ${
        isOpen ? 'bg-classhi-green text-white' : 'bg-gray-200 text-gray-700'
      }`}
    >
      {status}
    </span>
  );
}

type Side = 'YES' | 'NO' | null;

export function MarketDetailPage() {
  const { marketId } = useParams<{ marketId: string }>();
  const navigate = useNavigate();
  const { idToken, balance, refreshSession } = useAuth();
  const [market, setMarket] = useState<Market | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');

  const [side, setSide] = useState<Side>(null);
  const [amountText, setAmountText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchMarket() {
      try {
        const res = await apiFetch(`/markets/${marketId}`, idToken);
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error('non-ok response');
        const data = (await res.json()) as { market: Market };
        if (!cancelled) {
          setMarket(data.market);
          setTimeLeft(formatDetailed(data.market.closeAt));
        }
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchMarket();
    return () => {
      cancelled = true;
    };
  }, [marketId, idToken]);

  useEffect(() => {
    if (!market) return;
    if (market.status !== 'open' && market.status !== 'scheduled') return;
    const interval = setInterval(() => {
      setTimeLeft(formatDetailed(market.closeAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [market]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-classhi-bg">
        <p className="text-gray-500">Loading market...</p>
      </div>
    );
  }
  if (notFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-classhi-bg">
        <p className="text-gray-500">Market not found.</p>
      </div>
    );
  }
  if (error || !market) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-classhi-bg">
        <p className="text-classhi-coral">Failed to load market.</p>
      </div>
    );
  }

  const showCountdown = market.status === 'open' || market.status === 'scheduled';
  const amountNum = Number(amountText);
  const amountValid = Number.isFinite(amountNum) && amountNum > 0;
  const sidePrice = side === 'YES' ? market.yesPrice : side === 'NO' ? market.noPrice : null;
  const estimatedShares =
    side && amountValid && sidePrice && sidePrice > 0
      ? Math.round((amountNum / (sidePrice / 100)) * 100) / 100
      : null;
  const estimatedPayout = estimatedShares != null ? estimatedShares * 1.0 : null;
  const exceedsBalance = amountValid && balance != null && amountNum > balance;
  const ctaEnabled = side != null && amountValid && !exceedsBalance && !submitting;
  const isMarketOpen = market.status === 'open';

  async function handleSubmit() {
    if (!ctaEnabled || side == null || !marketId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await apiFetch(`/markets/${marketId}/bets`, idToken, {
        method: 'POST',
        body: JSON.stringify({ side, amount: amountNum }),
      });
      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { error?: string };
        setSubmitError(errData.error ?? 'Failed to place bet. Please try again.');
        return;
      }
      const data = (await res.json()) as {
        yesPrice: number;
        noPrice: number;
        newBalance: number | null;
      };
      setMarket({ ...(market as Market), yesPrice: data.yesPrice, noPrice: data.noPrice });
      setSide(null);
      setAmountText('');
      await refreshSession();
    } catch {
      setSubmitError('Failed to place bet. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const ctaLabel = submitting
    ? 'Placing bet...'
    : side == null
    ? 'Place a bet'
    : amountValid
    ? `Bet ${side} — $${amountNum}`
    : `Bet ${side}`;
  const ctaBg =
    side === 'YES'
      ? 'bg-classhi-green'
      : side === 'NO'
      ? 'bg-classhi-coral'
      : 'bg-gray-300';

  return (
    <div className="min-h-screen bg-classhi-bg">
      <main className="mx-auto max-w-2xl px-6 py-8">
        <button
          type="button"
          onClick={() => navigate('/markets')}
          className="mb-6 text-sm text-gray-500 hover:text-[#111111]"
        >
          ← Markets
        </button>

        <div className="mb-4">
          <StatusBadge status={market.status} />
        </div>

        <h1 className="text-2xl font-semibold text-[#111111]">{market.title}</h1>

        {market.description && (
          <p className="mt-2 text-base text-gray-500">{market.description}</p>
        )}

        <div className="mt-6 flex items-center gap-4">
          <span className="rounded px-6 py-3 text-lg font-semibold bg-classhi-green text-white">
            YES {market.yesPrice}¢
          </span>
          <span className="rounded px-6 py-3 text-lg font-semibold bg-classhi-coral text-white">
            NO {market.noPrice}¢
          </span>
        </div>

        {showCountdown && (
          <p className="mt-4 text-sm text-gray-500">Closes in {timeLeft}</p>
        )}

        {isMarketOpen ? (
          <section className="mt-6 rounded-lg border border-gray-200 bg-white p-5">
            <h2 className="text-xl font-semibold text-[#111111]">Place a bet</h2>

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={() => setSide('YES')}
                className={`h-11 flex-1 rounded text-sm font-semibold transition-colors ${
                  side === 'YES'
                    ? 'bg-classhi-green text-white'
                    : 'border border-gray-200 bg-white text-[#111111] hover:border-gray-300'
                }`}
              >
                YES
              </button>
              <button
                type="button"
                onClick={() => setSide('NO')}
                className={`h-11 flex-1 rounded text-sm font-semibold transition-colors ${
                  side === 'NO'
                    ? 'bg-classhi-coral text-white'
                    : 'border border-gray-200 bg-white text-[#111111] hover:border-gray-300'
                }`}
              >
                NO
              </button>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-semibold text-[#111111]">Amount</label>
              <input
                type="number"
                min={1}
                step={1}
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                placeholder="$"
                className="mt-1 w-full rounded border border-gray-200 px-3 py-2 text-sm text-[#111111] outline-none focus:border-classhi-green"
              />
              {balance != null && (
                <p className="mt-1 text-xs text-gray-500">
                  Balance: ${balance.toLocaleString()}
                </p>
              )}
            </div>

            {exceedsBalance && balance != null ? (
              <p className="mt-4 text-sm text-classhi-coral">
                Insufficient balance. Your balance is ${balance.toLocaleString()}.
              </p>
            ) : estimatedShares != null && estimatedPayout != null ? (
              <div className="mt-4 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Estimated shares</span>
                  <span className="text-sm font-semibold text-[#111111]">
                    {estimatedShares.toFixed(2)} shares
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-500">Estimated payout</span>
                  <span className="text-sm font-semibold text-classhi-green">
                    ${estimatedPayout.toFixed(2)}
                  </span>
                </div>
              </div>
            ) : null}

            {submitError && (
              <p className="mt-3 text-sm text-classhi-coral">{submitError}</p>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!ctaEnabled}
              className={`mt-4 w-full rounded py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 ${ctaBg}`}
            >
              {ctaLabel}
            </button>
          </section>
        ) : (
          <p className="mt-6 text-sm text-gray-500">Betting is closed for this market.</p>
        )}
      </main>
    </div>
  );
}
