import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export const OfflineNotice = ({ isOffline }) => {
  if (!isOffline) return null;
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Offline mode — changes will sync when online.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f0ad4e',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  text: {
    color: '#442200',
    fontWeight: '600',
    textAlign: 'center',
  },
});

