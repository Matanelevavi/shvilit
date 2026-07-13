import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from './theme';

interface Props {
  location: string;
  onView: () => void;
  onDismiss: () => void;
}

/** כרטיס "ההדרכה מוכנה" בסגנון האפליקציה - במקום Alert/confirm גנרי של המערכת. */
export function TourReadyModal({ location, onView, onDismiss }: Props) {
  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <View style={styles.iconBadge}>
          <Ionicons name="videocam" size={30} color={theme.colors.accentDark} />
        </View>
        <Text style={styles.title}>הסרטון מוכן!</Text>
        <Text style={styles.body}>סרטון ההדרכה של "{location}" מוכן לצפייה.</Text>
        <TouchableOpacity style={styles.viewBtn} onPress={onView} activeOpacity={0.85}>
          <Ionicons name="play" size={18} color={theme.colors.accentDark} />
          <Text style={styles.viewBtnText}>לצפייה</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDismiss} style={styles.laterLink} hitSlop={8}>
          <Text style={styles.laterLinkText}>אחר כך</Text>
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
  iconBadge: {
    width: 64, height: 64, borderRadius: theme.radiusLg,
    backgroundColor: theme.colors.accent,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: theme.spacing(1.5),
  },
  title: { fontSize: 20, fontWeight: '800', color: theme.colors.primary, marginBottom: theme.spacing(1) },
  body: {
    fontSize: 14, lineHeight: 21, color: theme.colors.textMuted,
    textAlign: 'center', marginBottom: theme.spacing(2.5),
  },
  viewBtn: {
    flexDirection: 'row', alignItems: 'center', gap: theme.spacing(1),
    backgroundColor: theme.colors.accent,
    paddingVertical: theme.spacing(1.75), paddingHorizontal: theme.spacing(4),
    borderRadius: theme.radiusLg,
    ...theme.shadowSoft,
  },
  viewBtnText: { fontSize: 16, fontWeight: '700', color: theme.colors.accentDark },
  laterLink: { marginTop: theme.spacing(1.5), padding: theme.spacing(0.5) },
  laterLinkText: { fontSize: 13, color: theme.colors.textMuted, textDecorationLine: 'underline' },
});
