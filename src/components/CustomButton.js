import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { colors } from '../theme/colors';

export const CustomButton = ({
    title,
    onPress,
    loading = false,
    disabled = false,
    variant = 'primary', // primary, secondary, outline
    style,
}) => {
    if (variant === 'primary') {
        return (
            <TouchableOpacity
                onPress={onPress}
                disabled={disabled || loading}
                style={[styles.container, style]}
                activeOpacity={0.8}
            >
                <View
                    style={[
                        styles.gradient,
                        { backgroundColor: disabled ? colors.gray[300] : colors.primary[600] }
                    ]}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.text}>{title}</Text>
                    )}
                </View>
            </TouchableOpacity>
        );
    }

    if (variant === 'outline') {
        return (
            <TouchableOpacity
                onPress={onPress}
                disabled={disabled || loading}
                style={[styles.container, styles.outlineContainer, style]}
                activeOpacity={0.8}
            >
                {loading ? (
                    <ActivityIndicator color={colors.primary[600]} />
                ) : (
                    <Text style={styles.outlineText}>{title}</Text>
                )}
            </TouchableOpacity>
        );
    }

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled || loading}
            style={[styles.container, styles.secondaryContainer, style]}
            activeOpacity={0.8}
        >
            {loading ? (
                <ActivityIndicator color={colors.primary[600]} />
            ) : (
                <Text style={styles.secondaryText}>{title}</Text>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        borderRadius: 12,
        overflow: 'hidden',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    gradient: {
        paddingVertical: 16,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 56,
    },
    text: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    outlineContainer: {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: colors.primary[500],
        paddingVertical: 14,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 56,
    },
    outlineText: {
        color: colors.primary[600],
        fontSize: 16,
        fontWeight: '700',
    },
    secondaryContainer: {
        backgroundColor: colors.gray[100],
        paddingVertical: 16,
        paddingHorizontal: 24,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 56,
    },
    secondaryText: {
        color: colors.text.primary,
        fontSize: 16,
        fontWeight: '600',
    },
});
