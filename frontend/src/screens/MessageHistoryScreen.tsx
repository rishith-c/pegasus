import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ColorTheme, Level, levelColor } from '../utils/colors';
import { useTheme } from '../theme/ThemeContext';

interface ChatMessage {
  id: string;
  from: 'user' | 'ai';
  text: string;
  time: string;
  date: string;
}

// TODO: replace with `await getMessageHistory(userId)`, read-only sync from iMessage — see docs/message-history-integration.md
const MESSAGES: ChatMessage[] = [
  {
    id: '1',
    from: 'ai',
    text: 'Hey! I noticed your stress indicators ticked up yesterday afternoon. Want to talk about what happened?',
    time: '4:32 PM',
    date: 'Yesterday',
  },
  { id: '2', from: 'user', text: 'yeah work was pretty intense, lots of back-to-back meetings', time: '4:35 PM', date: 'Yesterday' },
  { id: '3', from: 'ai', text: 'That sounds draining. Did you get a chance to take any breaks between them?', time: '4:36 PM', date: 'Yesterday' },
  { id: '4', from: 'user', text: 'not really, barely had time to eat lunch', time: '4:38 PM', date: 'Yesterday' },
  {
    id: '5',
    from: 'ai',
    text: 'Got it — I’ll flag "no breaks on meeting-heavy days" as a pattern. Try to block 10 minutes between meetings tomorrow if you can.',
    time: '4:40 PM',
    date: 'Yesterday',
  },
  { id: '6', from: 'user', text: 'will do, thanks', time: '4:41 PM', date: 'Yesterday' },
  { id: '7', from: 'ai', text: '👍 I’ll check in with you tomorrow afternoon to see how it went.', time: '4:41 PM', date: 'Yesterday' },
];

const CONVERSATION_SENTIMENT: Level = 'green';

function sentimentLabel(level: Level) {
  return level === 'green' ? 'Positive' : level === 'yellow' ? 'Mixed' : 'Strained';
}

export default function MessageHistoryScreen() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const last = MESSAGES[MESSAGES.length - 1];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Message History</Text>
        <View style={styles.readOnlyBadge}>
          <MaterialCommunityIcons name="lock-outline" size={12} color={colors.textDim} />
          <Text style={styles.readOnlyText}>Read-only · synced from iMessage</Text>
        </View>

        <View style={styles.contactRow}>
          <View style={styles.avatar}>
            <MaterialCommunityIcons name="brain" size={20} color="#05050a" />
          </View>
          <View>
            <Text style={styles.contact}>Pegasus Coach</Text>
            <Text style={styles.contactSubtitle}>AI companion</Text>
          </View>
        </View>

        <View style={styles.metricsRow}>
          <View style={styles.metricChip}>
            <MaterialCommunityIcons name="message-text-outline" size={12} color={colors.textDim} />
            <Text style={styles.metricText}>{MESSAGES.length} messages</Text>
          </View>
          <View style={styles.metricChip}>
            <MaterialCommunityIcons name="clock-outline" size={12} color={colors.textDim} />
            <Text style={styles.metricText}>
              Last active {last.date.toLowerCase()} · {last.time}
            </Text>
          </View>
          <View style={styles.metricChip}>
            <View style={[styles.sentimentDot, { backgroundColor: levelColor(CONVERSATION_SENTIMENT) }]} />
            <Text style={styles.metricText}>{sentimentLabel(CONVERSATION_SENTIMENT)}</Text>
          </View>
        </View>
      </View>

      <FlatList
        data={MESSAGES}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => {
          const showDate = index === 0 || MESSAGES[index - 1].date !== item.date;
          const isLastInGroup = index === MESSAGES.length - 1 || MESSAGES[index + 1].from !== item.from;
          const isUser = item.from === 'user';
          return (
            <View>
              {showDate && <Text style={styles.dateDivider}>{item.date}</Text>}
              <View style={[styles.bubbleRow, isUser ? styles.bubbleRowUser : styles.bubbleRowAi]}>
                <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAi]}>
                  <Text style={isUser ? styles.bubbleTextUser : styles.bubbleTextAi}>{item.text}</Text>
                </View>
              </View>
              {isLastInGroup && (
                <Text style={[styles.bubbleTime, isUser ? styles.bubbleTimeUser : styles.bubbleTimeAi]}>{item.time}</Text>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

function createStyles(colors: ColorTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    header: {
      paddingTop: 60,
      paddingHorizontal: 24,
      paddingBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    title: { color: colors.text, fontSize: 28, fontWeight: '800' },
    readOnlyBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6, marginBottom: 16 },
    readOnlyText: { color: colors.textDim, fontSize: 12 },
    contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.green,
      alignItems: 'center',
      justifyContent: 'center',
    },
    contact: { color: colors.text, fontSize: 16, fontWeight: '800' },
    contactSubtitle: { color: colors.textDim, fontSize: 12, marginTop: 2 },
    metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
    metricChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metricText: { color: colors.textDim, fontSize: 11 },
    sentimentDot: { width: 8, height: 8, borderRadius: 4 },
    list: { padding: 16, paddingBottom: 24 },
    dateDivider: {
      alignSelf: 'center',
      color: colors.textDim,
      fontSize: 12,
      marginVertical: 12,
    },
    bubbleRow: { flexDirection: 'row', marginBottom: 2 },
    bubbleRowUser: { justifyContent: 'flex-end' },
    bubbleRowAi: { justifyContent: 'flex-start' },
    bubble: {
      maxWidth: '78%',
      borderRadius: 18,
      paddingVertical: 10,
      paddingHorizontal: 14,
    },
    bubbleUser: { backgroundColor: colors.blue, borderBottomRightRadius: 4 },
    bubbleAi: { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderBottomLeftRadius: 4 },
    bubbleTextUser: { color: '#05050a', fontSize: 15, lineHeight: 20 },
    bubbleTextAi: { color: colors.text, fontSize: 15, lineHeight: 20 },
    bubbleTime: { fontSize: 11, color: colors.textDim, marginTop: 4, marginBottom: 8 },
    bubbleTimeUser: { alignSelf: 'flex-end', marginRight: 4 },
    bubbleTimeAi: { alignSelf: 'flex-start', marginLeft: 4 },
  });
}
