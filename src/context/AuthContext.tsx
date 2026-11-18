import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  reload,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase.ts';
import {
  DEFAULT_PLATFORM_SETTINGS,
  ensureUserDocuments,
  subscribePlatformSettings,
  subscribePrivateProfile,
  subscribeUserAccount,
} from '../services/firestoreService.ts';
import type {
  PlatformSettings,
  UserAccountDoc,
  UserPrivateProfileDoc,
} from '../types/financial.ts';

const ADMIN_EMAIL = 'anikesh.0251mba193@dgu.ac.in';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface AuthContextValue {
  user: User | null;
  authReady: boolean;
  account: UserAccountDoc | null;
  privateProfile: UserPrivateProfileDoc | null;
  platformSettings: PlatformSettings;
  isAdmin: boolean;
  isEmailVerified: boolean;
  authError: string | null;
  clearAuthError: () => void;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (name: string, email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshAuthUser: () => Promise<void>;
  logout: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function mapFirebaseAuthError(err: unknown, fallback: string): string {
  const code = (err as { code?: string })?.code || '';
  if (code === 'auth/operation-not-allowed') {
    return 'Email/Password sign-in is not yet enabled in Firebase Console > Authentication > Sign-in method. Use Google Sign-In or enable Email/Password provider.';
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Invalid email address or password.';
  }
  if (code === 'auth/email-already-in-use') {
    return 'An account with this email already exists. Try signing in or resetting your password.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many attempts. Please wait a moment before trying again.';
  }
  if (code === 'auth/popup-closed-by-user') {
    return 'Sign-in popup was closed before completion.';
  }
  return err instanceof Error ? err.message : fallback;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [account, setAccount] = useState<UserAccountDoc | null>(null);
  const [privateProfile, setPrivateProfile] = useState<UserPrivateProfileDoc | null>(null);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>(DEFAULT_PLATFORM_SETTINGS);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubSettings = subscribePlatformSettings((settings) => {
      setPlatformSettings(settings);
    });
    return () => unsubSettings();
  }, []);

  useEffect(() => {
    let unsubAccount: (() => void) | null = null;
    let unsubPrivate: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (unsubAccount) {
        unsubAccount();
        unsubAccount = null;
      }
      if (unsubPrivate) {
        unsubPrivate();
        unsubPrivate = null;
      }

      if (firebaseUser) {
        if (firebaseUser.emailVerified) {
          await ensureUserDocuments({
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Investor',
            email: firebaseUser.email || '',
            photoURL: firebaseUser.photoURL,
            emailVerified: firebaseUser.emailVerified,
          });
          unsubAccount = subscribeUserAccount(firebaseUser.uid, setAccount);
          unsubPrivate = subscribePrivateProfile(firebaseUser.uid, setPrivateProfile);
        } else {
          setAccount(null);
          setPrivateProfile(null);
        }
      } else {
        setAccount(null);
        setPrivateProfile(null);
      }

      setAuthReady(true);
    });

    return () => {
      unsubAuth();
      if (unsubAccount) unsubAccount();
      if (unsubPrivate) unsubPrivate();
    };
  }, []);

  const isEmailVerified = Boolean(user?.emailVerified);
  const isAdmin = Boolean(
    user &&
      user.emailVerified &&
      (user.email === ADMIN_EMAIL || account?.role === 'admin')
  );

  async function loginWithGoogle() {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err, 'Google sign-in failed.'));
      throw err;
    }
  }

  async function loginWithEmail(email: string, password: string) {
    setAuthError(null);
    const cleanEmail = email.trim();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      const msg = 'Please enter a valid email address.';
      setAuthError(msg);
      throw new Error(msg);
    }
    try {
      await signInWithEmailAndPassword(auth, cleanEmail, password);
    } catch (err: unknown) {
      setAuthError(mapFirebaseAuthError(err, 'Email sign-in failed.'));
      throw err;
    }
  }

  async function registerWithEmail(name: string, email: string, password: string) {
    setAuthError(null);
    const cleanEmail = email.trim();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      const msg = 'Please enter a valid email address.';
      setAuthError(msg);
      throw new Error(msg);
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      const msg = 'Password must be at least 8 characters and include at least one letter and one number.';
      setAuthError(msg);
      throw new Error(msg);
    }
    try {
      const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      if (name.trim()) {
        await updateProfile(cred.user, { displayName: name.trim().slice(0, 120) });
      }
      await sendEmailVerification(cred.user);
    } catch (err: unknown) {
      setAuthError(mapFirebaseAuthError(err, 'Registration failed.'));
      throw err;
    }
  }

  async function resetPassword(email: string) {
    setAuthError(null);
    const cleanEmail = email.trim();
    if (!EMAIL_REGEX.test(cleanEmail)) {
      const msg = 'Enter a valid registered email address for password reset.';
      setAuthError(msg);
      throw new Error(msg);
    }
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err, 'Could not send password reset email.'));
      throw err;
    }
  }

  async function resendVerificationEmail() {
    if (!auth.currentUser) return;
    setAuthError(null);
    try {
      await sendEmailVerification(auth.currentUser);
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err, 'Could not send verification email.'));
    }
  }

  async function refreshAuthUser() {
    if (!auth.currentUser) return;
    await reload(auth.currentUser);
    setUser({ ...auth.currentUser } as User);
  }

  async function logout() {
    await signOut(auth);
  }

  async function getIdToken(): Promise<string | null> {
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken();
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        authReady,
        account,
        privateProfile,
        platformSettings,
        isAdmin,
        isEmailVerified,
        authError,
        clearAuthError: () => setAuthError(null),
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        resetPassword,
        resendVerificationEmail,
        refreshAuthUser,
        logout,
        getIdToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
