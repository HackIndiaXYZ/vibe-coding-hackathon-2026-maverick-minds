import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { View, StyleSheet } from 'react-native';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { FloatingTabBar, TabName } from '@/components/floating-tab-bar';
import { useFonts, VampiroOne_400Regular } from '@expo-google-fonts/vampiro-one';
import { CarterOne_400Regular } from '@expo-google-fonts/carter-one';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

SplashScreen.preventAutoHideAsync();

// Screens that show the tab bar
const TAB_SCREENS = ['/explore', '/camera', '/chatbot', '/settings', '/'];

export default function RootLayout() {
  const [loaded, error] = useFonts({
    VampiroOne: VampiroOne_400Regular,
    CarterOne:  CarterOne_400Regular,
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  const router   = useRouter();
  const pathname = usePathname();

  // Map pathname → active tab (vault is a sub-screen of camera, not a tab)
  const activeTab: TabName =
    pathname.startsWith('/settings') ? 'settings' :
    pathname.startsWith('/camera')   ? 'camera'   :
    pathname.startsWith('/chatbot')  ? 'chatbot'  :
    'explore';

  // Hide tab bar on vault screen (it's a camera sub-screen)
  const showTabBar = !pathname.startsWith('/vault');

  const handleTabPress = (tab: TabName) => {
    switch (tab) {
      case 'explore':  router.replace('/explore');  break;
      case 'camera':   router.replace('/camera');   break;
      case 'chatbot':  router.replace('/chatbot');  break;
      case 'settings': router.replace('/settings'); break;
    }
  };

  if (!loaded && !error) return null;

  return (
    <View style={styles.root}>
      <AnimatedSplashOverlay />
      <Stack
        screenOptions={{
          headerShown: false,
          animation:   'fade',
        }}
      >
        <Stack.Screen name="explore"  />
        <Stack.Screen name="camera"   />
        <Stack.Screen name="chatbot"  />
        <Stack.Screen name="settings" />
        {/* vault is pushed on top of camera — no tab bar */}
        <Stack.Screen
          name="vault"
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="index"    />
      </Stack>
      {/* Tab bar hidden when inside vault */}
      {showTabBar && (
        <FloatingTabBar activeTab={activeTab} onTabPress={handleTabPress} />
      )}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
