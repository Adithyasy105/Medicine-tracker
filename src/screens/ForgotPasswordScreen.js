import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    TouchableOpacity,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { CustomInput } from '../components/CustomInput';
import { CustomButton } from '../components/CustomButton';
import { colors } from '../theme/colors';

export const ForgotPasswordScreen = () => {
    const navigation = useNavigation();
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [otpSent, setOtpSent] = useState(false);
    const [error, setError] = useState(null);

    const handleSendOTP = async () => {
        if (!email) {
            setError('Please enter your email address');
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    shouldCreateUser: false, // Don't create new users during password reset
                },
            });

            if (error) throw error;

            setOtpSent(true);
            Alert.alert(
                'OTP Sent',
                'Please check your email for the 6-digit verification code.',
            );
        } catch (err) {
            setError(err.message || 'Failed to send OTP');
            Alert.alert('Error', err.message || 'Failed to send OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async () => {
        if (!otp || otp.length !== 6) {
            setError('Please enter the 6-digit OTP code');
            return;
        }

        try {
            setLoading(true);
            setError(null);
            const { data, error } = await supabase.auth.verifyOtp({
                email,
                token: otp,
                type: 'email',
            });

            if (error) throw error;

            // OTP verified successfully, navigate to reset password screen
            Alert.alert('Success', 'OTP verified! Please set your new password.', [
                {
                    text: 'OK',
                    onPress: () => navigation.navigate('ResetPassword'),
                },
            ]);
        } catch (err) {
            setError(err.message || 'Invalid OTP code');
            Alert.alert('Error', err.message || 'Invalid OTP code');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={[styles.gradient, { backgroundColor: colors.primary[500] }]}>
            <SafeAreaView style={styles.container} edges={['top']}>
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                >
                    <ScrollView
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                    >
                        {/* Header */}
                        <View style={styles.header}>
                            <TouchableOpacity
                                onPress={() => navigation.goBack()}
                                style={styles.backButton}
                            >
                                <Ionicons name="arrow-back" size={24} color="#fff" />
                            </TouchableOpacity>
                            <View style={styles.iconContainer}>
                                <Ionicons name="lock-closed" size={48} color="#fff" />
                            </View>
                            <Text style={styles.title}>Forgot Password?</Text>
                            <Text style={styles.subtitle}>
                                {!otpSent
                                    ? 'Enter your email to receive a code'
                                    : 'Enter the code sent to your email'}
                            </Text>
                        </View>

                        {/* Form Card */}
                        <View style={styles.card}>
                            {!otpSent ? (
                                <CustomInput
                                    label="Email Address"
                                    value={email}
                                    onChangeText={(text) => {
                                        setEmail(text);
                                        setError(null);
                                    }}
                                    placeholder="Enter your email address"
                                    icon="mail-outline"
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    error={error}
                                />
                            ) : (
                                <CustomInput
                                    label="Verification Code"
                                    value={otp}
                                    onChangeText={(text) => {
                                        setOtp(text);
                                        setError(null);
                                    }}
                                    placeholder="Enter 6-digit OTP"
                                    icon="key-outline"
                                    keyboardType="number-pad"
                                    maxLength={6}
                                    autoFocus
                                    error={error}
                                />
                            )}

                            <CustomButton
                                title={otpSent ? 'Verify OTP' : 'Send OTP'}
                                onPress={otpSent ? handleVerifyOTP : handleSendOTP}
                                loading={loading}
                                style={styles.submitButton}
                            />

                            {otpSent && (
                                <TouchableOpacity
                                    onPress={() => {
                                        setOtpSent(false);
                                        setOtp('');
                                        setError(null);
                                    }}
                                    style={styles.resendLink}
                                >
                                    <Text style={styles.resendText}>Didn't receive code? Send again</Text>
                                </TouchableOpacity>
                            )}

                            <View style={styles.loginContainer}>
                                <Text style={styles.loginText}>Remember your password? </Text>
                                <TouchableOpacity onPress={() => navigation.navigate('Auth')}>
                                    <Text style={styles.loginLink}>Sign In</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    gradient: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: 24,
        paddingBottom: 40,
    },
    header: {
        alignItems: 'center',
        paddingTop: 20,
        paddingBottom: 30,
    },
    backButton: {
        position: 'absolute',
        left: 0,
        top: 20,
        padding: 8,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 32,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.9)',
        textAlign: 'center',
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
    },
    submitButton: {
        marginTop: 8,
        marginBottom: 16,
    },
    resendLink: {
        marginBottom: 24,
        alignItems: 'center',
    },
    resendText: {
        color: colors.primary[600],
        fontSize: 14,
        fontWeight: '600',
    },
    loginContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
    },
    loginText: {
        fontSize: 14,
        color: colors.text.secondary,
    },
    loginLink: {
        fontSize: 14,
        color: colors.primary[600],
        fontWeight: '700',
    },
});
