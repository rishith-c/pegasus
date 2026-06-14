// Bottom tab navigation for Pegasus. Owned by Wesley (visual layer).
// Dark, minimal, the active tab glows in its accent. Screens are built by
// other agents under src/screens.
import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Svg, { Path, Circle } from "react-native-svg";

import { COLORS } from "../utils/colors";

import HomeScreen from "../screens/HomeScreen";
import ChatScreen from "../screens/ChatScreen";
import MetricsScreen from "../screens/MetricsScreen";
import BrainScreen from "../screens/BrainScreen";
import HistoryScreen from "../screens/HistoryScreen";

type TabParamList = {
  Home: undefined;
  Talk: undefined;
  Metrics: undefined;
  Brain: undefined;
  History: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

// Minimal line icons drawn with SVG so we don't depend on an icon font.
function TabIcon({ name, color }: { name: keyof TabParamList; color: string }) {
  const stroke = color;
  const sw = 1.8;
  switch (name) {
    case "Home":
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Path
            d="M3 10.5L12 3l9 7.5"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d="M5 9.5V20h14V9.5"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case "Talk":
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Path
            d="M4 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H9l-4 4V6z"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
          <Path
            d="M8.5 10h7M8.5 13h4"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </Svg>
      );
    case "Metrics":
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Path
            d="M5 19V9M12 19V5M19 19v-6"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinecap="round"
          />
        </Svg>
      );
    case "Brain":
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Path
            d="M9 4.5A2.5 2.5 0 006.5 7 2.5 2.5 0 004 9.5 2.5 2.5 0 005.5 12 2.5 2.5 0 004 14.5 2.5 2.5 0 006.5 17 2.5 2.5 0 009 19.5V4.5z"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
          <Path
            d="M15 4.5A2.5 2.5 0 0117.5 7 2.5 2.5 0 0120 9.5 2.5 2.5 0 0118.5 12 2.5 2.5 0 0120 14.5 2.5 2.5 0 0117.5 17 2.5 2.5 0 0115 19.5V4.5z"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinejoin="round"
          />
        </Svg>
      );
    case "History":
      return (
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={8.5} stroke={stroke} strokeWidth={sw} />
          <Path
            d="M12 7.5V12l3 2"
            stroke={stroke}
            strokeWidth={sw}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    default:
      return null;
  }
}

// Per-tab accent used for the active glow. Brain glows blue per design spec.
const TAB_ACCENT: Record<keyof TabParamList, string> = {
  Home: COLORS.green,
  Talk: COLORS.blue,
  Metrics: COLORS.green,
  Brain: COLORS.blue,
  History: COLORS.green,
};

const LABELS: Record<keyof TabParamList, string> = {
  Home: "Home",
  Talk: "Talk",
  Metrics: "Metrics",
  Brain: "Brain",
  History: "History",
};

export default function TabNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Home"
      screenOptions={({ route }) => {
        const name = route.name as keyof TabParamList;
        const accent = TAB_ACCENT[name];
        return {
          headerShown: false,
          tabBarShowLabel: true,
          tabBarActiveTintColor: accent,
          tabBarInactiveTintColor: COLORS.textDim,
          tabBarStyle: styles.tabBar,
          tabBarItemStyle: styles.tabItem,
          tabBarLabel: ({ focused }) => (
            <Text
              style={[
                styles.label,
                { color: focused ? accent : COLORS.textDim },
              ]}
              numberOfLines={1}
            >
              {LABELS[name]}
            </Text>
          ),
          tabBarIcon: ({ focused }) => (
            <View
              style={[
                styles.iconWrap,
                focused && {
                  shadowColor: accent,
                  shadowOpacity: 0.45,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 0 },
                },
              ]}
            >
              <TabIcon
                name={name}
                color={focused ? accent : COLORS.textDim}
              />
            </View>
          ),
        };
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Talk" component={ChatScreen} />
      <Tab.Screen name="Metrics" component={MetricsScreen} />
      <Tab.Screen name="Brain" component={BrainScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.card,
    borderTopColor: COLORS.border,
    borderTopWidth: 1,
    height: Platform.OS === "ios" ? 88 : 68,
    paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 28 : 10,
    // Soft upward elevation so the bar reads as a floating surface on the
    // light canvas (Apple-style).
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -3 },
    elevation: 8,
  },
  tabItem: {
    paddingTop: 2,
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
    height: 26,
  },
  label: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.3,
    marginTop: 2,
  },
});
