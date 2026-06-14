# Making the Message History screen functional

`src/screens/MessageHistoryScreen.tsx` is a read-only UI shell: it renders
`MESSAGES`, a hardcoded iMessage-style thread with "Pegasus Coach", plus a
small metrics row (message count, last active, overall sentiment) computed
from that same hardcoded array. There is no input/send UI — this screen is
purely a transparency view into a conversation the app has already ingested.

## 1. Replace the mock thread

```ts
const [messages, setMessages] = useState<ChatMessage[]>([]);

useEffect(() => {
  getMessageHistory(userId).then(setMessages);
}, [userId]);
```

`getMessageHistory(userId)` should live in the shared `api.ts` and return
`ChatMessage[]` ordered oldest-first, matching the existing shape:

```ts
interface ChatMessage {
  id: string;
  from: 'user' | 'ai';
  text: string;
  time: string; // display label, e.g. "4:32 PM"
  date: string;  // display label, e.g. "Yesterday" / "Today"
}
```

## 2. Metrics row

`CONVERSATION_SENTIMENT` is currently a hardcoded constant. Once real data
is wired up, either:
- have the backend return it alongside the thread (e.g.
  `{ messages: ChatMessage[], sentiment: Level }`), or
- compute it client-side from the messages (e.g. reuse whatever sentiment
  scoring the `signals`/`ml` pipeline already applies to `from: 'user'`
  messages).

"Last active" is derived from `messages[messages.length - 1]` and needs no
extra wiring once `messages` is real.

## 3. ⚠️ Getting the underlying iMessage data

This is the part that isn't just a wiring exercise: **iOS does not give
third-party apps any API to read the Messages/iMessage database.** The
`chat.db` SQLite store is only accessible to apps with Full Disk Access on
**macOS** (and to Messages.app itself on iOS) — there's no
`expo-`/public-API equivalent, and Apple will reject apps that try to work
around this.

Realistic paths, roughly in order of effort:

1. **Treat this as a stand-in for the AI-coach conversation log** the
   backend already maintains (i.e. the same store that would back a future
   "chat with your coach" feature) rather than literal iMessage data — drop
   the "synced from iMessage" framing if so.
2. **macOS companion app**: a small Mac helper with Full Disk Access reads
   `~/Library/Messages/chat.db`, computes/uploads the relevant
   messages/metrics to the backend, and the mobile app just calls
   `getMessageHistory(userId)` as above. Viable for a prototype where the
   user runs a one-time sync from their Mac.
3. **Manual export**: user exports a chat (e.g. via the Shortcuts app or a
   third-party export tool) and shares it into Pegasus; the backend parses
   and stores it.

Whoever picks this up should confirm which of these (if any) matches the
actual data source before wiring `getMessageHistory` — otherwise the
"Read-only · synced from iMessage" label will be misleading to users.

## 4. Empty / loading state

While `messages` is empty (first load, or no synced data yet), show a small
empty state instead of an empty FlatList — e.g. "No message history yet".
