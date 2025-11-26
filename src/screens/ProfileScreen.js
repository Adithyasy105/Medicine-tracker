import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View, Alert, TouchableOpacity, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useProfiles } from '../hooks/useProfiles';
import { Ionicons } from '@expo/vector-icons';

export const ProfileScreen = () => {
  const { profiles, createProfile, deleteProfile } = useProfiles();
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState({ display_name: '', age: '', relation: '' });
  const [saving, setSaving] = useState(false);

  const handleDelete = (profile) => {
    Alert.alert(
      'Delete Profile',
      `Are you sure you want to delete ${profile.display_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteProfile(profile.id);
            } catch (err) {
              Alert.alert('Error', 'Failed to delete profile');
            }
          }
        }
      ]
    );
  };

  const handleSave = async () => {
    if (!form.display_name.trim()) {
      Alert.alert('Validation', 'Name is required');
      return;
    }
    try {
      setSaving(true);
      await createProfile({
        display_name: form.display_name.trim(),
        age: form.age ? Number(form.age) : null,
        relation: form.relation,
      });
      setForm({ display_name: '', age: '', relation: '' });
      setModalVisible(false);
      Alert.alert('Success', 'Profile added successfully');
    } catch (err) {
      Alert.alert('Error', `Failed to add profile: ${err.message || JSON.stringify(err)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Profiles</Text>
          <Text style={styles.headerSubtitle}>Manage family members</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {profiles.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="person-add-outline" size={48} color="#008080" />
            </View>
            <Text style={styles.emptyStateTitle}>No Profiles</Text>
            <Text style={styles.emptyStateText}>Add a profile to start tracking medications for your family.</Text>
            <TouchableOpacity style={styles.emptyCta} onPress={() => setModalVisible(true)}>
              <Text style={styles.emptyCtaText}>Add First Profile</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.list}>
            {profiles.map((profile, index) => (
              <View key={`${profile.id}-${index}`} style={styles.profileCard}>
                <View style={styles.profileLeft}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {profile.display_name ? profile.display_name.substring(0, 2).toUpperCase() : '??'}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.profileName}>{profile.display_name}</Text>
                    <View style={styles.metaRow}>
                      <Text style={styles.profileRelation}>{profile.relation || 'Family'}</Text>
                      {profile.age && (
                        <>
                          <Text style={styles.metaDot}>•</Text>
                          <Text style={styles.profileAge}>{profile.age} years</Text>
                        </>
                      )}
                    </View>
                  </View>
                </View>
                <TouchableOpacity onPress={() => handleDelete(profile)} style={styles.deleteButton}>
                  <Ionicons name="trash-outline" size={20} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Add Profile Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Profile</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  placeholder="e.g. Enter the Name"
                  style={styles.input}
                  value={form.display_name}
                  onChangeText={(v) => setForm((prev) => ({ ...prev, display_name: v }))}
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Relationship</Text>
                  <TextInput
                    placeholder="e.g. Father"
                    style={styles.input}
                    value={form.relation}
                    onChangeText={(v) => setForm((prev) => ({ ...prev, relation: v }))}
                  />
                </View>
                <View style={[styles.inputGroup, { width: 100 }]}>
                  <Text style={styles.label}>Age</Text>
                  <TextInput
                    placeholder="e.g. 45"
                    keyboardType="numeric"
                    style={styles.input}
                    value={form.age}
                    onChangeText={(v) => setForm((prev) => ({ ...prev, age: v }))}
                  />
                </View>
              </View>

              <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
                <Text style={styles.saveButtonText}>{saving ? 'Creating...' : 'Create Profile'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8f9fa' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1f2937',
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#6b7280',
    marginTop: 4,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#008080',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#008080',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  container: {
    padding: 20,
    paddingBottom: 100,
  },
  list: {
    gap: 16,
  },
  profileCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  profileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#e0f2f1',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#008080',
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  avatarText: {
    color: '#008080',
    fontSize: 18,
    fontWeight: '700',
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  profileRelation: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  metaDot: {
    marginHorizontal: 6,
    color: '#d1d5db',
    fontSize: 10,
  },
  profileAge: {
    fontSize: 13,
    color: '#9ca3af',
  },
  deleteButton: {
    padding: 8,
    backgroundColor: '#fee2e2',
    borderRadius: 12,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    gap: 16,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e0f2f1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    maxWidth: 250,
  },
  emptyCta: {
    marginTop: 8,
    backgroundColor: '#008080',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyCtaText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#1f2937',
    backgroundColor: '#f9fafb',
  },
  row: {
    flexDirection: 'row',
    gap: 16,
  },
  saveButton: {
    backgroundColor: '#008080',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#008080',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
