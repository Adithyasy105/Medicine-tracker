import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { MedicineCard } from '../components/MedicineCard';
import { ProfileSelector } from '../components/ProfileSelector';
import { useMedicines } from '../hooks/useMedicines';
import { useProfiles } from '../hooks/useProfiles';

export const MedicinesScreen = () => {
  const navigation = useNavigation();
  const { medicines, loading, refresh } = useMedicines();
  const { profiles } = useProfiles();
  const [selectedProfile, setSelectedProfile] = useState(null);

  const activeList = useMemo(
    () => (selectedProfile ? medicines.filter((m) => m.profile_id === selectedProfile) : medicines),
    [medicines, selectedProfile],
  );

  const totalQuantity = useMemo(
    () => medicines.reduce((sum, med) => sum + (med.quantity ?? 0), 0),
    [medicines],
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.hero}>
        <View>
          <Text style={styles.heroTitle}>Medicine cabinet</Text>
          <Text style={styles.heroSubtitle}>
            {medicines.length} tracked • {totalQuantity} doses available
          </Text>
        </View>
        <Ionicons name="medkit-outline" size={32} color="#fff" />
      </View>

      <ProfileSelector
        profiles={profiles}
        selectedProfileId={selectedProfile}
        onSelect={(profileId) => setSelectedProfile((curr) => (curr === profileId ? null : profileId))}
      />

      <FlatList
        data={activeList}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        renderItem={({ item }) => (
          <MedicineCard medicine={item} onPress={() => navigation.navigate('MedicineDetail', { medicine: item })} />
        )}
        ListEmptyComponent={
          !loading && (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No medicines here yet</Text>
              <Text style={styles.emptyText}>Use the buttons below to add your first medicine or scan a label.</Text>
            </View>
          )
        }
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
        contentContainerStyle={styles.list}
      />

      <View style={styles.actionBar}>
        <Pressable style={[styles.actionButton, styles.primary]} onPress={() => navigation.navigate('MedicineForm')}>
          <Ionicons name="add" color="#fff" size={20} />
          <Text style={styles.actionText}>Add medicine</Text>
        </Pressable>
        <Pressable style={[styles.actionButton, styles.secondary]} onPress={() => navigation.navigate('Scan')}>
          <Ionicons name="scan-outline" color="#008080" size={20} />
          <Text style={[styles.actionText, styles.secondaryText]}>Scan label</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8',
    paddingHorizontal: 16,
    paddingTop: 24, // Added top padding
  },
  hero: {
    backgroundColor: '#008080',
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  heroSubtitle: {
    color: '#e0f2f1',
  },
  list: {
    paddingBottom: 120,
  },
  empty: {
    marginTop: 48,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    color: '#1f2937',
  },
  emptyText: {
    color: '#6b7280',
    textAlign: 'center',
  },
  actionBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20, // Raised action bar further
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 14,
    gap: 8,
  },
  primary: {
    backgroundColor: '#008080',
  },
  secondary: {
    backgroundColor: '#e0f2f1',
  },
  actionText: {
    fontWeight: '600',
    color: '#fff',
  },
  secondaryText: {
    color: '#008080',
  },
});
