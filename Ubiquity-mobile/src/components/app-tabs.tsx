/**
 * AppTabs (native) — wraps expo-router Tabs with a floating pill tab bar
 *
 * The tab bar is hidden (tabBarStyle: {display: 'none'}) and we render
 * our own FloatingTabBar absolutely positioned over the content.
 */
import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { Tabs, useRouter, usePathname } from 'expo-router';
import { FloatingTabBar, TabName } from './floating-tab-bar';
import { useTheme } from '@/hooks/use-theme';

const HIDDEN_TAB_BAR = {
  display: 'none' as const,
};

export default function AppTabs() {
  const theme = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  // Determine active tab from pathname
  const activeTab: TabName = pathname === '/explore' ? 'explore' : 'camera';

  const handleTabPress = useCallback(
    (tab: TabName) => {
      if (tab === 'camera') router.navigate('/camera');
      else router.navigate('/explore');
    },
    [router],
  );

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: HIDDEN_TAB_BAR,
        }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="explore" />
      </Tabs>

      {/* Floating pill tab bar rendered on top of all content */}
      <FloatingTabBar activeTab={activeTab} onTabPress={handleTabPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
