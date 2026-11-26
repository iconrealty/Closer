import React, { useState } from 'react';
import {
  Home,
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';
import { googleSignIn, GoogleSessionUser } from '../../lib/firebaseAuth';

export type AuthMode = 'in' | 'up';

interface CloserAuthPageProps {
  mode: AuthMode;
  onChangeMode: (mode: AuthMode) => void;
  onBackToLanding: () => void;
  onAuthenticated: (googleUser?: GoogleSessionUser) => void;
}

const PROFILE_STORAGE_KEY = 'closer_user_profile';

export const CloserAuthPage: React.FC<CloserAuthPageProps> = ({
  mode,
  onChangeMode,
  onBackToLanding,
  onAuthenticated,
}) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState(() => {
    try {
      const saved = localStorage.getItem(PROFILE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.email || '';
      }
    } catch {
      // Ignore storage errors
    }
    return '';
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSignUp = mode === 'up';

  const handleGoogleLogin = async () => {
    setError(null);
    setIsGoogleLoading(true);
    try {
      const { user } = await googleSignIn();
      onAuthenticated({
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
      });
    } catch (err: unknown) {
      console.error('Google sign-in error:', err);
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: string }).code)
          : '';
      const host = typeof window !== 'undefined' ? window.location.hostname : '';

      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setError('Google sign-in window was closed before completing.');
      } else if (code === 'auth/popup-blocked') {
        setError('Pop-up was blocked by your browser. Please allow pop-ups for this site and try again.');
      } else if (code === 'auth/unauthorized-domain') {
        setError(
          `This domain (${host}) is not authorized for Google Sign-In. Add "${host}" in Firebase Console → Authentication → Settings → Authorized domains.`
        );
      } else if (code === 'auth/missing-config') {
        setError(
          'Google Sign-In is not configured for this deployment yet. Add the VITE_FIREBASE_* environment variables in your hosting settings.'
        );
      } else if (code === 'auth/api-key-not-valid' || code === 'auth/invalid-api-key') {
        setError('The Firebase API key is invalid or was revoked. Update it in your environment variables or re-enable Google Sign-In.');
      } else if (code === 'auth/operation-not-allowed') {
        setError('Google Sign-In is not enabled in Firebase Authentication → Sign-in method.');
      } else {
        setError(
          code
            ? `Unable to sign in with Google (${code}). Please try again.`
            : 'Unable to sign in with Google right now. Please try again.'
        );
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isSignUp && !firstName.trim()) {
      setError('Please enter your first name to continue.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 4) {
      setError('Please enter a password (at least 4 characters).');
      return;
    }

    try {
      const fullName = isSignUp
        ? `${firstName.trim()} ${lastName.trim()}`.trim()
        : email.split('@')[0];
      localStorage.setItem(
        PROFILE_STORAGE_KEY,
        JSON.stringify({
          firstName: firstName.trim() || fullName,
          lastName: lastName.trim(),
          fullName,
          email: email.trim(),
        })
      );
    } catch {
      // Ignore storage errors
    }

    onAuthenticated();
  };

  return (
    <div className="auth-page">
      {/* Left Slate-Teal Brand & Quote Panel */}
      <aside className="auth-side">
        <a
          href="#landing"
          onClick={(e) => {
            e.preventDefault();
            onBackToLanding();
          }}
          className="closer-brand"
        >
          <span className="closer-brand-mark">
            <Home size={20} />
          </span>
          <span>
            closer<span className="closer-brand-dot">.</span>
          </span>
        </a>

        <div className="auth-quote">
          <div className="section-kicker">WELCOME TO A MORE HUMAN CRM</div>
          <h1>
            Every move
            <br />
            has a <em>why.</em>
          </h1>
          <p>Keep the story close. The next step even closer.</p>
        </div>

        <span className="auth-foot">A little more thoughtful, by design.</span>
      </aside>

      {/* Right Warm Paper-Cream Form Panel */}
      <main className="auth-form">
        <button
          type="button"
          onClick={onBackToLanding}
          className="auth-back"
        >
          <ArrowLeft size={15} />
          <span>Back to Closer</span>
        </button>

        <div className="w-full max-w-[400px] bg-cream border border-tan-200 rounded-xl shadow-[0_12px_36px_rgba(32,59,64,0.08)] overflow-hidden">
          <div className="px-7 pt-8 pb-6 sm:px-8">
            {/* Compact Mobile Brand Mark */}
            <div className="flex md:hidden items-center gap-2 mb-5">
              <span className="grid place-items-center w-7 h-7 rounded-[9px_9px_9px_3px] bg-olive-700 text-cream">
                <Home className="w-3.5 h-3.5" />
              </span>
              <span className="font-display text-lg font-extrabold tracking-tight text-olive-900">
                closer<span className="text-amber-500">.</span>
              </span>
            </div>

            <h2 className="font-display text-[22px] font-bold tracking-tight text-olive-900 leading-snug">
              {isSignUp ? 'Create your account' : 'Sign in to Closer'}
            </h2>
            <p className="mt-1.5 text-[13px] text-tan-600 leading-relaxed">
              {isSignUp
                ? 'Welcome! Please fill in the details to get started.'
                : 'Welcome back! Please sign in to continue.'}
            </p>

            {/* Official Google / Gmail Sign-In Button */}
            <div className="mt-6">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isGoogleLoading}
                className="gsi-material-button w-full min-h-[44px] px-4 py-2.5 bg-white hover:bg-tan-50 active:bg-tan-100 border border-tan-300 rounded-lg shadow-[0_1px_2px_rgba(32,59,64,0.05)] flex items-center justify-center gap-2.5 text-[13px] font-semibold text-olive-900 transition-colors disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {isGoogleLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-olive-700" />
                ) : (
                  <span className="gsi-material-button-icon w-[18px] h-[18px] shrink-0">
                    <svg
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 48 48"
                      className="block w-full h-full"
                      aria-hidden="true"
                    >
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      />
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      />
                      <path fill="none" d="M0 0h48v48H0z" />
                    </svg>
                  </span>
                )}
                <span className="gsi-material-button-contents">
                  {isGoogleLoading ? 'Connecting to Google...' : 'Continue with Google'}
                </span>
              </button>
            </div>

            <div className="flex items-center gap-3 my-5">
              <span className="h-px flex-1 bg-tan-200" />
              <span className="text-[11px] font-medium text-tan-500 uppercase tracking-wider">
                or
              </span>
              <span className="h-px flex-1 bg-tan-200" />
            </div>

            {error && (
              <div
                role="alert"
                className="mb-4 px-3.5 py-2.5 rounded-lg bg-rust-50 border border-rust-200 text-rust-700 text-xs font-medium"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {isSignUp && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="auth-first-name"
                      className="block text-xs font-semibold text-olive-900 mb-1.5"
                    >
                      First name
                    </label>
                    <input
                      id="auth-first-name"
                      type="text"
                      autoComplete="given-name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="First name"
                      className="w-full min-h-[42px] px-3 py-2 bg-tan-50/70 focus:bg-cream border border-tan-300 focus:border-olive-700 rounded-lg text-base sm:text-[13px] text-olive-900 placeholder:text-tan-400 focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="auth-last-name"
                      className="block text-xs font-semibold text-olive-900 mb-1.5"
                    >
                      Last name
                    </label>
                    <input
                      id="auth-last-name"
                      type="text"
                      autoComplete="family-name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Last name"
                      className="w-full min-h-[42px] px-3 py-2 bg-tan-50/70 focus:bg-cream border border-tan-300 focus:border-olive-700 rounded-lg text-base sm:text-[13px] text-olive-900 placeholder:text-tan-400 focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor="auth-email"
                  className="block text-xs font-semibold text-olive-900 mb-1.5"
                >
                  Email address
                </label>
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="w-full min-h-[42px] px-3 py-2 bg-tan-50/70 focus:bg-cream border border-tan-300 focus:border-olive-700 rounded-lg text-base sm:text-[13px] text-olive-900 placeholder:text-tan-400 focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label
                  htmlFor="auth-password"
                  className="block text-xs font-semibold text-olive-900 mb-1.5"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={isSignUp ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full min-h-[42px] pl-3 pr-10 py-2 bg-tan-50/70 focus:bg-cream border border-tan-300 focus:border-olive-700 rounded-lg text-base sm:text-[13px] text-olive-900 placeholder:text-tan-400 focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 min-w-[34px] min-h-[34px] flex items-center justify-center text-tan-500 hover:text-olive-900 rounded-md cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full min-h-[44px] mt-1 flex items-center justify-center gap-2 bg-olive-700 hover:bg-olive-800 text-cream rounded-lg text-[13px] font-bold shadow-[0_4px_12px_rgba(36,75,82,0.12)] transition-all hover:-translate-y-[1px] cursor-pointer"
              >
                <span>Continue</span>
                <ArrowRight size={15} />
              </button>
            </form>
          </div>

          <div className="px-7 py-4 sm:px-8 bg-tan-50/80 border-t border-tan-200 flex items-center justify-between gap-3 text-xs text-tan-600">
            <div>
              {isSignUp ? 'Already have an account?' : 'Don’t have an account?'}{' '}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  onChangeMode(isSignUp ? 'in' : 'up');
                }}
                className="font-semibold text-olive-700 hover:text-amber-600 cursor-pointer transition-colors"
              >
                {isSignUp ? 'Sign in' : 'Sign up'}
              </button>
            </div>
            <button
              type="button"
              onClick={() => onAuthenticated()}
              className="text-xs font-medium text-tan-500 hover:text-olive-900 cursor-pointer whitespace-nowrap transition-colors"
            >
              Skip for now
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
