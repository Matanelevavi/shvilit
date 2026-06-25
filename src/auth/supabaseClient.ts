import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { config } from '@/config/env';

/**
 * client של Supabase עם אחסון session מאובטח ב-Keychain/Keystore (expo-secure-store).
 *
 * אבטחה:
 *  - flowType 'pkce' (זרימת OAuth מאובטחת לאפליקציות נייטיב).
 *  - persistSession ב-SecureStore מוצפן, לא ב-AsyncStorage.
 *  - detectSessionInUrl=false: באפליקציה נייטיב מטפלים ב-redirect ידנית.
 *
 * ל-SecureStore יש מגבלת גודל לערך (~2KB). מאחר ש-session יכול להיות גדול יותר,
 * האדפטר מפצל את הערך ל-chunks קטנים ומאחד אותם בקריאה.
 */

const CHUNK_SIZE = 1800;

const ChunkedSecureStore = {
  async getItem(key: string): Promise<string | null> {
    const countRaw = await SecureStore.getItemAsync(`${key}__n`);
    if (countRaw == null) return null;
    const count = Number(countRaw);
    const parts: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const part = await SecureStore.getItemAsync(`${key}__${i}`);
      parts.push(part ?? '');
    }
    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    await ChunkedSecureStore.removeItem(key);
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    await SecureStore.setItemAsync(`${key}__n`, String(chunks.length));
    for (let i = 0; i < chunks.length; i += 1) {
      await SecureStore.setItemAsync(`${key}__${i}`, chunks[i]);
    }
  },

  async removeItem(key: string): Promise<void> {
    const countRaw = await SecureStore.getItemAsync(`${key}__n`);
    if (countRaw == null) return;
    const count = Number(countRaw);
    for (let i = 0; i < count; i += 1) {
      await SecureStore.deleteItemAsync(`${key}__${i}`);
    }
    await SecureStore.deleteItemAsync(`${key}__n`);
  },
};

// במצב אורח (ללא Supabase מוגדר) לא יוצרים client - createClient זורק אם ה-URL ריק.
// בדפדפן SecureStore לא קיים - נותנים ל-Supabase להשתמש באחסון ברירת המחדל (localStorage).
const authStorage = Platform.OS === 'web' ? undefined : ChunkedSecureStore;

export const supabase = config.hasSupabase
  ? createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: {
        storage: authStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
        flowType: 'pkce',
      },
    })
  : null;
