import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
          <MaterialCommunityIcons name="alert-circle-outline" size={56} color={COLORS.red} style={styles.icon} />
          <Text style={styles.title}>Check engine light: on</Text>
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
    backgroundColor: 'rgba(40, 26, 24, 0.97)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  content: { alignItems: 'center' },
  icon: { marginBottom: 16 },
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
