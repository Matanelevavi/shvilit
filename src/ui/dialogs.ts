import { Alert, Platform } from 'react-native';

/**
 * דיאלוגים חוצי-פלטפורמות.
 *
 * חשוב: Alert.alert של React Native הוא no-op ב-react-native-web -
 * הודעות שגיאה ודיאלוגי אישור פשוט לא מופיעים באתר. כאן משתמשים
 * ב-window.alert/confirm בדפדפן וב-Alert הרגיל בנייטיב.
 */

/** הודעה פשוטה (כותרת + טקסט). */
export function showAlert(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

/** דיאלוג אישור: מפעיל את onConfirm רק אם המשתמש אישר. */
export function showConfirm(
  title: string,
  message: string,
  confirmText: string,
  onConfirm: () => void,
  options?: { destructive?: boolean; cancelText?: string },
): void {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: options?.cancelText ?? 'ביטול', style: 'cancel' },
    {
      text: confirmText,
      style: options?.destructive ? 'destructive' : 'default',
      onPress: onConfirm,
    },
  ]);
}
