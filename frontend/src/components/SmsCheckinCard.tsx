// SmsCheckinCard — "put in your number and Pegasus will text you."
// Registers the phone with the signals service, then fires a pulse-check text
// (an emotionally-evocative image stimulus via Bloo.io). The user replies by
// message and the bot scores the reply. Self-contained; drop into any screen.
import React, { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { registerPhone, sendCheckin } from "../services/api";
import { DEFAULT_USER_ID } from "../services/config";
import { COLORS, RADIUS, SPACING, TYPE } from "../utils/colors";

type Status = "idle" | "sending" | "sent" | "error";

// Light E.164 normalization for US numbers: keep a leading +, otherwise assume
// +1 for 10 digits (or 11 starting with 1). Good enough for the demo.
function normalize(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) return "+" + trimmed.slice(1).replace(/\D/g, "");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return `+${digits}`;
}

export default function SmsCheckinCard() {
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [msg, setMsg] = useState<string | null>(null);

  const valid = phone.replace(/\D/g, "").length >= 10;

  const onSend = async () => {
    if (!valid || status === "sending") return;
    const e164 = normalize(phone);
    setStatus("sending");
    setMsg(null);
    try {
      await registerPhone(DEFAULT_USER_ID, e164);
      const res = await sendCheckin(DEFAULT_USER_ID, e164);
      if (res?.sent === false) {
        setStatus("error");
        setMsg(res.detail ?? "Couldn't send the text right now.");
      } else {
        setStatus("sent");
        setMsg(`Sent to ${e164} 📱 — check your messages and reply to it.`);
      }
    } catch (e: any) {
      setStatus("error");
      setMsg(e?.message ?? "Couldn't send. Is the signals service running?");
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title} allowFontScaling={false}>
        Get check-ins by text
      </Text>
      <Text style={styles.sub} allowFontScaling={false}>
        Pegasus texts you a quick image to react to, then reads your reply — no app needed.
      </Text>

      <View style={styles.row}>
        <TextInput
          style={styles.input}
          value={phone}
          onChangeText={(t) => {
            setPhone(t);
            if (status !== "idle") setStatus("idle");
          }}
          placeholder="(555) 123-4567"
          placeholderTextColor={COLORS.textDim}
          keyboardType="phone-pad"
          returnKeyType="send"
          onSubmitEditing={onSend}
          allowFontScaling={false}
        />
        <Pressable
          onPress={onSend}
          disabled={!valid || status === "sending"}
          style={({ pressed }) => [
            styles.btn,
            (!valid || status === "sending") && styles.btnDisabled,
            pressed && styles.pressed,
          ]}
        >
          {status === "sending" ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.btnText} allowFontScaling={false}>
              Text me
            </Text>
          )}
        </Pressable>
      </View>

      {msg ? (
        <Text
          style={[styles.msg, { color: status === "error" ? COLORS.yellow : COLORS.green }]}
          allowFontScaling={false}
        >
          {msg}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  title: { ...TYPE.heading, color: COLORS.text },
  sub: { ...TYPE.caption, color: COLORS.textDim, marginTop: SPACING.xs, lineHeight: 18 },
  row: { flexDirection: "row", alignItems: "center", marginTop: SPACING.md, gap: SPACING.sm },
  input: {
    flex: 1,
    height: 48,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    color: COLORS.text,
    ...TYPE.body,
  },
  btn: {
    height: 48,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.green,
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { ...TYPE.body, color: "#ffffff", fontWeight: "700" },
  pressed: { opacity: 0.7 },
  msg: { ...TYPE.caption, marginTop: SPACING.md, lineHeight: 18 },
});
