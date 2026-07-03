import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthProvider';
import { useLocalProfile } from '@/auth/LocalProfile';
import { config } from '@/config/env';
import { theme } from '@/ui/theme';
import { showAlert } from '@/ui/dialogs';

function AnimatedLogo() {
  const scale = useRef(new Animated.Value(0)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // כניסה: spring bounce מ-0 ל-1 עם הטיה
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        tension: 60,
        friction: 5,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(rotate, { toValue: 1, duration: 400, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
        Animated.timing(rotate, { toValue: 0, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ]).start(() => {
      // אחרי הכניסה - pulse עדין ומחזורי
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.08, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1,    duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    });
  }, []);

  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '12deg'] });

  return (
    <Animated.View
      style={[
        styles.logoBadge,
        { transform: [{ scale: Animated.multiply(scale, pulse) }, { rotate: spin }] },
      ]}
    >
      <Image source={require('../assets/adaptive-icon.png')} style={styles.logo} resizeMode="contain" />
    </Animated.View>
  );
}

export default function LoginScreen() {
  const { signInWithGoogle } = useAuth();
  const { saveName } = useLocalProfile();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');

  const onGoogle = async () => {
    try {
      setBusy(true);
      await signInWithGoogle();
    } catch (err) {
      showAlert('ההתחברות נכשלה', err instanceof Error ? err.message : 'שגיאה לא ידועה');
    } finally {
      setBusy(false);
    }
  };

  const onEnter = async () => {
    if (!name.trim()) return;
    await saveName(name.trim());
    router.replace('/');
  };

  const onGuest = async () => {
    await saveName('אורח');
    router.replace('/');
  };

  return (
    <LinearGradient colors={theme.gradientLogin} style={styles.container}>
      <AnimatedLogo />
      <Text style={styles.title}>שבילית</Text>
      <Text style={styles.tagline}>סיורי הדרכה חכמים,{'\n'}בכל מקום שתעצרו בו</Text>

      {config.hasSupabase && config.googleEnabled ? (
        <>
          <TouchableOpacity
            style={[styles.button, busy && styles.buttonDisabled]}
            onPress={onGoogle}
            disabled={busy}
            activeOpacity={0.85}
          >
            {busy ? (
              <ActivityIndicator color={theme.colors.accentDark} />
            ) : (
              <>
                <Ionicons name="logo-google" size={18} color={theme.colors.accentDark} />
                <Text style={styles.buttonText}>התחברות עם Google</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={onGuest} style={styles.guestLink} activeOpacity={0.7}>
            <Text style={styles.guestLinkText}>המשך כאורח</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="איך קוראים לך?"
            placeholderTextColor="#9bb3a6"
            textAlign="right"
            returnKeyType="go"
            onSubmitEditing={onEnter}
            maxLength={24}
          />
          <TouchableOpacity
            style={[styles.button, !name.trim() && styles.buttonDisabled]}
            onPress={onEnter}
            disabled={!name.trim()}
            activeOpacity={0.85}
          >
            <Ionicons name="log-in-outline" size={20} color={theme.colors.accentDark} />
            <Text style={styles.buttonText}>כניסה</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onGuest} style={styles.guestLink} activeOpacity={0.7}>
            <Text style={styles.guestLinkText}>המשך כאורח</Text>
          </TouchableOpacity>
        </>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.spacing(3) },
  logoBadge: {
    width: 110,
    height: 110,
    borderRadius: theme.radiusXl,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing(2),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
  },
  logo: { width: 80, height: 80 },
  title: { fontSize: 48, fontWeight: '800', color: '#fff', marginBottom: theme.spacing(0.5) },
  tagline: {
    fontSize: 16,
    color: '#d7e6dd',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: theme.spacing(5),
  },
  input: {
    width: 280,
    backgroundColor: '#fff',
    borderRadius: theme.radiusLg,
    paddingVertical: theme.spacing(1.75),
    paddingHorizontal: theme.spacing(2),
    fontSize: 18,
    color: theme.colors.text,
    marginBottom: theme.spacing(2),
  },
  button: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: theme.spacing(1),
    backgroundColor: theme.colors.accent,
    paddingVertical: theme.spacing(2),
    paddingHorizontal: theme.spacing(5),
    borderRadius: theme.radiusLg,
    minWidth: 250,
    justifyContent: 'center',
    ...theme.shadow,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: theme.colors.accentDark, fontSize: 18, fontWeight: '700' },
  guestLink: { marginTop: theme.spacing(2.5), padding: theme.spacing(1) },
  guestLinkText: { color: '#d7e6dd', fontSize: 15, textDecorationLine: 'underline' },
});
