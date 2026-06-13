import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import TabNavigator from './src/navigation/TabNavigator';
import { COLORS } from './src/utils/colors';

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: COLORS.bg,
    card: COLORS.card,
    border: COLORS.border,
    text: COLORS.text,
    primary: COLORS.green,
  },
};

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer theme={theme}>
        <TabNavigator />
      </NavigationContainer>
      <StatusBar style="light" />
    </GestureHandlerRootView>
  );
}
