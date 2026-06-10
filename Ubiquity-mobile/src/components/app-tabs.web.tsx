/**
 * AppTabs (web) — 2-tab floating pill, no home tab
 */
import React from 'react';
import { Tabs, TabList, TabTrigger, TabSlot, TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, View, StyleSheet, Text } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%', flex: 1 }} />
      <TabList asChild>
        <FloatingPill>
          <TabTrigger name="explore" href="/explore" asChild>
            <PillTab icon="⬡" label="Files" />
          </TabTrigger>
          <TabTrigger name="settings" href="/settings" asChild>
            <PillTab icon="◎" label="Settings" />
          </TabTrigger>
        </FloatingPill>
      </TabList>
    </Tabs>
  );
}

function FloatingPill({ children, ...props }: any) {
  const theme = useTheme();
  return (
    <View {...props} style={styles.pillContainer} pointerEvents="box-none">
      <View style={[styles.pill, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        {children}
      </View>
    </View>
  );
}

const PillTab = React.forwardRef<any, TabTriggerSlotProps & { icon: string; label: string }>(
  ({ icon, label, isFocused, onPress, ...props }, ref) => {
    const theme = useTheme();
    return (
      <Pressable
        ref={ref}
        onPress={onPress}
        {...props}
        style={({ pressed }) => [
          styles.tab,
          isFocused && { backgroundColor: theme.text },
          { opacity: pressed ? 0.75 : 1 },
        ]}
      >
        <Text style={{ fontSize: 14, color: isFocused ? theme.background : theme.textMuted }}>
          {icon}
        </Text>
        <Text style={[styles.tabLabel, { color: isFocused ? theme.background : theme.textMuted }]}>
          {label}
        </Text>
      </Pressable>
    );
  },
);

const styles = StyleSheet.create({
  pillContainer: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  pill: {
    flexDirection: 'row',
    borderRadius: 40,
    borderWidth: 1,
    paddingHorizontal: 4,
    paddingVertical: 4,
    gap: 2,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 32,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.1,
  },
});
