import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../utils/colors';

interface AlertOverlayProps {
  visible: boolean;
  message: string;
  onClose: () => void;
}

export default function AlertOverlay({ visible, message, onClose }: AlertOverlayProps) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Text style={styles.icon}>⚠</Text>
          <Text style={styles.title}>Check Engine Light: RED</Text>
          <Text style={styles.message}>{message}</Text>
          <TouchableOpacity style={styles.button} onPress={onClose}>
            <Text style={styles.buttonText}>I see this</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(127, 29, 29, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  content: { alignItems: 'center' },
  icon: { fontSize: 64, marginBottom: 16 },
  title: { color: COLORS.text, fontSize: 24, fontWeight: '800', marginBottom: 12 },
  message: { color: COLORS.text, fontSize: 16, textAlign: 'center', marginBottom: 24 },
  button: {
    backgroundColor: COLORS.text,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  buttonText: { color: COLORS.red, fontWeight: '700', fontSize: 16 },
});
