import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

export const ResetPasswordScreen = () => {
    const navigation = useNavigation();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleResetPassword = async () => {
        if (!newPassword || !confirmPassword) {
            Alert.alert('Error', 'Please enter and confirm your new password');
            return;
        }

        if (newPassword !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match');
            return;
        }

        if (newPassword.length < 6) {
            Alert.alert('Error', 'Password must be at least 6 characters');
            return;
        }

        try {
            setLoading(true);
            const { error } = await supabase.auth.updateUser({
                password: newPassword,
            });

            if (error) throw error;

            Alert.alert(
                'Success',
                'Your password has been reset successfully!',
                [
                    {
                        text: 'OK',
                        onPress: () => {
                            // The user will be automatically logged in after password reset
                            // Navigation will be handled by AuthProvider
                        },
                    },
                ]
            );
        } catch (err) {
            Alert.alert('Error', err.message || 'Failed to reset password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.container}
        >
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
                Enter your new password below.
            </Text>

            <View style={styles.passwordContainer}>
                <TextInput
                    placeholder="New Password"
                    secureTextEntry={!showNewPassword}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    style={styles.passwordInput}
                />
                <Pressable
                    onPress={() => setShowNewPassword(prev => !prev)}
                    style={styles.eyeButton}
                >
                    <Ionicons name={showNewPassword ? 'eye-off' : 'eye'} size={24} color="#666" />
                </Pressable>
            </View>

            <View style={styles.passwordContainer}>
                <TextInput
                    placeholder="Confirm Password"
                    secureTextEntry={!showConfirmPassword}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    style={styles.passwordInput}
                />
                <Pressable
                    onPress={() => setShowConfirmPassword(prev => !prev)}
                    style={styles.eyeButton}
                >
                    <Ionicons name={showConfirmPassword ? 'eye-off' : 'eye'} size={24} color="#666" />
                </Pressable>
            </View>

            <Pressable
                style={[styles.cta, loading && styles.ctaDisabled]}
                onPress={handleResetPassword}
                disabled={loading}
            >
                <Text style={styles.ctaText}>
                    {loading ? 'Resetting...' : 'Reset Password'}
                </Text>
            </Pressable>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 24,
        justifyContent: 'center',
        backgroundColor: '#f5f5f5',
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        marginBottom: 12,
        textAlign: 'center',
        color: '#1f2937',
    },
    subtitle: {
        fontSize: 16,
        marginBottom: 32,
        textAlign: 'center',
        color: '#6b7280',
        lineHeight: 24,
    },
    passwordContainer: {
        position: 'relative',
        marginBottom: 16,
    },
    passwordInput: {
        borderWidth: 1,
        borderColor: '#d4d4d4',
        borderRadius: 12,
        padding: 14,
        backgroundColor: '#fff',
        paddingRight: 50,
        fontSize: 16,
    },
    eyeButton: {
        position: 'absolute',
        right: 14,
        top: 14,
    },
    cta: {
        backgroundColor: '#2563eb',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 8,
    },
    ctaDisabled: {
        backgroundColor: '#93c5fd',
    },
    ctaText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 16,
    },
});
