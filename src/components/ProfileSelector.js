import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export const ProfileSelector = ({ profiles, selectedProfileId, onSelect }) => {
  if (!profiles?.length) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>No profiles found. Please add a family member in Profiles.</Text>
      </View>
    );
  }
  return (
    <View style={styles.container}>
      {profiles.map((profile, index) => {
        const isSelected = profile.id === selectedProfileId;
        return (
          <Pressable
            key={`${profile.id}-${index}`}
            style={[styles.chip, isSelected && styles.chipSelected]}
            onPress={() => onSelect(profile.id)}
          >
            <Text style={[styles.text, isSelected && styles.textSelected]}>{profile.display_name}</Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff',
    marginRight: 8,
    marginBottom: 8,
  },
  chipSelected: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  text: {
    color: '#333',
    fontWeight: '500',
  },
  textSelected: {
    color: '#fff',
  },
  emptyText: {
    color: '#6b7280',
    fontStyle: 'italic',
    marginBottom: 8,
  },
});

