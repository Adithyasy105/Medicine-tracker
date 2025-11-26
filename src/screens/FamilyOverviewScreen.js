import React, { useState, useMemo, useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMedicines } from '../hooks/useMedicines';
import { useProfiles } from '../hooks/useProfiles';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { getTodaysLogs, getCachedTodaysLogs } from '../services/medicines';
import { formatTime12Hour } from '../utils/time';

export const FamilyOverviewScreen = () => {
    const navigation = useNavigation();
    const { medicines, refresh } = useMedicines();
    const { profiles } = useProfiles();
    const [refreshing, setRefreshing] = useState(false);

    // Initialize with cached data
    const [todaysLogs, setTodaysLogs] = useState(() => {
        const initialLogs = {};
        if (medicines && medicines.length > 0) {
            medicines.forEach(med => {
                initialLogs[med.id] = getCachedTodaysLogs(med.id);
            });
        }
        return initialLogs;
    });

    const [currentTime, setCurrentTime] = useState(new Date());

    useFocusEffect(
        useCallback(() => {
            const timer = setInterval(() => {
                setCurrentTime(new Date());
            }, 60000);
            return () => clearInterval(timer);
        }, [])
    );

    useFocusEffect(
        useCallback(() => {
            let isActive = true;
            const fetchData = async () => {
                const cachedMap = {};
                medicines.forEach(med => {
                    cachedMap[med.id] = getCachedTodaysLogs(med.id);
                });
                setTodaysLogs(prev => ({ ...prev, ...cachedMap }));
                await refresh();
                if (isActive) {
                    await loadTodaysLogs();
                    setCurrentTime(new Date());
                }
            };
            fetchData();
            return () => { isActive = false; };
        }, [refresh, medicines])
    );

    const loadTodaysLogs = async () => {
        const logsMap = {};
        await Promise.all(medicines.map(async (med) => {
            try {
                const logs = await getTodaysLogs(med.id);
                logsMap[med.id] = logs;
            } catch (err) {
                console.warn('Failed to load logs for', med.id, err);
            }
        }));
        setTodaysLogs(prev => ({ ...prev, ...logsMap }));
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await refresh();
        await loadTodaysLogs();
        setRefreshing(false);
    };

    const getTodaysDoses = useMemo(() => {
        const currentHour = currentTime.getHours();
        const currentMinute = currentTime.getMinutes();
        const currentTimeValue = currentHour * 60 + currentMinute;

        return profiles.map((profile, profileIndex) => {
            const profileMedicines = medicines.filter(med => med.profile_id === profile.id);

            const doses = profileMedicines.flatMap((med, medIndex) => {
                const logs = todaysLogs[med.id] || [];
                return (med.times || []).map((time, timeIndex) => {
                    const [hour, minute] = time.split(':').map(Number);
                    const timeValue = hour * 60 + minute;

                    const wasTaken = logs.some(log => {
                        if (!log.time_scheduled) return false;
                        let logTime = log.time_scheduled;
                        if (log.time_scheduled.includes('T')) {
                            const d = new Date(log.time_scheduled);
                            const h = String(d.getHours()).padStart(2, '0');
                            const m = String(d.getMinutes()).padStart(2, '0');
                            logTime = `${h}:${m}`;
                        }
                        return logTime === time;
                    });

                    let status = 'pending';
                    if (wasTaken) status = 'taken';
                    else if (timeValue < currentTimeValue) status = 'missed';

                    return {
                        medicineId: med.id,
                        medicineName: med.name,
                        time,
                        timeValue,
                        quantity: med.quantity || 0,
                        unitPerDose: med.unit_per_dose || 1,
                        refillThreshold: med.refill_threshold || 5,
                        isLowStock: (med.quantity || 0) <= (med.refill_threshold || 5) && (med.quantity || 0) > 0,
                        status,
                        medicine: med,
                        uniqueKey: `${med.id}-${medIndex}-${time}-${timeIndex}`
                    };
                });
            }).sort((a, b) => a.timeValue - b.timeValue);

            const nextDose = doses.find(d => d.status === 'pending');
            const takenCount = doses.filter(d => d.status === 'taken').length;
            const totalDoses = doses.length;

            return {
                profile,
                doses,
                nextDose,
                takenCount,
                totalDoses,
                medicineCount: profileMedicines.length,
                key: profile.id ? `${profile.id}-${profileIndex}` : `profile-${profileIndex}`
            };
        });
    }, [profiles, medicines, todaysLogs, currentTime]);

    const handleTakePress = (dose) => {
        navigation.navigate('MedicineDetail', {
            medicine: dose.medicine,
            scheduledTime: dose.time
        });
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending': return '#fbbf24';
            case 'taken': return '#10b981';
            case 'missed': return '#ef4444';
            default: return '#6b7280';
        }
    };

    return (
        <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Family Overview</Text>
                <Text style={styles.headerSubtitle}>Medication adherence tracking</Text>
            </View>

            <ScrollView
                contentContainerStyle={styles.container}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {getTodaysDoses.map(({ profile, doses, nextDose, takenCount, totalDoses, medicineCount, key }) => (
                    <View key={key} style={styles.profileCard}>
                        {/* Profile Header */}
                        <View style={styles.profileHeader}>
                            <View style={styles.profileInfo}>
                                <View style={styles.profileAvatar}>
                                    <Text style={styles.profileAvatarText}>
                                        {profile.display_name ? profile.display_name.substring(0, 2).toUpperCase() : '??'}
                                    </Text>
                                </View>
                                <View>
                                    <Text style={styles.profileName}>{profile.display_name}</Text>
                                    <Text style={styles.profileRelation}>{profile.relation || 'Family Member'}</Text>
                                </View>
                            </View>
                            <View style={styles.progressContainer}>
                                <Text style={styles.progressText}>
                                    <Text style={styles.progressTaken}>{takenCount}</Text>
                                    <Text style={styles.progressTotal}>/{totalDoses}</Text>
                                </Text>
                                <Text style={styles.progressLabel}>doses</Text>
                            </View>
                        </View>

                        {/* Divider */}
                        <View style={styles.divider} />

                        {/* Doses Timeline */}
                        <View style={styles.dosesContainer}>
                            {doses.length === 0 ? (
                                <View style={styles.emptyDoses}>
                                    <Ionicons name="calendar-outline" size={24} color="#9ca3af" />
                                    <Text style={styles.emptyDosesText}>No medicines for today</Text>
                                </View>
                            ) : (
                                doses.map((dose, index) => (
                                    <View key={dose.uniqueKey} style={styles.doseRow}>
                                        {/* Timeline Line */}
                                        <View style={styles.timelineContainer}>
                                            <View style={[styles.timelineDot, { backgroundColor: getStatusColor(dose.status) }]} />
                                            {index !== doses.length - 1 && <View style={styles.timelineLine} />}
                                        </View>

                                        {/* Dose Content */}
                                        <View style={styles.doseContent}>
                                            <View style={styles.doseMainInfo}>
                                                <Text style={styles.doseTime}>{formatTime12Hour(dose.time)}</Text>
                                                <Text style={styles.doseMedicine}>{dose.medicineName}</Text>
                                                {dose.isLowStock && (
                                                    <Text style={styles.lowStockText}>Low Stock: {dose.quantity} left</Text>
                                                )}
                                            </View>

                                            {/* Action/Status on Right */}
                                            <View style={styles.doseRightAction}>
                                                {dose.status === 'taken' && (
                                                    <View style={styles.takenBadge}>
                                                        <Ionicons name="checkmark" size={14} color="#fff" />
                                                        <Text style={styles.takenText}>Taken</Text>
                                                    </View>
                                                )}
                                                {dose.status === 'missed' && (
                                                    <TouchableOpacity
                                                        style={styles.markMissedButton}
                                                        onPress={() => handleTakePress(dose)}
                                                    >
                                                        <Text style={styles.markMissedText}>Missed</Text>
                                                    </TouchableOpacity>
                                                )}
                                                {dose.status === 'pending' && (
                                                    <TouchableOpacity
                                                        style={styles.takeButton}
                                                        onPress={() => handleTakePress(dose)}
                                                        disabled={dose.quantity === 0}
                                                    >
                                                        <Text style={styles.takeButtonText}>Take</Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        </View>
                                    </View>
                                ))
                            )}
                        </View>
                    </View>
                ))}

                {profiles.length === 0 && (
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIconContainer}>
                            <Ionicons name="people" size={48} color="#008080" />
                        </View>
                        <Text style={styles.emptyStateTitle}>No Profiles Yet</Text>
                        <Text style={styles.emptyStateText}>Add family members to start tracking their health.</Text>
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#f8f9fa' },
    header: {
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
    container: {
        padding: 20,
        gap: 20,
        paddingBottom: 100,
    },
    profileCard: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 20,
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#f0f0f0',
    },
    profileHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    profileInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    profileAvatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#e0f2f1',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#fff',
        shadowColor: '#008080',
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    profileAvatarText: {
        color: '#008080',
        fontSize: 20,
        fontWeight: '700',
    },
    profileName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1f2937',
    },
    profileRelation: {
        fontSize: 13,
        color: '#6b7280',
        marginTop: 2,
        backgroundColor: '#f3f4f6',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8,
        alignSelf: 'flex-start',
        overflow: 'hidden',
    },
    progressContainer: {
        alignItems: 'flex-end',
    },
    progressText: {
        flexDirection: 'row',
        alignItems: 'baseline',
    },
    progressTaken: {
        fontSize: 24,
        fontWeight: '800',
        color: '#008080',
    },
    progressTotal: {
        fontSize: 16,
        color: '#9ca3af',
        fontWeight: '600',
    },
    progressLabel: {
        fontSize: 12,
        color: '#6b7280',
    },
    divider: {
        height: 1,
        backgroundColor: '#f3f4f6',
        marginVertical: 16,
    },
    dosesContainer: {
        gap: 0,
    },
    doseRow: {
        flexDirection: 'row',
        minHeight: 70,
    },
    timelineContainer: {
        width: 20,
        alignItems: 'center',
        marginRight: 16,
    },
    timelineDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginTop: 6,
        borderWidth: 2,
        borderColor: '#fff',
        shadowColor: '#000',
        shadowOpacity: 0.1,
        shadowRadius: 2,
    },
    timelineLine: {
        width: 2,
        flex: 1,
        backgroundColor: '#e5e7eb',
        marginVertical: 4,
        borderRadius: 1,
    },
    doseContent: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start', // Align to top
        paddingBottom: 24,
    },
    doseMainInfo: {
        flex: 1,
        gap: 4,
    },
    doseTime: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1f2937',
    },
    doseMedicine: {
        fontSize: 15,
        color: '#4b5563',
        fontWeight: '500',
    },
    lowStockText: {
        fontSize: 12,
        color: '#f59e0b',
        fontWeight: '600',
    },
    doseRightAction: {
        alignItems: 'flex-end',
    },
    takenBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#10b981',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    takenText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    missedBadge: {
        backgroundColor: '#fee2e2',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 12,
    },
    missedText: {
        color: '#ef4444',
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    takeButton: {
        backgroundColor: '#008080',
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 12,
        shadowColor: '#008080',
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 2,
    },
    takeButtonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 13,
    },
    markMissedButton: {
        borderWidth: 1,
        borderColor: '#ef4444',
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#fff',
    },
    markMissedText: {
        color: '#ef4444',
        fontWeight: '600',
        fontSize: 13,
    },
    emptyDoses: {
        alignItems: 'center',
        padding: 20,
        gap: 8,
    },
    emptyDosesText: {
        color: '#9ca3af',
        fontStyle: 'italic',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
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
});
