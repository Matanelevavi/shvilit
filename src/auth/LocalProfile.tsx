import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * התחברות מקומית פשוטה: שם המשתמש נשמר במכשיר, ללא שרת וללא חשבון.
 * משמש כשאין Supabase מוגדר - נותן חוויית התחברות מלאה בעלות אפס.
 *
 * אחסון לפי פלטפורמה: SecureStore בנייטיב, localStorage בדפדפן
 * (SecureStore לא קיים ב-web - בלעדי זה כל רענון דף היה מנתק את המשתמש).
 */
const PROFILE_KEY = 'shvilit_profile_name';

const storage = {
  async get(): Promise<string | null> {
    if (Platform.OS === 'web') {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(PROFILE_KEY) : null;
    }
    return SecureStore.getItemAsync(PROFILE_KEY);
  },
  async set(value: string): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.setItem(PROFILE_KEY, value);
      return;
    }
    await SecureStore.setItemAsync(PROFILE_KEY, value);
  },
  async remove(): Promise<void> {
    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') localStorage.removeItem(PROFILE_KEY);
      return;
    }
    await SecureStore.deleteItemAsync(PROFILE_KEY);
  },
};

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
        const name = await storage.get();
        if (name) setProfile({ name });
      } catch {
        // אחסון לא זמין - נמשיך בלי פרופיל שמור.
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const saveName = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await storage.set(trimmed);
    } catch {
      // אם האחסון נכשל - נשמור בזיכרון בלבד כדי שהכניסה תעבוד בכל זאת.
    }
    setProfile({ name: trimmed });
  };

  const clearProfile = async () => {
    try {
      await storage.remove();
    } catch {
      // מתעלמים מכשל אחסון.
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
