import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { Button } from './ui/button.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog.tsx';
import { Input } from './ui/input.tsx';

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAuthenticated?: () => void;
}

export function AuthModal({ open, onOpenChange, onAuthenticated }: AuthModalProps) {
  const {
    loginWithGoogle,
    loginWithEmail,
    registerWithEmail,
    resetPassword,
    authError,
    clearAuthError,
  } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  async function handleGoogle() {
    setBusy(true);
    setInfoMessage(null);
    clearAuthError();
    try {
      await loginWithGoogle();
      onOpenChange(false);
      onAuthenticated?.();
    } catch {
      // handled in context
    } finally {
      setBusy(false);
    }
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setInfoMessage(null);
    clearAuthError();
    try {
      if (mode === 'login') {
        await loginWithEmail(email, password);
        onOpenChange(false);
        onAuthenticated?.();
      } else if (mode === 'register') {
        await registerWithEmail(name, email, password);
        setInfoMessage(
          'Account created with Free Investor role. Please check your inbox and verify your email address before accessing saved portfolios.'
        );
      } else {
        await resetPassword(email);
        setInfoMessage(
          'Password reset link sent if an account exists for this email address.'
        );
      }
    } catch {
      // handled in context
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'login'
              ? 'Sign in to InvestWise AI'
              : mode === 'register'
                ? 'Create Free Investor Account'
                : 'Reset Your Password'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'reset'
              ? 'Enter your registered email address to receive a Firebase password reset link.'
              : 'Access private INR portfolios, watchlists, grounded AI research reports, and saved analyses.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {mode !== 'reset' && (
            <>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleGoogle}
                disabled={busy}
              >
                Continue with Google
              </Button>

              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
                <span className="mx-3 text-xs text-slate-400">or email &amp; password</span>
                <div className="flex-grow border-t border-slate-200 dark:border-slate-800" />
              </div>
            </>
          )}

          <form onSubmit={handleEmailSubmit} className="space-y-3">
            {mode === 'register' && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Full Name
                </label>
                <Input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Aarav Sharma"
                />
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Email Address
              </label>
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="investor@example.in"
              />
            </div>

            {mode !== 'reset' && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Password
                  </label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      className="text-xs text-teal-700 hover:underline dark:text-teal-400"
                      onClick={() => {
                        setMode('reset');
                        clearAuthError();
                        setInfoMessage(null);
                      }}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <Input
                  type="password"
                  required
                  minLength={mode === 'register' ? 8 : 6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    mode === 'register'
                      ? 'Min 8 chars, include letters & numbers'
                      : 'Enter password'
                  }
                />
              </div>
            )}

            {authError && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
                {authError}
              </div>
            )}

            {infoMessage && (
              <div className="rounded-md border border-teal-200 bg-teal-50 p-3 text-xs text-teal-900 dark:border-teal-900/60 dark:bg-teal-950/40 dark:text-teal-200">
                {infoMessage}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={busy}>
              {mode === 'login'
                ? 'Sign In with Email'
                : mode === 'register'
                  ? 'Register Investor Account'
                  : 'Send Password Reset Link'}
            </Button>
          </form>

          <div className="flex items-center justify-between pt-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-teal-700 dark:text-teal-400" />
              Verified email required for private writes
            </span>
            <button
              type="button"
              className="font-medium text-teal-700 hover:underline dark:text-teal-400"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                clearAuthError();
                setInfoMessage(null);
              }}
            >
              {mode === 'login' ? 'Need an account? Register' : 'Back to Sign In'}
            </button>
          </div>

          <p className="text-[11px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-2">
            Google Sign-In is active out of the box. For Email/Password login, registration, and
            password resets, ensure the Email/Password provider is enabled in Firebase Console
            (&rarr; Authentication &rarr; Sign-in method).
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
