import React from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { theme } from './theme';

/**
 * תופס שגיאות render בכל האפליקציה ומציג הודעה קריאה במקום מסך קריסה,
 * כך שהמשתמש יכול לדווח על הטקסט והאפליקציה לא "מתה".
 */
interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('App error:', error);
  }

  render() {
    if (this.state.error) {
      return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          <Text style={styles.title}>אופס, קרתה תקלה</Text>
          <Text style={styles.message}>{this.state.error.message}</Text>
          <Text style={styles.hint}>סגור את האפליקציה ופתח אותה מחדש. אם זה חוזר - צלם מסך זה.</Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { flexGrow: 1, justifyContent: 'center', padding: theme.spacing(3) },
  title: { fontSize: 22, fontWeight: '800', color: theme.colors.danger, textAlign: 'center' },
  message: {
    fontSize: 15,
    color: theme.colors.text,
    textAlign: 'center',
    marginTop: theme.spacing(2),
    lineHeight: 22,
  },
  hint: {
    fontSize: 13,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: theme.spacing(3),
  },
});
