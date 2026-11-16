import { DarkTheme, DefaultTheme, SplashScreen, Stack, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';
import '@/lib/live';
import { useSession } from '@/lib/session';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const { loading, token } = useSession();

  if (loading) return null;
  SplashScreen.hide();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Protected guard={!!token}>
          <Stack.Screen name="index" options={{ title: 'Projects' }} />
          <Stack.Screen name="capture" options={{ title: 'Capture' }} />
          <Stack.Screen name="dashboard" options={{ title: 'Office dashboard' }} />
          <Stack.Screen name="settings" options={{ title: 'Settings' }} />
          <Stack.Screen name="projects/[id]" />
        </Stack.Protected>
        <Stack.Protected guard={!token}>
          <Stack.Screen name="sign-in" options={{ title: 'Sign in' }} />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}
