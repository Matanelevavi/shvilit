import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '@/ui/theme';
import { unlockAdmin, isAdminUnlocked } from '@/state/userRegistry';

const VERSION = '1.0.0';
const GITHUB = 'https://github.com/Matanelevavi/shvilit';

const TECH = [
  { icon: 'phone-portrait-outline', label: 'React Native + Expo', desc: 'פריימוורק לפיתוח' },
  { icon: 'sparkles-outline',       label: 'Gemini AI (Google)', desc: 'מנוע יצירת התסריטים' },
  { icon: 'book-outline',           label: 'Wikipedia API',      desc: 'מידע אנציקלופדי' },
  { icon: 'map-outline',            label: 'OpenStreetMap',       desc: 'מידע גאוגרפי' },
  { icon: 'cloud-outline',          label: 'HuggingFace Spaces', desc: 'אחסון ה-backend' },
  { icon: 'globe-outline',          label: 'Netlify',             desc: 'אחסון ה-web app' },
];

export default function AboutScreen() {
  const router = useRouter();
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [adminVisible, setAdminVisible] = useState(false);

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
      Alert.alert('מצב מפתח הופעל', 'גישת מנהל מערכת זמינה עכשיו.');
    }
  }, []);

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
        <Text style={styles.appTagline}>הדרכת טיולים חכמה, בכל מקום</Text>
        <View style={styles.versionBadge}>
          <Text style={styles.versionText}>גרסה {VERSION}</Text>
        </View>
      </LinearGradient>

      {/* Creator card */}
      <View style={styles.creatorCard}>
        <LinearGradient colors={[theme.colors.accent + '22', theme.colors.accent + '08']} style={styles.creatorGrad}>
          <View style={styles.creatorAvatar}>
            <Text style={styles.creatorAvatarText}>מ</Text>
          </View>
          <View style={styles.creatorInfo}>
            <Text style={styles.creatorBuilt}>פותחה על ידי</Text>
            <Text style={styles.creatorName}>מתנאל אלבבי</Text>
            <Text style={styles.creatorRole}>מפתח FullStack · סטודנט למדעי המחשב</Text>
          </View>
        </LinearGradient>
      </View>

      {/* Description */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>מה זה שבילית?</Text>
        <Text style={styles.bodyText}>
          שבילית היא אפליקציית הדרכת טיולים המשתמשת ב-AI כדי ליצור סיורי שמע ווידאו מותאמים אישית
          לכל מקום. בחרו נקודת עניין, בחרו סגנון וסיור מותאם ייווצר עבורכם תוך שניות.
        </Text>
        <Text style={[styles.bodyText, { marginTop: theme.spacing(1) }]}>
          האפליקציה נבנתה כפרויקט אישי מתוך אהבה לטיולים ולטכנולוגיה, עם דגש על חוויית משתמש
          ישראלית - בעברית, RTL, ועם תמיכה מלאה בתרבות המקומית.
        </Text>
      </View>

      {/* Tech stack */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>טכנולוגיות</Text>
        <View style={styles.techGrid}>
          {TECH.map(({ icon, label, desc }) => (
            <View key={label} style={styles.techCard}>
              <Ionicons name={icon as any} size={22} color={theme.colors.primaryLight} />
              <Text style={styles.techLabel}>{label}</Text>
              <Text style={styles.techDesc}>{desc}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Links */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>קישורים</Text>
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => Linking.openURL(GITHUB)}
          activeOpacity={0.8}
        >
          <View style={styles.linkIcon}>
            <Ionicons name="logo-github" size={22} color={theme.colors.primary} />
          </View>
          <View style={styles.linkBody}>
            <Text style={styles.linkLabel}>קוד פתוח ב-GitHub</Text>
            <Text style={styles.linkSub}>github.com/Matanelevavi/shvilit</Text>
          </View>
          <Ionicons name="open-outline" size={16} color={theme.colors.textMuted} />
        </TouchableOpacity>
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
      <Text style={styles.footer}>
        © {new Date().getFullYear()} מתנאל אלבבי · כל הזכויות שמורות{'\n'}
        שבילית אינה קשורה לוויקיפדיה או ל-Google
      </Text>
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
  appName:    { fontSize: 38, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  appTagline: { fontSize: 15, color: '#c8ddd5', textAlign: 'center', marginTop: 2 },
  versionBadge: {
    marginTop: theme.spacing(1.5),
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  versionText: { fontSize: 12, color: '#d7e6dd', fontWeight: '600' },

  creatorCard: {
    margin: theme.spacing(2),
    borderRadius: theme.radiusXl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.accent + '44',
    ...theme.shadow,
  },
  creatorGrad: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: theme.spacing(2.5),
    gap: theme.spacing(2),
  },
  creatorAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creatorAvatarText: { fontSize: 24, fontWeight: '800', color: theme.colors.accentDark },
  creatorInfo: { flex: 1 },
  creatorBuilt: { fontSize: 12, color: theme.colors.textMuted, textAlign: 'right' },
  creatorName:  { fontSize: 20, fontWeight: '800', color: theme.colors.primary, textAlign: 'right', marginTop: 2 },
  creatorRole:  { fontSize: 13, color: theme.colors.textMuted, textAlign: 'right', marginTop: 2 },

  section: {
    marginHorizontal: theme.spacing(2),
    marginTop: theme.spacing(3),
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.textMuted,
    textAlign: 'right',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: theme.spacing(1.5),
  },
  bodyText: {
    fontSize: 15,
    lineHeight: 24,
    color: theme.colors.text,
    textAlign: 'right',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radiusLg,
    padding: theme.spacing(2),
    ...theme.shadowSoft,
  },

  techGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  },
  techCard: {
    width: '48%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radiusLg,
    padding: theme.spacing(1.75),
    alignItems: 'flex-end',
    gap: 4,
    ...theme.shadowSoft,
  },
  techLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.text,    textAlign: 'right' },
  techDesc:  { fontSize: 11, color: theme.colors.textMuted, textAlign: 'right' },

  linkRow: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radiusLg,
    padding: theme.spacing(2),
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    ...theme.shadowSoft,
  },
  linkIcon: {
    width: 42,
    height: 42,
    borderRadius: theme.radius,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkBody:  { flex: 1 },
  linkLabel: { fontSize: 15, fontWeight: '700', color: theme.colors.text,    textAlign: 'right' },
  linkSub:   { fontSize: 12, color: theme.colors.textMuted, textAlign: 'right', marginTop: 2 },

  adminBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radiusLg,
    paddingVertical: theme.spacing(1.75),
    paddingHorizontal: theme.spacing(2),
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: theme.spacing(1),
    ...theme.shadow,
  },
  adminBtnText: { flex: 1, fontSize: 15, fontWeight: '700', color: '#fff', textAlign: 'right' },

  footer: {
    marginTop: theme.spacing(4),
    fontSize: 11,
    color: theme.colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: theme.spacing(3),
  },
});
