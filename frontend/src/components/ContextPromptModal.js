import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet, Platform, KeyboardAvoidingView } from 'react-native';

export default function ContextPromptModal({ visible, contextLabel, onSave, onSkip }) {
    const [value, setValue] = useState('');
    const [hours, setHours] = useState('');

    useEffect(() => {
        if (visible) {
            setValue('');
            setHours('');
        }
    }, [visible]);

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onSkip}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
                <View style={styles.card}>
                    <Text style={styles.title}>Quick question</Text>
                    <Text style={styles.subtitle}>Where is your {contextLabel}?</Text>

                    <TextInput
                        style={styles.input}
                        placeholder="Add address or description"
                        value={value}
                        onChangeText={setValue}
                        autoFocus={true}
                        placeholderTextColor="#9ca3af"
                    />

                    <TextInput
                        style={styles.input}
                        placeholder="Working hours (optional)"
                        value={hours}
                        onChangeText={setHours}
                        placeholderTextColor="#9ca3af"
                    />

                    <View style={styles.actions}>
                        <TouchableOpacity style={styles.secondaryBtn} onPress={onSkip}>
                            <Text style={styles.secondaryText}>Not now</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.primaryBtn, !value.trim() && styles.primaryBtnDisabled]}
                            onPress={() => onSave(value.trim(), hours.trim())}
                            disabled={!value.trim()}
                        >
                            <Text style={styles.primaryText}>Save</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 18,
        padding: 20,
        width: '100%',
        maxWidth: 420,
    },
    title: {
        fontSize: 18,
        fontWeight: '800',
        color: '#111827',
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 16,
    },
    input: {
        height: 46,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        paddingHorizontal: 12,
        fontSize: 15,
        backgroundColor: '#f9fafb',
        marginBottom: 12,
    },
    actions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 8,
    },
    secondaryBtn: {
        flex: 1,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        paddingVertical: 12,
        alignItems: 'center',
        backgroundColor: '#f9fafb',
    },
    secondaryText: {
        fontWeight: '700',
        color: '#6b7280',
    },
    primaryBtn: {
        flex: 1,
        borderRadius: 12,
        paddingVertical: 12,
        alignItems: 'center',
        backgroundColor: '#2f855a',
    },
    primaryBtnDisabled: {
        backgroundColor: '#a7f3d0',
    },
    primaryText: {
        fontWeight: '700',
        color: '#fff',
    },
});
