/**
 * FloatingTabBar — 4 tabs: Files · Camera · AI Chat · Settings
 * Vault is accessed from inside the Camera screen, not a top-level tab.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';

export type TabName = 'explore' | 'camera' | 'chatbot' | 'settings';

interface TabDef {
  name:  TabName;
  label: string;
  glyph: string;
}

const TABS: TabDef[] = [
  { name: 'explore',  label: 'Files',    glyph: '⊟' },
  { name: 'camera',   label: 'Camera',   glyph: '⊙' },
  { name: 'chatbot',  label: 'AI Chat',  glyph: '◌' },
  { name: 'settings', label: 'More',     glyph: '≡' },
];

interface FloatingTabBarProps {
  activeTab:  TabName;
  onTabPress: (tab: TabName) => void;
}

export function FloatingTabBar({ activeTab, onTabPress }: FloatingTabBarProps) {
  const theme  = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = insets.bottom > 0 ? insets.bottom : 8;

  const dotX      = useRef(new Animated.Value(0)).current;
  const activeIdx = TABS.findIndex(t => t.name === activeTab);

  useEffect(() => {
    Animated.spring(dotX, {
      toValue: activeIdx,
      damping: 18, stiffness: 200, mass: 0.6,
      useNativeDriver: true,
    }).start();
  }, [activeIdx]);

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: theme.backgroundElement,
          borderTopColor:  theme.borderSubtle,
          paddingBottom:   bottomPad,
        },
      ]}
    >
      {TABS.map((tab) => {
        const active    = activeTab === tab.name;
        const iconColor = active ? theme.text : theme.textMuted;

        return (
          <Pressable
            key={tab.name}
            onPress={() => onTabPress(tab.name)}
            style={({ pressed }) => [styles.tabBtn, { opacity: pressed ? 0.6 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected: active }}
          >
            {/* Amber accent line above active tab */}
            <View style={[
              styles.accentLine,
              { backgroundColor: active ? theme.accentYellow : 'transparent' },
            ]} />

            <Text style={[styles.icon, { color: iconColor, fontWeight: active ? '700' : '400' }]}>
              {tab.glyph}
            </Text>

            <Text style={[
              styles.label,
              { color: iconColor },
              active && styles.labelActive,
            ]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position:       'absolute',
    left:           0,
    right:          0,
    bottom:         0,
    flexDirection:  'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    zIndex:         999,
    paddingTop:     10,
  },
  tabBtn: {
    flex:            1,
    alignItems:      'center',
    justifyContent:  'center',
    paddingVertical: 4,
    gap:             3,
    position:        'relative',
  },
  accentLine: {
    position:     'absolute',
    top:          -10,
    width:        24,
    height:       3,
    borderRadius: 2,
  },
  icon: {
    fontSize:   20,
    lineHeight: 24,
  },
  label: {
    fontSize:      10,
    letterSpacing: 0.2,
    fontWeight:    '500',
  },
  labelActive: {
    fontWeight: '700',
  },
});
