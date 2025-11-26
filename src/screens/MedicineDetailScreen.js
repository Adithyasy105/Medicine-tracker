import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, Alert, TouchableOpacity, Modal, TextInput, Pressable, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { markDoseTaken, deleteMedicine, fetchMedicineLogs } from '../services/medicines';
import { useMedicines } from '../hooks/useMedicines';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { useFocusEffect } from '@react-navigation/native';
import { formatTime12Hour, isSameDay } from '../utils/time';

export const MedicineDetailScreen = ({ route, navigation }) => {
  const { medicine: initialMedicine, scheduledTime } = route.params;
  const [medicine, setMedicine] = useState(initialMedicine);
  const [status, setStatus] = useState('');
  const [logs, setLogs] = useState([]);
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [inventoryForm, setInventoryForm] = useState({
    quantity: 0,
    unit_per_dose: 1,
    refill_threshold: 5
  });

  // Filtering State
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth()); // 0-11
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  const { refresh, medicines } = useMedicines();

  // Refresh medicine data when screen is focused
  useFocusEffect(
    useCallback(() => {
      const refreshMedicine = async () => {
        await refresh();
        // Update local medicine state with latest data
        const updated = medicines.find(m => m.id === medicine.id);
        if (updated) {
          setMedicine(updated);
        }
      };
      refreshMedicine();
      loadLogs();
    }, [refresh, medicine.id, medicines])
  );

  useEffect(() => {
    loadLogs();
  }, [medicine.id]);

  const loadLogs = async () => {
    try {
      const history = await fetchMedicineLogs(medicine.id);
      setLogs(history || []);
    } catch (err) {
      console.warn('Failed to load logs', err);
    }
  };

  // Determine which scheduled times have been taken today
  const takenScheduledTimes = useMemo(() => {
    const today = new Date();
    const todaysLogs = logs.filter(log =>
      isSameDay(log.time_taken, today) &&
      log.status === 'taken'
    );

    // Extract HH:MM from logs
    return new Set(todaysLogs.map(log => {
      if (!log.time_scheduled) return null;
      if (log.time_scheduled.includes('T')) {
        const d = new Date(log.time_scheduled);
        const h = String(d.getHours()).padStart(2, '0');
        const m = String(d.getMinutes()).padStart(2, '0');
        return `${h}:${m}`;
      }
      return log.time_scheduled;
    }).filter(Boolean));
  }, [logs]);

  // Find the next pending scheduled time
  const nextPendingTime = useMemo(() => {
    if (!medicine.times || medicine.times.length === 0) return null;

    // If a specific time was passed in params and it's not taken, that's our target
    if (scheduledTime && !takenScheduledTimes.has(scheduledTime)) {
      return scheduledTime;
    }

    // Otherwise find the first time in the day that hasn't been taken
    // Sort times correctly by hour/minute
    const sortedTimes = [...medicine.times].sort((a, b) => {
      const [h1, m1] = a.split(':').map(Number);
      const [h2, m2] = b.split(':').map(Number);
      return h1 * 60 + m1 - (h2 * 60 + m2);
    });

    return sortedTimes.find(time => !takenScheduledTimes.has(time));
  }, [medicine.times, takenScheduledTimes, scheduledTime]);

  const isScheduledTimeTaken = useMemo(() => {
    if (!scheduledTime) return false;
    return takenScheduledTimes.has(scheduledTime);
  }, [takenScheduledTimes, scheduledTime]);

  // Strict check: Are ALL scheduled doses taken?
  const areAllDosesTaken = useMemo(() => {
    if (!medicine.times || medicine.times.length === 0) return false;
    // Check if the number of taken scheduled times equals the total number of scheduled times
    // We filter logs to ensure we only count unique scheduled times taken today
    // AND we only count times that are actually in the current schedule (in case schedule changed)
    const uniqueTakenTimes = new Set([...takenScheduledTimes].filter(t => medicine.times.includes(t)));
    return uniqueTakenTimes.size >= medicine.times.length;
  }, [medicine.times, takenScheduledTimes]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const logDate = new Date(log.time_taken);
      return logDate.getFullYear() === selectedYear && logDate.getMonth() === selectedMonth;
    });
  }, [logs, selectedYear, selectedMonth]);

  const handleMarkTaken = async () => {
    if ((medicine.quantity || 0) <= 0) {
      Alert.alert('Out of Stock', 'You have 0 quantity left. Please refill first.');
      return;
    }

    if (areAllDosesTaken) {
      Alert.alert('Limit Reached', 'You have already taken all scheduled doses for today.');
      return;
    }

    // Determine the time we are marking for
    // Priority: 1. Passed scheduledTime (if valid/pending) 2. Next pending time
    let timeToMark = null;

    if (scheduledTime && !takenScheduledTimes.has(scheduledTime)) {
      timeToMark = scheduledTime;
    } else {
      timeToMark = nextPendingTime;
    }

    // Strict check: If medicine has scheduled times, we MUST have a timeToMark
    if (medicine.times && medicine.times.length > 0 && !timeToMark) {
      Alert.alert('All Doses Taken', 'You have already taken all scheduled doses for today.');
      return;
    }

    try {
      setStatus('Saving...');
      const result = await markDoseTaken({
        quantity: medicine.unit_per_dose || 1,
        medicineId: medicine.id,
        scheduledTime: timeToMark
      });

      if (result && result.success) {
        // Optimistically update logs
        if (result.log) {
          setLogs(prev => [result.log, ...prev]);
        }

        // Optimistically update quantity
        setMedicine(prev => ({ ...prev, quantity: Math.max(0, (prev.quantity || 0) - (prev.unit_per_dose || 1)) }));

        await refresh(); // Background refresh

        if (result.offline) {
          setStatus(`Queued offline: ${result.error || 'Unknown error'}`);
          Alert.alert('Offline Mode', `Action queued. Reason: ${result.error}`);
        } else {
          setStatus('Marked taken!');
        }

        setTimeout(() => setStatus(''), 2000);

        // If we just took the specific scheduled dose, go back safely
        if (scheduledTime) {
          setTimeout(() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('MainTabs', { screen: 'Family' });
            }
          }, 1500);
        }
      }

    } catch (err) {
      if (err.message && err.message.includes('already been taken')) {
        Alert.alert('Already Taken', err.message);
        setStatus('');
        loadLogs(); // Reload logs to sync state
      } else {
        setStatus(`Error: ${err.message}`);
      }
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Medicine',
      'Are you sure you want to delete this medicine? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMedicine(medicine.id);
              await refresh();
              if (navigation.canGoBack()) {
                navigation.goBack();
              } else {
                navigation.navigate('MainTabs', { screen: 'Medicines' });
              }
            } catch (err) {
              Alert.alert('Error', 'Failed to delete medicine');
            }
          }
        }
      ]
    );
  };

  const handleOpenInventoryModal = () => {
    setInventoryForm({
      quantity: medicine.quantity || 0,
      unit_per_dose: medicine.unit_per_dose || 1,
      refill_threshold: medicine.refill_threshold || 5
    });
    setShowInventoryModal(true);
  };

  const handleUpdateInventory = async () => {
    try {
      const { error } = await supabase
        .from('medicines')
        .update({
          quantity: parseInt(inventoryForm.quantity),
          unit_per_dose: parseInt(inventoryForm.unit_per_dose),
          refill_threshold: parseInt(inventoryForm.refill_threshold)
        })
        .eq('id', medicine.id);

      if (error) throw error;

      setMedicine(prev => ({
        ...prev,
        quantity: parseInt(inventoryForm.quantity),
        unit_per_dose: parseInt(inventoryForm.unit_per_dose),
        refill_threshold: parseInt(inventoryForm.refill_threshold)
      }));

      await refresh();
      setShowInventoryModal(false);
      Alert.alert('Success', 'Inventory updated successfully!');
    } catch (err) {
      Alert.alert('Error', 'Failed to update inventory');
      console.error(err);
    }
  };

  const getButtonText = () => {
    if ((medicine.quantity || 0) <= 0) return 'Out of Stock';

    // If we are viewing a specific scheduled time
    if (scheduledTime) {
      if (isScheduledTimeTaken) return 'Taken';
      return `Take ${formatTime12Hour(scheduledTime)} Dose`;
    }

    // If generic view
    if (areAllDosesTaken) return 'All Taken Today';

    const timeToMark = nextPendingTime;
    if (timeToMark) {
      return `Take ${formatTime12Hour(timeToMark)} Dose`;
    }

    return 'Mark Taken';
  };

  const isButtonDisabled = () => {
    if ((medicine.quantity || 0) <= 0) return true;

    if (scheduledTime) {
      return isScheduledTimeTaken;
    }

    return areAllDosesTaken;
  };

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => {
          if (navigation.canGoBack()) {
            navigation.goBack();
          } else {
            navigation.navigate('MainTabs', { screen: 'Medicines' });
          }
        }}>
          <Ionicons name="chevron-back" size={24} color="#1f2937" />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Details</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {/* All Doses Taken Banner */}
        {areAllDosesTaken && (
          <View style={styles.bannerSuccess}>
            <Ionicons name="checkmark-circle" size={20} color="#166534" />
            <Text style={styles.bannerTextSuccess}>All doses taken for today!</Text>
          </View>
        )}

        {/* Specific Dose Taken Banner */}
        {isScheduledTimeTaken && !areAllDosesTaken && scheduledTime && (
          <View style={styles.bannerSuccess}>
            <Ionicons name="checkmark-circle" size={20} color="#166534" />
            <Text style={styles.bannerTextSuccess}>Dose for {formatTime12Hour(scheduledTime)} taken!</Text>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{medicine.name}</Text>
            <TouchableOpacity onPress={handleDelete}>
              <Ionicons name="trash-outline" size={24} color="#ef4444" />
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <DetailRow label="Brand" value={medicine.brand} />
          <DetailRow label="Dosage" value={medicine.dosage} />
          <DetailRow label="Form" value={medicine.form} />
          <DetailRow
            label="Times"
            value={medicine.times?.map(t => formatTime12Hour(t)).join(', ')}
          />
          <DetailRow label="Quantity" value={`${medicine.quantity} (Refill at ${medicine.refill_threshold})`} />
          <DetailRow label="Expiry" value={medicine.expiry_date} />

          {medicine.instructions ? (
            <View style={styles.section}>
              <Text style={styles.label}>Instructions</Text>
              <Text style={styles.text}>{medicine.instructions}</Text>
            </View>
          ) : null}

          {medicine.notes ? (
            <View style={styles.section}>
              <Text style={styles.label}>Notes</Text>
              <Text style={styles.text}>{medicine.notes}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.buttonsRow}>
          <TouchableOpacity style={[styles.cta, styles.ctaSecondary]} onPress={handleOpenInventoryModal}>
            <Ionicons name="create-outline" size={20} color="#008080" />
            <Text style={styles.ctaTextSecondary}>Update Inventory</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.cta, styles.ctaPrimary, isButtonDisabled() && styles.disabled]}
            onPress={handleMarkTaken}
            disabled={isButtonDisabled()}
          >
            <Ionicons name={isButtonDisabled() ? "checkmark-circle" : "checkmark-circle-outline"} size={20} color="#fff" />
            <Text style={styles.ctaText}>{getButtonText()}</Text>
          </TouchableOpacity>
        </View>

        {!!status && <Text style={styles.status}>{status}</Text>}

        <View style={styles.historySection}>
          <View style={styles.historyHeader}>
            <Text style={styles.sectionTitle}>History</Text>
            <View style={styles.filterRow}>
              <TouchableOpacity style={styles.filterButton} onPress={() => setShowMonthPicker(true)}>
                <Text style={styles.filterButtonText}>{months[selectedMonth]}</Text>
                <Ionicons name="chevron-down" size={16} color="#008080" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.filterButton} onPress={() => setShowYearPicker(true)}>
                <Text style={styles.filterButtonText}>{selectedYear}</Text>
                <Ionicons name="chevron-down" size={16} color="#008080" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderText}>Time Taken</Text>
            <Text style={styles.tableHeaderText}>Scheduled For</Text>
            <Text style={styles.tableHeaderText}>Status</Text>
          </View>
          {filteredLogs.length === 0 ? (
            <Text style={styles.emptyText}>No history for {months[selectedMonth]} {selectedYear}.</Text>
          ) : (
            filteredLogs.map((log, index) => (
              <View key={`${log.id}-${index}`} style={styles.logRow}>
                <Text style={styles.logDate}>{format(new Date(log.time_taken), 'MMM dd, hh:mm a')}</Text>
                <Text style={styles.logDate}>
                  {log.time_scheduled && log.time_scheduled.includes('T')
                    ? formatTime12Hour(new Date(log.time_scheduled).toISOString().split('T')[1].substring(0, 5))
                    : (log.time_scheduled ? formatTime12Hour(log.time_scheduled) : '-')}
                </Text>
                <View style={styles.logStatusBadge}>
                  <Text style={styles.logStatusText}>{log.status}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Inventory Modal */}
      <Modal visible={showInventoryModal} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowInventoryModal(false)}>
          <Pressable style={styles.modalContent} onPress={e => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Update Inventory</Text>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Total Quantity</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                value={String(inventoryForm.quantity)}
                onChangeText={(v) => setInventoryForm(prev => ({ ...prev, quantity: v }))}
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Unit Per Dose</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                value={String(inventoryForm.unit_per_dose)}
                onChangeText={(v) => setInventoryForm(prev => ({ ...prev, unit_per_dose: v }))}
              />
            </View>

            <View style={styles.modalField}>
              <Text style={styles.modalLabel}>Refill Threshold</Text>
              <TextInput
                style={styles.modalInput}
                keyboardType="numeric"
                value={String(inventoryForm.refill_threshold)}
                onChangeText={(v) => setInventoryForm(prev => ({ ...prev, refill_threshold: v }))}
              />
            </View>

            <View style={styles.modalButtons}>
              <Pressable style={[styles.modalButton, styles.modalButtonCancel]} onPress={() => setShowInventoryModal(false)}>
                <Text style={styles.modalButtonTextCancel}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalButton, styles.modalButtonSave]} onPress={handleUpdateInventory}>
                <Text style={styles.modalButtonTextSave}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Month Picker Modal */}
      <Modal visible={showMonthPicker} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowMonthPicker(false)}>
          <View style={styles.pickerContent}>
            <Text style={styles.pickerTitle}>Select Month</Text>
            <FlatList
              data={months}
              keyExtractor={(item) => item}
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  style={[styles.pickerItem, selectedMonth === index && styles.pickerItemSelected]}
                  onPress={() => {
                    setSelectedMonth(index);
                    setShowMonthPicker(false);
                  }}
                >
                  <Text style={[styles.pickerItemText, selectedMonth === index && styles.pickerItemTextSelected]}>
                    {item}
                  </Text>
                  {selectedMonth === index && <Ionicons name="checkmark" size={20} color="#008080" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </Pressable>
      </Modal>

      {/* Year Picker Modal */}
      <Modal visible={showYearPicker} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowYearPicker(false)}>
          <View style={styles.pickerContent}>
            <Text style={styles.pickerTitle}>Select Year</Text>
            <FlatList
              data={years}
              keyExtractor={(item) => String(item)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerItem, selectedYear === item && styles.pickerItemSelected]}
                  onPress={() => {
                    setSelectedYear(item);
                    setShowYearPicker(false);
                  }}
                >
                  <Text style={[styles.pickerItemText, selectedYear === item && styles.pickerItemTextSelected]}>
                    {item}
                  </Text>
                  {selectedYear === item && <Ionicons name="checkmark" size={20} color="#008080" />}
                </TouchableOpacity>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

const DetailRow = ({ label, value }) => {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    fontSize: 16,
    color: '#1f2937',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  container: {
    padding: 16,
    gap: 16,
  },
  bannerSuccess: {
    backgroundColor: '#dcfce7',
    padding: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  bannerTextSuccess: {
    color: '#166534',
    fontWeight: '600',
    fontSize: 14,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    gap: 16,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  value: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
  section: {
    gap: 6,
  },
  text: {
    fontSize: 16,
    color: '#374151',
    lineHeight: 24,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  cta: {
    backgroundColor: '#008080',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 16,
    gap: 8,
    shadowColor: '#008080',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaPrimary: {
    flex: 1,
    backgroundColor: '#008080',
  },
  ctaSecondary: {
    flex: 1,
    backgroundColor: '#e0f2f1',
  },
  ctaTextSecondary: {
    fontSize: 16,
    fontWeight: '600',
    color: '#008080',
  },
  disabled: {
    backgroundColor: '#9ca3af',
    shadowOpacity: 0,
  },
  ctaText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  status: {
    textAlign: 'center',
    color: '#008080',
    fontWeight: '500',
  },
  historySection: {
    marginTop: 10,
    gap: 12,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#e0f2f1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#008080',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tableHeaderText: {
    fontWeight: '600',
    color: '#64748b',
    fontSize: 12,
  },
  logRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  logDate: {
    fontSize: 14,
    color: '#334155',
  },
  logStatusBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  logStatusText: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  emptyText: {
    color: '#94a3b8',
    fontStyle: 'italic',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 5,
  },
  pickerContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '50%',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  pickerItemSelected: {
    backgroundColor: '#f0fdfa',
  },
  pickerItemText: {
    fontSize: 16,
    color: '#374151',
  },
  pickerItemTextSelected: {
    color: '#008080',
    fontWeight: '600',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 20,
  },
  modalField: {
    marginBottom: 16,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: '#f3f4f6',
  },
  modalButtonSave: {
    backgroundColor: '#008080',
  },
  modalButtonTextCancel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  modalButtonTextSave: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
