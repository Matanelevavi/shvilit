import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from './theme';

interface Props {
  onInstall: () => void;
  onDismiss: () => void;
}

/** גובה קבוע כדי שאפשר יהיה לדחוף את שאר המסך למטה בלי לחפוף לכותרת. */
export const INSTALL_BANNER_HEIGHT = 64;

/** באנר מלבני צמוד לראש המסך, ברוחב מלא - התבנית המוכרת מ"הוסף למסך הבית" באתרים. */
export function InstallBanner({ onInstall, onDismiss }: Props) {
  return (
    <View style={styles.bar}>
      <Image source={require('../../assets/adaptive-icon.png')} style={styles.icon} resizeMode="contain" />
      <View style={styles.textWrap}>
        <Text style={styles.title} numberOfLines={1}>התקינו את שבילית</Text>
        <Text style={styles.subtitle} numberOfLines={1}>גישה מהירה ממסך הבית</Text>
      </View>
      <TouchableOpacity style={styles.installBtn} onPress={onInstall} activeOpacity={0.85}>
        <Ionicons name="download-outline" size={16} color={theme.colors.accentDark} />
        <Text style={styles.installBtnText}>התקנה</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onDismiss} hitSlop={10} style={styles.closeBtn}>
        <Ionicons name="close" size={20} color="rgba(255,255,255,0.75)" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: INSTALL_BANNER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(1.25),
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing(2),
    zIndex: 1000,
    ...theme.shadow,
  },
  icon: { width: 34, height: 34, borderRadius: 8 },
  textWrap: { flex: 1 },
  title: { color: '#fff', fontSize: 14, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 1 },
  installBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: theme.colors.accent,
    paddingVertical: theme.spacing(0.875),
    paddingHorizontal: theme.spacing(1.5),
    borderRadius: theme.radius,
  },
  installBtnText: { color: theme.colors.accentDark, fontSize: 13, fontWeight: '800' },
  closeBtn: { padding: 4 },
});
