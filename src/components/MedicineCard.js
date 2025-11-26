import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatTime12Hour } from '../utils/time';

export const MedicineCard = ({ medicine, onPress }) => {
  const refillLow = (medicine.quantity ?? 0) <= (medicine.refill_threshold ?? 0);

  const formattedTimes = Array.isArray(medicine.times)
    ? medicine.times.map(t => formatTime12Hour(t)).join(', ')
    : '';

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.iconWrap}>
        <Ionicons name="medkit" size={20} color="#1d4ed8" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{medicine.name}</Text>
        <Text style={styles.detail}>
          {medicine.dosage ?? 'dose'} • {medicine.form ?? 'form'}
        </Text>
        <Text style={styles.times}>{formattedTimes}</Text>
        <Text style={[styles.quantity, refillLow && styles.alert]}>
          Qty {medicine.quantity ?? 0} • Refill {medicine.refill_threshold ?? 0}
        </Text>
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>
          {(Array.isArray(medicine.profiles) ? medicine.profiles[0]?.display_name : medicine.profiles?.display_name) ?? 'Family'}
        </Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 12,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  detail: {
    fontSize: 14,
    color: '#374151',
  },
  times: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  quantity: {
    fontSize: 12,
    color: '#0284c7',
    marginTop: 6,
  },
  alert: {
    color: '#dc2626',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#eef2ff',
  },
  badgeText: {
    color: '#1d4ed8',
    fontWeight: '600',
  },
});
