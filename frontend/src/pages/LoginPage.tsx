import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signIn } from 'aws-amplify/auth';
import { useAuth } from '../auth/AuthContext';

export function LoginPage() {
  const navigate = useNavigate();
  const { refreshSession } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn({ username: email, password });
      await refreshSession();
      navigate('/home', { replace: true });
    } catch (err: unknown) {
      const e = err as { name?: string };
      if (e.name === 'NotAuthorizedException' || e.name === 'UserNotFoundException') {
        setError('Email or password is incorrect.');
      } else if (e.name === 'UserNotConfirmedException') {
        setError('Please verify your email first.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-classhi-bg dark:bg-dark-bg">
      <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-8 dark:border-dark-border dark:bg-dark-card">
        <img src="/logo.png" alt="Classhi" className="h-10 mb-4" />
        <h1 className="text-2xl font-condensed font-bold tracking-tight leading-tight text-[#111111] dark:text-white">
          Welcome back
        </h1>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-semibold text-[#111111] dark:text-white"
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="abc123@pitt.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-base text-[#111111] placeholder:text-gray-500 outline-2 focus:outline-classhi-green dark:border-dark-border dark:bg-[#1e1e20] dark:text-white dark:placeholder:text-[#8A8A90] dark:focus:border-classhi-green"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-semibold text-[#111111] dark:text-white"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-base text-[#111111] placeholder:text-gray-500 outline-2 focus:outline-classhi-green dark:border-dark-border dark:bg-[#1e1e20] dark:text-white dark:placeholder:text-[#8A8A90] dark:focus:border-classhi-green"
            />
          </div>

          {error && (
            <p className="mt-2 text-sm text-classhi-coral" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            aria-disabled={loading}
            className="mt-2 w-full rounded-lg bg-classhi-green px-4 py-3 text-base font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Log in'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-500 dark:text-[#8A8A90]">
          New here?{' '}
          <Link
            to="/signup"
            className="font-semibold text-classhi-green hover:underline"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
