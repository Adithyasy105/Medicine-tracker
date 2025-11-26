import React, { useMemo, useState, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, RefreshControl, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMedicines } from '../hooks/useMedicines';
import { useProfiles } from '../hooks/useProfiles';
import { formatTime12Hour } from '../utils/time';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { supabase } from '../lib/supabase';

export const DashboardScreen = () => {
  const navigation = useNavigation();
  const { medicines, refresh } = useMedicines();
  const { profiles } = useProfiles();
  const [refreshing, setRefreshing] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      refresh();
      supabase.auth.getUser().then(({ data }) => {
        setUserEmail(data?.user?.email || '');
      });
    }, [])
  );

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
        },
      },
    ]);
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    if (hour < 21) return 'Good Evening';
    return 'Good Night';
  };

  const getSection = (time) => {
    const [hour] = time.split(':').map(Number);
    if (hour >= 5 && hour < 12) return 'Morning';
    if (hour >= 12 && hour < 17) return 'Afternoon';
    if (hour >= 17 && hour < 21) return 'Evening';
    return 'Evening';
  };

  const stats = useMemo(() => {
    const counts = { Morning: 0, Afternoon: 0, Evening: 0 };
    medicines.forEach((med) => {
      (med.times || []).forEach((time) => {
        let section = getSection(time);
        if (section === 'Night') section = 'Evening'; // Merge Night into Evening
        if (counts[section] !== undefined) {
          counts[section]++;
        }
      });
    });
    return [
      { label: 'Morning', count: counts.Morning, icon: 'sunny-outline', color: '#f59e0b' },
      { label: 'Afternoon', count: counts.Afternoon, icon: 'partly-sunny-outline', color: '#f97316' },
      { label: 'Evening', count: counts.Evening, icon: 'moon-outline', color: '#6366f1' },
    ];
  }, [medicines]);

  const upcomingReminders = useMemo(() => {
    const all = medicines.flatMap((medicine, medIndex) =>
      (medicine.times ?? []).map((time, timeIndex) => {
        const [hour, minute] = time.split(':').map(Number);
        return {
          id: `${medicine.id}-${medIndex}-${time}-${timeIndex}`,
          label: medicine.name,
          profile: medicine.profiles?.display_name ?? 'Family',
          time,
          sortValue: hour * 60 + minute,
          medicine: medicine,
        };
      }),
    );
    return all.sort((a, b) => a.sortValue - b.sortValue);
  }, [medicines]);

  const handleReminderPress = (reminder) => {
    navigation.navigate('MedicineDetail', {
      medicine: reminder.medicine,
      scheduledTime: reminder.time,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {userEmail ? userEmail.substring(0, 2).toUpperCase() : 'ME'}
            </Text>
          </View>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.userEmail}>{userEmail}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Ionicons name="log-out-outline" size={24} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Stats Row */}
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            {stats.map((stat, index) => (
              <View key={index} style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: stat.color + '20' }]}>
                  <Ionicons name={stat.icon} size={24} color={stat.color} />
                </View>
                <View>
                  <Text style={styles.statCount}>{stat.count}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Scan')}>
              <View style={[styles.actionIcon, { backgroundColor: '#e0f2f1' }]}>
                <Ionicons name="scan" size={28} color="#008080" />
              </View>
              <Text style={styles.actionText}>Scan</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Medicines')}>
              <View style={[styles.actionIcon, { backgroundColor: '#e0e7ff' }]}>
                <Ionicons name="add" size={32} color="#4f46e5" />
              </View>
              <Text style={styles.actionText}>Add</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Family')}>
              <View style={[styles.actionIcon, { backgroundColor: '#fef3c7' }]}>
                <Ionicons name="people" size={28} color="#d97706" />
              </View>
              <Text style={styles.actionText}>Family</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Reminders List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Reminders</Text>
          {upcomingReminders.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>No reminders for today</Text>
            </View>
          ) : (
            upcomingReminders.map((item) => (
              <TouchableOpacity key={item.id} style={styles.reminderCard} onPress={() => handleReminderPress(item)}>
                <View style={styles.reminderTimeContainer}>
                  <Text style={styles.reminderTimeText}>{formatTime12Hour(item.time)}</Text>
                  <View style={styles.timelineLine} />
                </View>
                <View style={styles.reminderContent}>
                  <View style={styles.reminderHeader}>
                    <Text style={styles.reminderName}>{item.label}</Text>
                    <View style={styles.profileBadge}>
                      <Text style={styles.profileBadgeText}>{item.profile}</Text>
                    </View>
                  </View>
                  <Text style={styles.reminderSubtext}>Scheduled dose</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Chat FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('CareChat')}
      >
        <Ionicons name="chatbubble-ellipses" size={28} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    backgroundColor: '#fff',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#008080',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e0f2f1',
  },
  avatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  greeting: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  userEmail: {
    fontSize: 12,
    color: '#6b7280',
  },
  logoutButton: {
    padding: 8,
    backgroundColor: '#fee2e2',
    borderRadius: 12,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  statsContainer: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 18, // Increased from 12
    paddingVertical: 20, // Added for extra height
    borderRadius: 20, // Increased radius slightly
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  statIcon: {
    width: 40, // Increased from 40
    height: 40, // Increased from 40
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statCount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1f2937',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 16,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  actionIcon: {
    width: '100%',
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
  },
  reminderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  reminderTimeContainer: {
    alignItems: 'center',
    marginRight: 16,
    width: 60,
  },
  reminderTimeText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#008080',
  },
  timelineLine: {
    width: 2,
    height: 20,
    backgroundColor: '#e5e7eb',
    marginTop: 4,
    borderRadius: 1,
  },
  reminderContent: {
    flex: 1,
    gap: 4,
  },
  reminderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginRight: 8,
  },
  reminderName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  profileBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  profileBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6b7280',
  },
  reminderSubtext: {
    fontSize: 13,
    color: '#9ca3af',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    borderStyle: 'dashed',
  },
  emptyText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#008080',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#008080',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});
