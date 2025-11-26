import 'react-native-url-polyfill/auto';
import React from 'react';
import { ActivityIndicator, StatusBar } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/providers/AuthProvider';
import { AuthScreen } from './src/screens/AuthScreen';
import { SignupScreen } from './src/screens/SignupScreen';
import { ForgotPasswordScreen } from './src/screens/ForgotPasswordScreen';
import { ResetPasswordScreen } from './src/screens/ResetPasswordScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { MedicineFormScreen } from './src/screens/MedicineFormScreen';
import { MedicineDetailScreen } from './src/screens/MedicineDetailScreen';
import { ScanScreen } from './src/screens/ScanScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { MedicinesScreen } from './src/screens/MedicinesScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { FamilyOverviewScreen } from './src/screens/FamilyOverviewScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const MainTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: '#2563eb',
      tabBarInactiveTintColor: '#9ca3af',
      tabBarStyle: { paddingBottom: 12, paddingTop: 6, height: 70, marginBottom: 10 },
      tabBarIcon: ({ color, size }) => {
        const map = {
          Overview: 'home-outline',
          Medicines: 'medkit-outline',
          Family: 'people-outline',
          Profiles: 'person-outline',
          CareChat: 'chatbubble-ellipses-outline',
        };
        return <Ionicons name={map[route.name]} size={size} color={color} />;
      },
    })}
  >
    <Tab.Screen name="Overview" component={DashboardScreen} options={{ title: 'Dashboard' }} />
    <Tab.Screen name="Medicines" component={MedicinesScreen} />
    <Tab.Screen name="Family" component={FamilyOverviewScreen} options={{ title: 'Family' }} />
    <Tab.Screen name="Profiles" component={ProfileScreen} />
    <Tab.Screen name="CareChat" component={ChatScreen} options={{ title: 'Care AI' }} />
  </Tab.Navigator>
);

const AppNavigator = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  const linking = {
    prefixes: ['medicinetracker://', 'https://medicinetracker.app'],
    config: {
      screens: {
        Auth: 'auth',
        Signup: 'signup',
        ForgotPassword: 'forgot-password',
        ResetPassword: 'reset-password',
        MainTabs: {
          screens: {
            Overview: 'overview',
            Medicines: 'medicines',
            Family: 'family',
            Profiles: 'profiles',
            CareChat: 'chat',
          },
        },
        MedicineForm: 'medicine-form',
        MedicineDetail: 'medicine/:id',
        Scan: 'scan',
      },
    },
  };

  return (
    <NavigationContainer linking={linking}>
      {user ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen name="MedicineForm" component={MedicineFormScreen} options={{ presentation: 'modal' }} />
          <Stack.Screen name="MedicineDetail" component={MedicineDetailScreen} />
          <Stack.Screen name="Scan" component={ScanScreen} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Auth" component={AuthScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar barStyle="dark-content" />
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
