import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View, Image, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { supabase, storageBucket } from '../lib/supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

export const ScanScreen = ({ navigation }) => {
  const [image, setImage] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        quality: 0.5,
      });

      if (!result.canceled && result.assets[0]) {
        setImage(result.assets[0]);
        analyzeImage(result.assets[0].uri);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to capture image.');
    }
  };

  const analyzeImage = async (uri) => {
    try {
      setAnalyzing(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const fileExt = uri.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Upload image to Supabase Storage
      // Use FileSystem + ArrayBuffer (most reliable in Expo)
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
      const arrayBuffer = decode(base64);

      const { error: uploadError } = await supabase.storage
        .from(storageBucket)
        .upload(filePath, arrayBuffer, {
          contentType: fileExt === 'png' ? 'image/png' : 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Call Edge Function
      const { data, error: funcError } = await supabase.functions.invoke('scanMedicine', {
        body: { imagePath: filePath },
      });

      if (funcError) throw funcError;

      const { parsed } = data;

      // Map AI fields to Form fields
      const mappedData = {
        ...parsed,
        notes: parsed.purpose ? `Used for: ${parsed.purpose}\n${parsed.frequency || ''}` : parsed.notes,
      };

      setParsed(mappedData);
    } catch (err) {
      Alert.alert('Analysis Failed', 'Could not extract information. Please try again.');
      console.error(err);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleContinue = () => {
    navigation.navigate('MedicineForm', { prefill: parsed });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Scan Label</Text>
          <Text style={styles.subtitle}>Take a photo of the medicine box or strip.</Text>
        </View>

        {!image ? (
          <TouchableOpacity style={styles.cameraBox} onPress={pickImage}>
            <Ionicons name="camera" size={48} color="#008080" />
            <Text style={styles.cameraText}>Tap to Capture</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.previewContainer}>
            <Image source={{ uri: image.uri }} style={styles.previewImage} />
            <TouchableOpacity style={styles.retakeBtn} onPress={pickImage}>
              <Text style={styles.retakeText}>Retake</Text>
            </TouchableOpacity>
          </View>
        )}

        {analyzing && (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#008080" />
            <Text style={styles.loadingText}>Analyzing medicine details...</Text>
          </View>
        )}

        {parsed && !analyzing && (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>Extracted Information</Text>

            <View style={styles.fieldRow}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                value={parsed.name}
                onChangeText={(v) => setParsed(p => ({ ...p, name: v }))}
              />
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.label}>Purpose / Notes</Text>
              <TextInput
                style={styles.input}
                value={parsed.notes}
                multiline
                onChangeText={(v) => setParsed(p => ({ ...p, notes: v }))}
              />
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.label}>Dosage</Text>
              <TextInput
                style={styles.input}
                value={parsed.dosage}
                onChangeText={(v) => setParsed(p => ({ ...p, dosage: v }))}
              />
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.label}>Instructions</Text>
              <TextInput
                style={styles.input}
                value={parsed.instructions}
                onChangeText={(v) => setParsed(p => ({ ...p, instructions: v }))}
              />
            </View>
            <View style={styles.fieldRow}>
              <Text style={styles.label}>Expiry</Text>
              <TextInput
                style={styles.input}
                value={parsed.expiry_date}
                onChangeText={(v) => setParsed(p => ({ ...p, expiry_date: v }))}
              />
            </View>

            <TouchableOpacity style={styles.useBtn} onPress={handleContinue}>
              <Text style={styles.useBtnText}>Use These Details</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f0f4f8' },
  container: { padding: 20, gap: 20 },
  header: { gap: 4 },
  title: { fontSize: 28, fontWeight: '700', color: '#1f2937' },
  subtitle: { color: '#6b7280', fontSize: 16 },
  cameraBox: {
    height: 200,
    backgroundColor: '#e0f2f1',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#008080',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  cameraText: { color: '#008080', fontWeight: '600', fontSize: 16 },
  previewContainer: { alignItems: 'center', gap: 12 },
  previewImage: { width: '100%', height: 200, borderRadius: 20, resizeMode: 'cover' },
  retakeBtn: { padding: 8 },
  retakeText: { color: '#6b7280', fontWeight: '600' },
  loadingBox: { alignItems: 'center', padding: 20, gap: 12 },
  loadingText: { color: '#008080', fontSize: 16, fontWeight: '500' },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  resultTitle: { fontSize: 18, fontWeight: '700', color: '#008080' },
  fieldRow: { gap: 6 },
  label: { fontSize: 12, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: '#1f2937',
    backgroundColor: '#f9fafb',
  },
  useBtn: {
    backgroundColor: '#008080',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 8,
    marginTop: 8,
  },
  useBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
