import React from 'react';
import { StyleSheet, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import HomeScreen from '../screens/HomeScreen';
import CheckInScreen from '../screens/CheckInScreen';
import MetricsScreen from '../screens/MetricsScreen';
import BrainScreen from '../screens/BrainScreen';
import HistoryScreen from '../screens/HistoryScreen';
import MessageHistoryScreen from '../screens/MessageHistoryScreen';
import { useTheme } from '../theme/ThemeContext';

const Tab = createBottomTabNavigator();

const ICONS: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  Home: 'home-outline',
  'Check-In': 'video-outline',
  Metrics: 'chart-line',
  Brain: 'brain',
  History: 'history',
  Messages: 'message-text-outline',
};

const LABELS: Record<string, string> = {
  Messages: 'Msg History',
};

export default function TabNavigator() {
  const { colors, isDark } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.green,
        tabBarInactiveTintColor: colors.textDim,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarBackground: () => (
          <>
            <BlurView intensity={50} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
            <View style={[StyleSheet.absoluteFill, { borderTopWidth: 1, borderTopColor: colors.border }]} />
          </>
        ),
        tabBarIcon: ({ color, size }: { color: string; size: number }) => (
          <MaterialCommunityIcons name={ICONS[route.name]} size={size} color={color} />
        ),
        tabBarLabel: LABELS[route.name] ?? route.name,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Check-In" component={CheckInScreen} />
      <Tab.Screen name="Metrics" component={MetricsScreen} />
      <Tab.Screen name="Brain" component={BrainScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Messages" component={MessageHistoryScreen} />
    </Tab.Navigator>
  );
}
