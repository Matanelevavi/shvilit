import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import { config } from '@/config/env';

/**
 * ניהול מצב ההתחברות של המשתמש דרך Supabase Auth (Google OAuth, PKCE).
 * חושף: user, session, loading, signInWithGoogle, signOut.
 */

WebBrowser.maybeCompleteAuthSession();

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** מחליף את ה-URL שחוזר מ-OAuth ל-session (זרימת PKCE: פרמטר code). */
async function createSessionFromUrl(url: string): Promise<void> {
  if (!supabase) return;
  const { queryParams } = Linking.parse(url);

  const errorCode = queryParams?.error_code ?? queryParams?.error;
  if (typeof errorCode === 'string') throw new Error(errorCode);

  const code = queryParams?.code;
  if (typeof code === 'string') {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return;
  }

  // נפילה אחורה לזרימת token (implicit), אם הוחזרה.
  const accessToken = queryParams?.access_token;
  const refreshToken = queryParams?.refresh_token;
  if (typeof accessToken === 'string' && typeof refreshToken === 'string') {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // מצב אורח: אין client של Supabase - מסיימים טעינה בלי משתמש.
    if (!supabase) {
      setLoading(false);
      return;
    }
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (mounted) setSession(data.session);
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    if (!config.hasSupabase || !supabase) {
      throw new Error('Supabase לא הוגדר. ראה README להגדרת ההתחברות.');
    }
    const redirectTo = Linking.createURL('auth/callback');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) throw error;
    if (!data?.url) throw new Error('לא התקבלה כתובת התחברות מ-Supabase.');

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === 'success' && result.url) {
      await createSessionFromUrl(result.url);
    }
  };

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      loading,
      signInWithGoogle,
      signOut,
    }),
    [session, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
