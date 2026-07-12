import { useCallback, useRef, useState } from 'react';
import {
  Image,
  Linking,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '@/ui/theme';
import { showAlert } from '@/ui/dialogs';
import { unlockAdmin, isAdminUnlocked } from '@/state/userRegistry';

const GITHUB = 'https://github.com/Matanelevavi/shvilit';
const SITE_URL = 'https://shvilit.shvilit-tours.workers.dev';
const FEEDBACK_EMAIL = 'matanelevavi@gmail.com';

export default function AboutScreen() {
  const router = useRouter();
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [adminVisible, setAdminVisible] = useState(false);

  // מצב מפתח נסתר: 7 הקשות רצופות על הלוגו פותחות גישה לפאנל הניהול.
  // לא מוצג/מרומז למשתמש רגיל - בכוונה נשאר "אסטר ביצה" קטן.
  const checkAdminUnlock = useCallback(async () => {
    const already = await isAdminUnlocked();
    if (already) { setAdminVisible(true); return; }

    tapCount.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => { tapCount.current = 0; }, 2000);

    if (tapCount.current >= 7) {
      tapCount.current = 0;
      await unlockAdmin();
      setAdminVisible(true);
      showAlert('מצב מפתח הופעל', 'גישת מנהל מערכת זמינה עכשיו.');
    }
  }, []);

  const onShare = async () => {
    try {
      await Share.share({
        message: 'מצאתי אפליקציה ששווה להכיר לפני הטיול הבא - שבילית יוצרת הדרכה מותאמת לכל מקום, תוך שניות.',
        url: SITE_URL,
      });
    } catch {
      // שיתוף בוטל/לא נתמך בדפדפן - לא קריטי
    }
  };

  const onFeedback = () => {
    Linking.openURL(`mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent('משוב על שבילית')}`);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* Hero */}
      <LinearGradient colors={['#0f3d2e', '#1a5c44']} style={styles.hero}>
        <TouchableOpacity onPress={checkAdminUnlock} activeOpacity={0.95}>
          <View style={styles.logoWrap}>
            <Image
              source={require('../assets/adaptive-icon.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        </TouchableOpacity>
        <Text style={styles.appName}>שבילית</Text>
      </LinearGradient>

      {/* הסיפור - למה שבילית קיימת */}
      <View style={styles.section}>
        <Text style={styles.storyText}>
          איזו ארץ מדהימה יש לנו - מהנופים הירוקים של הכנרת והגולן, דרך העתיקות של ירושלים
          ויהודה, ועד להרים האדומים של אילת ומצוקי האלמוגים של ים סוף. כל פינה כאן מספרת
          סיפור אחר.
        </Text>
        <Text style={[styles.storyText, styles.storyTextSpacing]}>
          תמיד כשיצאתי לטייל רציתי להבין יותר על המקום שאני מגיע אליו - גם בטיול לבד, ובטח
          כשהדרכתי. שעות שלמות עברו בין ויקיפדיה, אתרי היסטוריה ובלוגים כדי לאסוף מידע לפני
          כל טיול. מכאן נולד הרעיון: מערכת אחת שבונה הדרכה מעניינת ועוזרת להבין לעומק את
          המקום - ההיסטוריה שלו, הצמחייה, הגיאולוגיה, החשיבות הגיאוגרפית שלו.
        </Text>
        <Text style={[styles.storyText, styles.storyTextSpacing]}>
          כך נולדה שבילית: בוחרים מקום, בוחרים אורך וסגנון, וההדרכה - כטקסט, כשמע או כווידאו -
          מוכנה תוך שניות, מבוססת על מקורות אמינים.
        </Text>
      </View>

      {/* CTA - כמה אפשרויות זורמות, בלי לחץ */}
      <View style={styles.ctaSection}>
        <TouchableOpacity style={styles.ctaPrimary} onPress={() => router.push('/')} activeOpacity={0.9}>
          <Ionicons name="trail-sign-outline" size={20} color={theme.colors.accentDark} />
          <Text style={styles.ctaPrimaryText}>צאו לדרך</Text>
        </TouchableOpacity>
        <View style={styles.ctaSecondaryRow}>
          <TouchableOpacity style={styles.ctaSecondary} onPress={onShare} activeOpacity={0.85}>
            <Ionicons name="share-social-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.ctaSecondaryText}>שיתוף עם חברים</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctaSecondary} onPress={onFeedback} activeOpacity={0.85}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color={theme.colors.primary} />
            <Text style={styles.ctaSecondaryText}>שליחת משוב</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Admin access (after unlock) */}
      {adminVisible && (
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.adminBtn}
            onPress={() => router.push('/admin')}
            activeOpacity={0.85}
          >
            <Ionicons name="shield-checkmark-outline" size={18} color="#fff" />
            <Text style={styles.adminBtnText}>פאנל ניהול</Text>
            <Ionicons name="chevron-back" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Footer */}
      <TouchableOpacity onPress={() => Linking.openURL(GITHUB)} activeOpacity={0.7}>
        <Text style={styles.footer}>
          נבנתה על ידי מתנאל לבבי · קוד פתוח ב-GitHub{'\n'}
          © {new Date().getFullYear()} שבילית - אינה קשורה לוויקיפדיה או ל-Google
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content:  { paddingBottom: theme.spacing(6) },

  hero: {
    alignItems: 'center',
    paddingTop: theme.spacing(5),
    paddingBottom: theme.spacing(4),
    gap: theme.spacing(0.5),
  },
  logoWrap: {
    width: 100,
    height: 100,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing(1.5),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  logo: { width: 72, height: 72 },
  appName: { fontSize: 38, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },

  section: {
    marginHorizontal: theme.spacing(2),
    marginTop: theme.spacing(3),
  },
  storyText: {
    fontSize: 16,
    lineHeight: 26,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radiusLg,
    padding: theme.spacing(2),
    ...theme.shadowSoft,
  },
  storyTextSpacing: { marginTop: theme.spacing(1.5) },

  ctaSection: {
    marginHorizontal: theme.spacing(2),
    marginTop: theme.spacing(3),
    gap: theme.spacing(1.25),
  },
  ctaPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(1),
    backgroundColor: theme.colors.accent,
    paddingVertical: theme.spacing(2),
    borderRadius: theme.radiusLg,
    ...theme.shadow,
  },
  ctaPrimaryText: { fontSize: 17, fontWeight: '800', color: theme.colors.accentDark },
  ctaSecondaryRow: { flexDirection: 'row', gap: theme.spacing(1) },
  ctaSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing(0.75),
    backgroundColor: theme.colors.surface,
    paddingVertical: theme.spacing(1.5),
    borderRadius: theme.radiusLg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    ...theme.shadowSoft,
  },
  ctaSecondaryText: { fontSize: 13, fontWeight: '700', color: theme.colors.primary },

  adminBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radiusLg,
    paddingVertical: theme.spacing(1.75),
    paddingHorizontal: theme.spacing(2),
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(1),
    ...theme.shadow,
  },
  adminBtnText: { flex: 1, fontSize: 15, fontWeight: '700', color: '#fff' },

  footer: {
    marginTop: theme.spacing(4),
    fontSize: 11,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: theme.spacing(3),
  },
});
