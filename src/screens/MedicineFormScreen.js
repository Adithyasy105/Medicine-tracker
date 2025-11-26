import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View, Alert, ActivityIndicator, Pressable, Modal, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRoute } from '@react-navigation/native';
import { useMedicines } from '../hooks/useMedicines';
import { scheduleLocalReminder } from '../services/notifications';
import { buildReminderTriggers } from '../utils/time';
import { useProfiles } from '../hooks/useProfiles';
import { ProfileSelector } from '../components/ProfileSelector';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { TimePickerModal } from '../components/TimePickerModal';
import { colors, shadows, borderRadius, spacing } from '../theme/colors';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const defaultForm = {
  name: '',
  brand: '',
  dosage: '',
  form: 'Tablet',
  times: ['08:00'],
  days: ['Everyday'], // 'Everyday' or specific days like 'Mon', 'Tue'
  start_date: '',
  end_date: '',
  unit_per_dose: 1,
  quantity: 0,
  refill_threshold: 5,
  instructions: '',
  expiry_date: '',
  notes: '',
};

const FORM_OPTIONS = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Drops', 'Cream', 'Inhaler', 'Other'];
const INSTRUCTION_OPTIONS = ['Before food', 'After food', 'With water', 'Empty stomach', 'Before sleep'];
const DAYS_OPTIONS = ['Everyday', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const TIME_PRESETS = [
  { label: 'Morning', time: '08:00' },
  { label: 'Noon', time: '13:00' },
  { label: 'Night', time: '20:00' },
];

export const MedicineFormScreen = ({ navigation }) => {
  const route = useRoute();
  const preset = route.params?.prefill ?? {};
  const { profiles } = useProfiles();
  const [form, setForm] = useState({ ...defaultForm, ...preset });
  const { createOrUpdate } = useMedicines();
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [showFormPicker, setShowFormPicker] = useState(false);
  const [showInstructionPicker, setShowInstructionPicker] = useState(false);
  const [datePicker, setDatePicker] = useState({ visible: false, field: null, title: '' });
  const [showTimePicker, setShowTimePicker] = useState(false);

  const openDatePicker = (field, title) => setDatePicker({ visible: true, field, title });

  useEffect(() => {
    if (!form.profile_id && profiles.length) {
      setForm((prev) => ({ ...prev, profile_id: profiles[0].id }));
    }
  }, [profiles, form.profile_id]);

  const isValid = useMemo(
    () => Boolean(form.name) && Boolean(form.dosage) && Boolean(form.profile_id) && form.times.length > 0,
    [form.name, form.dosage, form.profile_id, form.times],
  );

  const handleChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  // Get unit configuration based on medicine form
  const getUnitConfig = () => {
    switch (form.form) {
      case 'Tablet':
      case 'Capsule':
        return { unit: 'tablets', step: 1, doseUnit: 'tablet(s)' };
      case 'Syrup':
        return { unit: 'mL', step: 5, doseUnit: 'mL' };
      case 'Injection':
        return { unit: 'vials', step: 1, doseUnit: 'vial(s)' };
      case 'Drops':
        return { unit: 'drops', step: 1, doseUnit: 'drop(s)' };
      case 'Cream':
      case 'Inhaler':
        return { unit: 'applications', step: 1, doseUnit: 'application(s)' };
      default:
        return { unit: 'units', step: 1, doseUnit: 'unit(s)' };
    }
  };

  const unitConfig = getUnitConfig();

  const toggleDay = (day) => {
    setForm((prev) => {
      const currentDays = prev.days || [];
      if (day === 'Everyday') {
        return { ...prev, days: ['Everyday'] };
      }
      const newDays = currentDays.filter(d => d !== 'Everyday');
      if (newDays.includes(day)) {
        return { ...prev, days: newDays.filter(d => d !== day) };
      } else {
        return { ...prev, days: [...newDays, day] };
      }
    });
  };

  const addTime = (time) => {
    if (!form.times.includes(time)) {
      setForm(prev => ({ ...prev, times: [...prev.times, time].sort() }));
    }
  };

  const removeTime = (time) => {
    setForm(prev => ({ ...prev, times: prev.times.filter(t => t !== time) }));
  };

  const scanMedicine = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission required', 'Camera permission is needed to scan medicines.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        setScanning(true);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const prompt = "Analyze this medicine image. Extract details in JSON: name, brand, dosage, form, expiry_date (YYYY-MM-DD), manufacturer. Return ONLY valid JSON.";

        const imagePart = {
          inlineData: {
            data: result.assets[0].base64,
            mimeType: 'image/jpeg',
          },
        };

        const generatedContent = await model.generateContent([prompt, imagePart]);
        const response = await generatedContent.response;
        const text = response.text();
        const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(jsonStr);

        setForm(prev => ({
          ...prev,
          name: data.name || prev.name,
          brand: data.brand || prev.brand,
          dosage: data.dosage || prev.dosage,
          form: data.form || prev.form,
          expiry_date: data.expiry_date || prev.expiry_date,
        }));
        Alert.alert('Scanned!', 'Medicine details updated from image.');
      }
    } catch (err) {
      console.warn('Scan failed', err);
      Alert.alert('Scan failed', 'Could not analyze the image. Please try again or enter manually.');
    } finally {
      setScanning(false);
    }
  };

  const persist = async () => {
    if (!isValid) {
      Alert.alert('Missing Info', 'Please fill in required fields (Name, Dosage, Profile, at least one Time).');
      return;
    }
    try {
      setSaving(true);
      const payload = {
        ...form,
        times: form.times.filter(Boolean),
        days: form.days.length ? form.days : ['Everyday'],
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        expiry_date: form.expiry_date || null,
      };
      await createOrUpdate(payload);

      // Schedule notifications only if "Everyday" or today matches (simplified logic for now)
      // Real app would need complex scheduling logic for specific days
      const triggers = buildReminderTriggers(payload.times);
      await Promise.all(
        triggers.map((trigger, index) =>
          scheduleLocalReminder({
            id: `${payload.name}-${trigger.hour}-${trigger.minute}-${index}`,
            title: `${payload.name} reminder`,
            body: `Time to take ${payload.dosage} (${form.instructions || 'Take as prescribed'})`,
            trigger,
          }),
        ),
      );
      navigation.goBack();
    } catch (err) {
      console.warn('Failed to save medicine', err);
      Alert.alert('Error', 'Failed to save medicine. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>Add medicine</Text>
          <Pressable style={styles.scanButton} onPress={scanMedicine} disabled={scanning}>
            {scanning ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="camera" size={20} color="#fff" />}
            <Text style={styles.scanButtonText}>{scanning ? 'Scanning...' : 'Scan'}</Text>
          </Pressable>
        </View>

        <ProfileSelector
          profiles={profiles}
          selectedProfileId={form.profile_id}
          onSelect={(profileId) => handleChange('profile_id', profileId)}
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Info</Text>
          <InputWithLabel label="Medicine Name *" placeholder="e.g. Paracetamol" value={form.name} onChangeText={(v) => handleChange('name', v)} />
          <InputWithLabel label="Brand (Optional)" placeholder="e.g. Panadol" value={form.brand} onChangeText={(v) => handleChange('brand', v)} />
          <InputWithLabel label="Dosage *" placeholder="e.g. 500 mg" value={form.dosage} onChangeText={(v) => handleChange('dosage', v)} />

          <View>
            <Text style={styles.label}>Form</Text>
            <Pressable style={styles.dropdownTrigger} onPress={() => setShowFormPicker(true)}>
              <Text style={styles.dropdownText}>{form.form || 'Select Form'}</Text>
              <Ionicons name="chevron-down" size={20} color="#6b7280" />
            </Pressable>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Scheduling</Text>

          <View>
            <Text style={styles.label}>Times *</Text>
            <View style={styles.timeChips}>
              {form.times.map((time) => (
                <View key={time} style={styles.timeChip}>
                  <Text style={styles.timeChipText}>{time}</Text>
                  <TouchableOpacity onPress={() => removeTime(time)}>
                    <Ionicons name="close-circle" size={18} color={colors.primary[700]} />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                style={styles.addTimeButton}
                onPress={() => setShowTimePicker(true)}
              >
                <Ionicons name="add" size={20} color={colors.primary[600]} />
                <Text style={styles.addTimeText}>Add Time</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.presets}>
              {TIME_PRESETS.map(preset => (
                <TouchableOpacity key={preset.label} style={styles.presetChip} onPress={() => addTime(preset.time)}>
                  <Text style={styles.presetText}>+ {preset.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.daysRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {DAYS_OPTIONS.map((day) => {
                const isSelected = form.days?.includes(day);
                return (
                  <TouchableOpacity
                    key={day}
                    style={[styles.dayChip, isSelected && styles.dayChipSelected]}
                    onPress={() => toggleDay(day)}
                  >
                    <Text style={[styles.dayChipText, isSelected && styles.dayChipTextSelected]}>{day}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Inventory & Details</Text>

            <View style={styles.row}>
              <View style={styles.rowItem}>
                <Text style={styles.label}>Total Quantity ({unitConfig.unit})</Text>
                <TextInput
                  style={styles.numberInput}
                  value={String(form.quantity || 0)}
                  onChangeText={(v) => handleChange('quantity', parseInt(v) || 0)}
                  keyboardType="number-pad"
                  placeholder="0"
                />
                <Text style={styles.helperText}>e.g., 30 {unitConfig.unit}</Text>
              </View>
              <View style={[styles.rowItem, styles.rowItemLast]}>
                <Text style={styles.label}>Per Dose ({unitConfig.doseUnit})</Text>
                <TextInput
                  style={styles.numberInput}
                  value={String(form.unit_per_dose || unitConfig.step)}
                  onChangeText={(v) => handleChange('unit_per_dose', parseFloat(v) || unitConfig.step)}
                  keyboardType="decimal-pad"
                  placeholder={String(unitConfig.step)}
                />
                <Text style={styles.helperText}>e.g., 2 {unitConfig.doseUnit}</Text>
              </View>
            </View>

            <View>
              <Text style={styles.label}>Refill Alert Threshold ({unitConfig.unit})</Text>
              <TextInput
                style={styles.numberInput}
                value={String(form.refill_threshold || 5)}
                onChangeText={(v) => handleChange('refill_threshold', parseInt(v) || 5)}
                keyboardType="number-pad"
                placeholder="5"
              />
              <Text style={styles.helperText}>e.g., 5 {unitConfig.unit}</Text>
              <Text style={styles.helperText}>You'll be alerted when quantity drops to this level</Text>
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.rowItem}>
              <Text style={styles.label}>Start Date</Text>
              <Pressable style={styles.dropdownTrigger} onPress={() => openDatePicker('start_date', 'Select Start Date')}>
                <Text style={styles.dropdownText}>{form.start_date || 'YYYY-MM-DD'}</Text>
                <Ionicons name="calendar-outline" size={20} color="#6b7280" />
              </Pressable>
            </View>
            <View style={[styles.rowItem, styles.rowItemLast]}>
              <Text style={styles.label}>End Date</Text>
              <Pressable style={styles.dropdownTrigger} onPress={() => openDatePicker('end_date', 'Select End Date')}>
                <Text style={styles.dropdownText}>{form.end_date || 'YYYY-MM-DD'}</Text>
                <Ionicons name="calendar-outline" size={20} color="#6b7280" />
              </Pressable>
            </View>
          </View>

          <View>
            <Text style={styles.label}>Instructions</Text>
            <Pressable style={styles.dropdownTrigger} onPress={() => setShowInstructionPicker(true)}>
              <Text style={styles.dropdownText}>{form.instructions || 'Select Instructions'}</Text>
              <Ionicons name="chevron-down" size={20} color="#6b7280" />
            </Pressable>
          </View>

          <View>
            <Text style={styles.label}>Expiry Date</Text>
            <Pressable style={styles.dropdownTrigger} onPress={() => openDatePicker('expiry_date', 'Select Expiry Date')}>
              <Text style={styles.dropdownText}>{form.expiry_date || 'YYYY-MM-DD'}</Text>
              <Ionicons name="calendar-outline" size={20} color="#6b7280" />
            </Pressable>
          </View>

          <InputWithLabel label="Notes" placeholder="Reason, doctor's note..." multiline numberOfLines={3} style={{ height: 80 }} value={form.notes} onChangeText={(v) => handleChange('notes', v)} />
        </View>


        <Pressable style={[styles.cta, !isValid && styles.disabled]} onPress={persist} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>Save Medicine</Text>}
        </Pressable>

        <DatePickerModal
          visible={datePicker.visible}
          title={datePicker.title}
          onClose={() => setDatePicker({ ...datePicker, visible: false })}
          onSelect={(date) => handleChange(datePicker.field, date)}
        />

        {/* Form Picker Modal */}
        <Modal visible={showFormPicker} transparent animationType="slide">
          <Pressable style={styles.modalOverlay} onPress={() => setShowFormPicker(false)}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Form</Text>
              <FlatList
                data={FORM_OPTIONS}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <Pressable style={styles.modalItem} onPress={() => { handleChange('form', item); setShowFormPicker(false); }}>
                    <Text style={[styles.modalItemText, form.form === item && styles.selectedItemText]}>{item}</Text>
                    {form.form === item && <Ionicons name="checkmark" size={20} color="#008080" />}
                  </Pressable>
                )}
              />
            </View>
          </Pressable>
        </Modal>

        {/* Instruction Picker Modal */}
        <Modal visible={showInstructionPicker} transparent animationType="slide">
          <Pressable style={styles.modalOverlay} onPress={() => setShowInstructionPicker(false)}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Select Instructions</Text>
              <FlatList
                data={INSTRUCTION_OPTIONS}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <Pressable style={styles.modalItem} onPress={() => { handleChange('instructions', item); setShowInstructionPicker(false); }}>
                    <Text style={[styles.modalItemText, form.instructions === item && styles.selectedItemText]}>{item}</Text>
                    {form.instructions === item && <Ionicons name="checkmark" size={20} color="#008080" />}
                  </Pressable>
                )}
              />
            </View>
          </Pressable>
        </Modal>

        <TimePickerModal
          visible={showTimePicker}
          onClose={() => setShowTimePicker(false)}
          onTimeSelect={(time) => addTime(time)}
        />

      </ScrollView >
    </SafeAreaView >
  );
};

const InputWithLabel = ({ label, style, ...props }) => (
  <View style={styles.inputContainer}>
    <Text style={styles.label}>{label}</Text>
    <TextInput style={[styles.input, style]} placeholderTextColor="#9ca3af" {...props} />
  </View>
);

const DatePickerModal = ({ visible, onClose, onSelect, title }) => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [day, setDay] = useState(new Date().getDate());

  const handleConfirm = () => {
    const formattedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onSelect(formattedDate);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.dateModalContent} onPress={e => e.stopPropagation()}>
          <Text style={styles.modalTitle}>{title}</Text>
          <View style={styles.datePickerRow}>
            <View style={styles.datePickerCol}>
              <Text style={styles.dateLabel}>Year</Text>
              <TextInput
                style={styles.dateInput}
                keyboardType="numeric"
                value={String(year)}
                onChangeText={t => setYear(Number(t))}
                maxLength={4}
              />
            </View>
            <View style={styles.datePickerCol}>
              <Text style={styles.dateLabel}>Month</Text>
              <TextInput
                style={styles.dateInput}
                keyboardType="numeric"
                value={String(month)}
                onChangeText={t => setMonth(Number(t))}
                maxLength={2}
              />
            </View>
            <View style={styles.datePickerCol}>
              <Text style={styles.dateLabel}>Day</Text>
              <TextInput
                style={styles.dateInput}
                keyboardType="numeric"
                value={String(day)}
                onChangeText={t => setDay(Number(t))}
                maxLength={2}
              />
            </View>
          </View>
          <Pressable style={styles.cta} onPress={handleConfirm}>
            <Text style={styles.ctaText}>Confirm Date</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  container: {
    paddingHorizontal: 20,
    paddingTop: 30,
    paddingBottom: 80,
    gap: 24,
    backgroundColor: '#f8fafc',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
  },
  section: {
    gap: 16,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#008080',
    marginBottom: 4,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#008080',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  scanButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  inputContainer: {
    gap: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#fff',
    fontSize: 16,
    color: '#1f2937',
  },
  dropdownTrigger: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#fff',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownText: {
    fontSize: 16,
    color: '#1f2937',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowItem: {
    flex: 1,
    marginRight: 12,
  },
  rowItemLast: {
    marginRight: 0,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4b5563',
    marginBottom: 4,
  },
  timeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  timeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0f2f1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  timeChipText: {
    color: '#00695c',
    fontWeight: '600',
  },
  numberInput: {
    borderWidth: 1,
    borderColor: '#d4d4d4',
    borderRadius: 12,
    padding: 14,
    backgroundColor: '#fff',
    fontSize: 16,
    marginBottom: 8,
  },
  addTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#008080',
    borderStyle: 'dashed',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  addTimeText: {
    color: '#008080',
    fontWeight: '600',
  },
  presets: {
    flexDirection: 'row',
    gap: 8,
  },
  presetChip: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  presetText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '500',
  },
  daysRow: {
    flexDirection: 'row',
  },
  dayChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
  },
  dayChipSelected: {
    backgroundColor: '#008080',
  },
  dayChipText: {
    color: '#64748b',
    fontWeight: '500',
  },
  dayChipTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },
  cta: {
    backgroundColor: '#008080',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#008080',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  disabled: {
    opacity: 0.6,
    backgroundColor: '#9ca3af',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '50%',
  },
  dateModalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
    color: '#1f2937',
  },
  modalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalItemText: {
    fontSize: 16,
    color: '#4b5563',
  },
  selectedItemText: {
    color: '#008080',
    fontWeight: '600',
  },
  datePickerRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  datePickerCol: {
    alignItems: 'center',
    gap: 8,
  },
  dateLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    width: 80,
    textAlign: 'center',
    fontSize: 18,
    color: '#1f2937',
    backgroundColor: '#f8fafc',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    backgroundColor: '#fff',
    paddingVertical: 8,
  },
  stepperButton: {
    padding: 8,
  },
  stepperValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    minWidth: 40,
    textAlign: 'center',
  },
  helperText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
});
