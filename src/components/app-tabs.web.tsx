import { TabList, Tabs, TabSlot, TabTrigger } from 'expo-router/ui';
import React from 'react';
import { Pressable, StyleSheet, View, useColorScheme } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={styles.tabSlot} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="index" href="/" asChild>
            <TabButton>Home</TabButton>
          </TabTrigger>
          <TabTrigger name="explore" href="/explore" asChild>
            <TabButton>Explore</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, isFocused, ...props }: any) {
  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={styles.tabButtonView}>
        <ThemedText type="small" themeColor={isFocused ? 'text' : 'textSecondary'}>
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export function CustomTabList(props: any) {
  const scheme = useColorScheme();
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];

  return (
    <View {...props} style={styles.tabListContainer}>
      <View
        style={[
          styles.tabList,
          {
            backgroundColor: colors.background,
            borderColor: colors.backgroundSelected,
          },
        ]}>
        {props.children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabSlot: {
    height: '100%',
  },
  tabListContainer: {
    position: 'absolute',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    bottom: 40,
  },
  tabList: {
    display: 'flex',
    flexDirection: 'row',
    borderRadius: 100,
    borderWidth: 1,
    padding: 6,
    gap: 6,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
  },
  tabButtonView: {
    display: 'flex',
    borderRadius: 100,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  pressed: {
    opacity: 0.7,
  },
});
