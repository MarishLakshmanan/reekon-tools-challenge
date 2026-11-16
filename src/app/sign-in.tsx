import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { layout } from '@/constants/layout';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { setSession } from '@/lib/session';

export default function SignInScreen() {
  const theme = useTheme();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(undefined);
    try {
      const { token, user } = await api.login(username.trim(), password);
      await setSession(token, user);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  const inputStyle = [
    styles.input,
    { color: theme.text, backgroundColor: theme.backgroundElement },
  ];

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={layout.content}
      keyboardShouldPersistTaps="handled">
      <ThemedText type="smallBold">Username</ThemedText>
      <TextInput
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="username"
        style={inputStyle}
      />
      <ThemedText type="smallBold">Password</ThemedText>
      <TextInput
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        textContentType="password"
        onSubmitEditing={submit}
        style={inputStyle}
      />
      {error && (
        <ThemedText type="small" themeColor="danger">
          {error}
        </ThemedText>
      )}
      <Button
        title={busy ? 'Signing in…' : 'Sign in'}
        variant="primary"
        disabled={busy || !username || !password}
        onPress={submit}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  input: {
    borderRadius: 10,
    padding: Spacing.three,
    fontSize: 16,
  },
});
