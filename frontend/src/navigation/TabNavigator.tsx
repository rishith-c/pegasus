import React from 'react';
import { Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/HomeScreen';
import StimulusScreen from '../screens/StimulusScreen';
import CheckInScreen from '../screens/CheckInScreen';
import MetricsScreen from '../screens/MetricsScreen';
import BrainScreen from '../screens/BrainScreen';
import HistoryScreen from '../screens/HistoryScreen';
import { COLORS } from '../utils/colors';

const Tab = createBottomTabNavigator();

const ICONS: Record<string, string> = {
  Home: '🏠',
  'Pulse Check': '💬',
  'Check-In': '🎥',
  Metrics: '📊',
  Brain: '🧠',
  History: '🕓',
};

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.green,
        tabBarInactiveTintColor: COLORS.textDim,
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopColor: COLORS.border,
        },
        tabBarIcon: ({ color }: { color: string }) => (
          <Text style={{ fontSize: 20, color }}>{ICONS[route.name]}</Text>
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Pulse Check" component={StimulusScreen} />
      <Tab.Screen name="Check-In" component={CheckInScreen} />
      <Tab.Screen name="Metrics" component={MetricsScreen} />
      <Tab.Screen name="Brain" component={BrainScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
    </Tab.Navigator>
  );
}
