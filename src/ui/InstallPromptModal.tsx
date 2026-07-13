import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from './theme';

interface Props {
  onInstall: () => void;
  onDismiss: () => void;
}

/** הצעת התקנת PWA - מוצג פעם אחת מיד אחרי התחברות עם Google (web בלבד). */
export function InstallPromptModal({ onInstall, onDismiss }: Props) {
  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <TouchableOpacity style={styles.closeBtn} onPress={onDismiss} hitSlop={10}>
          <Ionicons name="close" size={20} color={theme.colors.textMuted} />
        </TouchableOpacity>
        <View style={styles.iconBadge}>
          <Image source={require('../../assets/adaptive-icon.png')} style={styles.icon} resizeMode="contain" />
        </View>
        <Text style={styles.title}>התקנת שבילית</Text>
        <Text style={styles.body}>
          התקינו את שבילית על מסך הבית - פתיחה מהירה במסך מלא, בלי לחפש בדפדפן בכל פעם.
        </Text>
        <TouchableOpacity style={styles.installBtn} onPress={onInstall} activeOpacity={0.85}>
          <Ionicons name="download-outline" size={18} color={theme.colors.accentDark} />
          <Text style={styles.installBtnText}>התקנה</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDismiss} style={styles.laterLink} hitSlop={8}>
          <Text style={styles.laterLinkText}>אולי בפעם אחרת</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(10,20,15,0.55)',
    alignItems: 'center', justifyContent: 'center',
    padding: theme.spacing(3),
    zIndex: 1000,
  },
  card: {
    width: '100%', maxWidth: 340,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radiusXl,
    padding: theme.spacing(3),
    alignItems: 'center',
    ...theme.shadow,
  },
  closeBtn: { position: 'absolute', top: theme.spacing(1.5), left: theme.spacing(1.5), padding: 4 },
  iconBadge: {
    width: 72, height: 72, borderRadius: theme.radiusLg,
    backgroundColor: theme.colors.surfaceAlt,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: theme.spacing(1.5),
  },
  icon: { width: 52, height: 52 },
  title: { fontSize: 20, fontWeight: '800', color: theme.colors.primary, marginBottom: theme.spacing(1) },
  body: {
    fontSize: 14, lineHeight: 21, color: theme.colors.textMuted,
    textAlign: 'center', marginBottom: theme.spacing(2.5),
  },
  installBtn: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1),
    backgroundColor: theme.colors.accent,
    paddingVertical: theme.spacing(1.75), paddingHorizontal: theme.spacing(4),
    borderRadius: theme.radiusLg,
    ...theme.shadowSoft,
  },
  installBtnText: { fontSize: 16, fontWeight: '700', color: theme.colors.accentDark },
  laterLink: { marginTop: theme.spacing(1.5), padding: theme.spacing(0.5) },
  laterLinkText: { fontSize: 13, color: theme.colors.textMuted, textDecorationLine: 'underline' },
});
