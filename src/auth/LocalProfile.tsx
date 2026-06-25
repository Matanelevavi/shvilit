import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as SecureStore from 'expo-secure-store';

/**
 * התחברות מקומית פשוטה: שם המשתמש נשמר במכשיר (SecureStore), ללא שרת וללא חשבון.
 * משמש כשאין Supabase מוגדר - נותן חוויית התחברות מלאה בעלות אפס.
 */
const PROFILE_KEY = 'shvilit_profile_name';

interface LocalProfile {
  name: string;
}

interface LocalProfileContextValue {
  profile: LocalProfile | null;
  loading: boolean;
  saveName: (name: string) => Promise<void>;
  clearProfile: () => Promise<void>;
}

const LocalProfileContext = createContext<LocalProfileContextValue | undefined>(undefined);

export function LocalProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const name = await SecureStore.getItemAsync(PROFILE_KEY);
        if (name) setProfile({ name });
      } catch {
        // SecureStore לא זמין (למשל בדפדפן) - נמשיך בלי אחסון מתמשך.
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const saveName = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await SecureStore.setItemAsync(PROFILE_KEY, trimmed);
    } catch {
      // אם האחסון נכשל (web) - נשמור בזיכרון בלבד כדי שהכניסה תעבוד בכל זאת.
    }
    setProfile({ name: trimmed });
  };

  const clearProfile = async () => {
    try {
      await SecureStore.deleteItemAsync(PROFILE_KEY);
    } catch {
      // מתעלמים מכשל אחסון בדפדפן.
    }
    setProfile(null);
  };

  const value = useMemo<LocalProfileContextValue>(
    () => ({ profile, loading, saveName, clearProfile }),
    [profile, loading],
  );

  return (
    <LocalProfileContext.Provider value={value}>{children}</LocalProfileContext.Provider>
  );
}

export function useLocalProfile(): LocalProfileContextValue {
  const ctx = useContext(LocalProfileContext);
  if (!ctx) throw new Error('useLocalProfile must be used within LocalProfileProvider');
  return ctx;
}
