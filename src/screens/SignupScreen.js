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
import { CustomInput } from '../components/CustomInput';
import { CustomButton } from '../components/CustomButton';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';

export const SignupScreen = ({ navigation }) => {
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
    });

    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [passwordStrength, setPasswordStrength] = useState(0);

    const validateEmail = (email) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    };

    const validatePhone = (phone) => {
        if (!phone) return true; // Phone is optional
        const re = /^[0-9]{10}$/;
        return re.test(phone.replace(/[^0-9]/g, ''));
    };

    const calculatePasswordStrength = (password) => {
        let strength = 0;
        if (password.length >= 8) strength++;
        if (password.length >= 12) strength++;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
        if (/[0-9]/.test(password)) strength++;
        if (/[^a-zA-Z0-9]/.test(password)) strength++;
        return Math.min(strength, 3); // 0-3 scale
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));

        // Clear error for this field
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: '' }));
        }

        // Update password strength
        if (field === 'password') {
            setPasswordStrength(calculatePasswordStrength(value));
        }
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.fullName.trim()) {
            newErrors.fullName = 'Full name is required';
        }

        if (!formData.email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!validateEmail(formData.email)) {
            newErrors.email = 'Please enter a valid email';
        }

        if (!formData.password) {
            newErrors.password = 'Password is required';
        } else if (formData.password.length < 8) {
            newErrors.password = 'Password must be at least 8 characters';
        }

        if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
        }

        if (formData.phone && !validatePhone(formData.phone)) {
            newErrors.phone = 'Please enter a valid 10-digit phone number';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSignup = async () => {
        if (!validateForm()) return;

        setLoading(true);
        try {
            // 1. Sign up with Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        full_name: formData.fullName,
                        phone: formData.phone || null,
                    },
                },
            });

            if (authError) throw authError;

            // 2. Create user profile in profiles table
            if (authData.user) {
                const { error: profileError } = await supabase
                    .from('profiles')
                    .insert({
                        id: authData.user.id,
                        full_name: formData.fullName,
                        // email: formData.email, // Removed: Column does not exist in profiles table
                        phone: formData.phone || null,
                        created_at: new Date().toISOString(),
                    });

                if (profileError) {
                    console.warn('Profile creation error:', profileError);
                    // Don't fail signup if profile creation fails
                }
            }

            Alert.alert(
                'Success!',
                'Account created successfully! Please check your email to verify your account.',
                [
                    {
                        text: 'OK',
                        onPress: () => navigation.navigate('Auth'),
                    },
                ]
            );
        } catch (error) {
            console.error('Signup error:', error);
            Alert.alert('Signup Failed', error.message || 'An error occurred during signup');
        } finally {
            setLoading(false);
        }
    };

    const getPasswordStrengthColor = () => {
        if (passwordStrength === 0) return colors.gray[300];
        if (passwordStrength === 1) return colors.error;
        if (passwordStrength === 2) return colors.warning;
        return colors.success;
    };

    const getPasswordStrengthText = () => {
        if (passwordStrength === 0) return '';
        if (passwordStrength === 1) return 'Weak';
        if (passwordStrength === 2) return 'Medium';
        return 'Strong';
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
                                <Ionicons name="medical" size={48} color="#fff" />
                            </View>
                            <Text style={styles.title}>Create Account</Text>
                            <Text style={styles.subtitle}>Join us to track your medicines</Text>
                        </View>

                        {/* Form Card */}
                        <View style={styles.card}>
                            <CustomInput
                                label="Full Name"
                                value={formData.fullName}
                                onChangeText={(value) => handleInputChange('fullName', value)}
                                placeholder="Enter your full name"
                                icon="person-outline"
                                autoCapitalize="words"
                                error={errors.fullName}
                            />

                            <CustomInput
                                label="Email Address"
                                value={formData.email}
                                onChangeText={(value) => handleInputChange('email', value)}
                                placeholder="Enter your email address"
                                icon="mail-outline"
                                keyboardType="email-address"
                                error={errors.email}
                            />

                            <CustomInput
                                label="Phone Number (Optional)"
                                value={formData.phone}
                                onChangeText={(value) => handleInputChange('phone', value)}
                                placeholder="Enter your phone number"
                                icon="call-outline"
                                keyboardType="phone-pad"
                                error={errors.phone}
                            />

                            <CustomInput
                                label="Password"
                                value={formData.password}
                                onChangeText={(value) => handleInputChange('password', value)}
                                placeholder="Create a password"
                                icon="lock-closed-outline"
                                secureTextEntry
                                error={errors.password}
                            />

                            {/* Password Strength Indicator */}
                            {formData.password.length > 0 && (
                                <View style={styles.strengthContainer}>
                                    <View style={styles.strengthBar}>
                                        <View
                                            style={[
                                                styles.strengthFill,
                                                {
                                                    width: `${(passwordStrength / 3) * 100}%`,
                                                    backgroundColor: getPasswordStrengthColor(),
                                                },
                                            ]}
                                        />
                                    </View>
                                    <Text style={[styles.strengthText, { color: getPasswordStrengthColor() }]}>
                                        {getPasswordStrengthText()}
                                    </Text>
                                </View>
                            )}

                            <CustomInput
                                label="Confirm Password"
                                value={formData.confirmPassword}
                                onChangeText={(value) => handleInputChange('confirmPassword', value)}
                                placeholder="Confirm your password"
                                icon="lock-closed-outline"
                                secureTextEntry
                                error={errors.confirmPassword}
                            />

                            <CustomButton
                                title="Create Account"
                                onPress={handleSignup}
                                loading={loading}
                                style={styles.signupButton}
                            />

                            <View style={styles.loginContainer}>
                                <Text style={styles.loginText}>Already have an account? </Text>
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
    strengthContainer: {
        marginBottom: 20,
        marginTop: -12,
    },
    strengthBar: {
        height: 4,
        backgroundColor: colors.gray[200],
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: 4,
    },
    strengthFill: {
        height: '100%',
        borderRadius: 2,
    },
    strengthText: {
        fontSize: 12,
        fontWeight: '600',
        textAlign: 'right',
    },
    signupButton: {
        marginTop: 8,
    },
    loginContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 24,
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
