import React, { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TextInput, View, Image, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Ionicons } from '@expo/vector-icons';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

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
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setImage(result.assets[0]);
        analyzeImage(result.assets[0].base64);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to capture image.');
    }
  };

  const analyzeImage = async (base64) => {
    try {
      setAnalyzing(true);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const prompt = `Analyze this medicine label/package. Extract the following details in JSON format:
      - name (medicine name)
      - brand (manufacturer or brand name)
      - dosage (strength e.g. 500mg)
      - form (Tablet, Capsule, Syrup, Injection, Cream, Drops, Inhaler)
      - quantity (total count if visible)
      - expiry_date (YYYY-MM-DD)
      - instructions (e.g. "After food", "With water")
      - purpose (what is it used for? e.g. "Pain relief", "Fever")
      - frequency (how often? e.g. "Twice a day")
      
      Return ONLY valid JSON. If a field is not found, use null.`;

      const imagePart = {
        inlineData: {
          data: base64,
          mimeType: 'image/jpeg',
        },
      };

      const result = await model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const text = response.text();
      const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const data = JSON.parse(jsonStr);

      // Map AI fields to Form fields
      const mappedData = {
        ...data,
        notes: data.purpose ? `Used for: ${data.purpose}\n${data.frequency || ''}` : data.notes,
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
