import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '@/ui/theme';

/**
 * מסך ציבורי (לא דורש התחברות - ראה app/_layout.tsx AuthGate).
 * נדרש לאימות OAuth של Google: מסך ההסכמה מקשר לכתובת הזו.
 */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.body}>{children}</Text>
    </View>
  );
}

export default function PrivacyScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>מדיניות פרטיות - שבילית</Text>
      <Text style={styles.updated}>עודכן לאחרונה: יולי 2026</Text>

      <Section title="אילו נתונים נאספים">
        בהתחברות עם חשבון Google נשמרים שם ומייל בלבד, לצורך זיהוי החשבון שלך.
        בפעילות באפליקציה (סיורים, חידונים, סרטונים) נשמרות נקודות וסטטיסטיקות
        שימוש, כדי להציג לך התקדמות ולוח תוצאות.
      </Section>

      <Section title="איך הנתונים נשמרים">
        הנתונים נשמרים בשירות Supabase (מסד נתונים מאובטח עם הצפנה), ואינם
        נמכרים או משותפים עם צד שלישי לצרכי שיווק.
      </Section>

      <Section title="מחיקת נתונים">
        ניתן לבקש מחיקת חשבון וכל המידע הקשור אליו בכל עת, בפנייה למייל
        matanelevavi@gmail.com.
      </Section>

      <Section title="שירותי צד שלישי">
        האפליקציה משתמשת ב-Google OAuth להתחברות, ב-Gemini AI ליצירת תוכן
        הסיורים, ובוויקיפדיה למידע על אתרים - בהתאם למדיניות הפרטיות של כל
        שירות בהתאמה.
      </Section>

      <Section title="יצירת קשר">
        שאלות לגבי פרטיות: matanelevavi@gmail.com
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing(3), paddingBottom: theme.spacing(6), maxWidth: 640, width: '100%', alignSelf: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: theme.colors.text, textAlign: 'right' },
  updated: { fontSize: 12, color: theme.colors.textMuted, textAlign: 'right', marginTop: 4, marginBottom: theme.spacing(2) },
  section: { marginTop: theme.spacing(2) },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: theme.colors.primary, textAlign: 'right', marginBottom: 6 },
  body: { fontSize: 14, lineHeight: 22, color: theme.colors.text, textAlign: 'right' },
});
