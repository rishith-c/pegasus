import React from 'react';
import { TextInput, StyleSheet, NativeSyntheticEvent, TextInputKeyPressEventData } from 'react-native';
import { COLORS } from '../utils/colors';

interface ResponseInputProps {
  value: string;
  onChangeText: (text: string) => void;
  onKeyPress?: (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => void;
  placeholder?: string;
}

export default function ResponseInput({ value, onChangeText, onKeyPress, placeholder }: ResponseInputProps) {
  return (
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      onKeyPress={onKeyPress}
      placeholder={placeholder ?? "What's on your mind?"}
      placeholderTextColor={COLORS.textDim}
      multiline
      numberOfLines={5}
      textAlignVertical="top"
    />
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    color: COLORS.text,
    fontSize: 16,
    minHeight: 120,
    width: '100%',
  },
});
