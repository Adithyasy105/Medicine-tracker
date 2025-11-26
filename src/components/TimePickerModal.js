import React, { useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadows, borderRadius, spacing } from '../theme/colors';

export const TimePickerModal = ({ visible, onClose, onTimeSelect }) => {
    const [selectedHour, setSelectedHour] = useState(8);
    const [selectedMinute, setSelectedMinute] = useState(0);
    const [period, setPeriod] = useState('AM');

    const hours = Array.from({ length: 12 }, (_, i) => i + 1);
    const minutes = [0, 15, 30, 45];

    const handleConfirm = () => {
        let hour24 = selectedHour;
        if (period === 'PM' && selectedHour !== 12) {
            hour24 = selectedHour + 12;
        } else if (period === 'AM' && selectedHour === 12) {
            hour24 = 0;
        }

        const timeString = `${String(hour24).padStart(2, '0')}:${String(selectedMinute).padStart(2, '0')}`;

        // Call onTimeSelect first to ensure time is added
        if (onTimeSelect) {
            onTimeSelect(timeString);
        }

        // Small delay to ensure state updates before closing
        setTimeout(() => {
            onClose();
        }, 100);
    };


    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        {/* Header */}
                        <View style={styles.header}>
                            <Text style={styles.title}>Select Time</Text>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <Ionicons name="close" size={24} color={colors.gray[600]} />
                            </TouchableOpacity>
                        </View>

                        {/* Time Display */}
                        <View style={styles.timeDisplay}>
                            <Text style={styles.timeDisplayText}>
                                {String(selectedHour).padStart(2, '0')}:{String(selectedMinute).padStart(2, '0')} {period}
                            </Text>
                        </View>

                        {/* Time Pickers */}
                        <View style={styles.pickerContainer}>
                            {/* Hours */}
                            <View style={styles.pickerColumn}>
                                <Text style={styles.pickerLabel}>Hour</Text>
                                <View style={styles.pickerScroll}>
                                    {hours.map((hour) => (
                                        <TouchableOpacity
                                            key={hour}
                                            style={[
                                                styles.pickerItem,
                                                selectedHour === hour && styles.pickerItemSelected,
                                            ]}
                                            onPress={() => setSelectedHour(hour)}
                                        >
                                            <Text
                                                style={[
                                                    styles.pickerItemText,
                                                    selectedHour === hour && styles.pickerItemTextSelected,
                                                ]}
                                            >
                                                {String(hour).padStart(2, '0')}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Minutes */}
                            <View style={styles.pickerColumn}>
                                <Text style={styles.pickerLabel}>Minute</Text>
                                <View style={styles.pickerScroll}>
                                    {minutes.map((minute) => (
                                        <TouchableOpacity
                                            key={minute}
                                            style={[
                                                styles.pickerItem,
                                                selectedMinute === minute && styles.pickerItemSelected,
                                            ]}
                                            onPress={() => setSelectedMinute(minute)}
                                        >
                                            <Text
                                                style={[
                                                    styles.pickerItemText,
                                                    selectedMinute === minute && styles.pickerItemTextSelected,
                                                ]}
                                            >
                                                {String(minute).padStart(2, '0')}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* AM/PM */}
                            <View style={styles.pickerColumn}>
                                <Text style={styles.pickerLabel}>Period</Text>
                                <View style={styles.pickerScroll}>
                                    {['AM', 'PM'].map((p) => (
                                        <TouchableOpacity
                                            key={p}
                                            style={[
                                                styles.pickerItem,
                                                period === p && styles.pickerItemSelected,
                                            ]}
                                            onPress={() => setPeriod(p)}
                                        >
                                            <Text
                                                style={[
                                                    styles.pickerItemText,
                                                    period === p && styles.pickerItemTextSelected,
                                                ]}
                                            >
                                                {p}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </View>

                        {/* Confirm Button */}
                        <TouchableOpacity style={styles.confirmButton} onPress={handleConfirm}>
                            <Text style={styles.confirmButtonText}>Confirm Time</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        padding: spacing.lg,
        paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.lg,
        maxHeight: '80%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: colors.text.primary,
    },
    closeButton: {
        padding: spacing.xs,
    },
    timeDisplay: {
        backgroundColor: colors.primary[50],
        borderRadius: borderRadius.lg,
        padding: spacing.lg,
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    timeDisplayText: {
        fontSize: 36,
        fontWeight: '700',
        color: colors.primary[700],
    },
    pickerContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: spacing.lg,
    },
    pickerColumn: {
        flex: 1,
        marginHorizontal: spacing.xs,
    },
    pickerLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: colors.text.secondary,
        marginBottom: spacing.sm,
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    pickerScroll: {
        backgroundColor: colors.gray[50],
        borderRadius: borderRadius.md,
        padding: spacing.xs,
    },
    pickerItem: {
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.sm,
        alignItems: 'center',
        marginVertical: 2,
    },
    pickerItemSelected: {
        backgroundColor: colors.primary[500],
    },
    pickerItemText: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text.secondary,
    },
    pickerItemTextSelected: {
        color: colors.text.inverse,
        fontWeight: '700',
    },
    presetsContainer: {
        marginBottom: spacing.lg,
    },
    presetsLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text.primary,
        marginBottom: spacing.sm,
    },
    presets: {
        flexDirection: 'row',
        gap: spacing.sm,
    },
    presetButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        backgroundColor: colors.gray[100],
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: borderRadius.md,
    },
    presetText: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text.primary,
    },
    confirmButton: {
        backgroundColor: colors.primary[600],
        paddingVertical: spacing.md,
        borderRadius: borderRadius.md,
        alignItems: 'center',
        ...shadows.md,
    },
    confirmButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: colors.text.inverse,
    },
});
