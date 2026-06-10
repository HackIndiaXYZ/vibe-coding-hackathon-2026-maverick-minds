/**
 * chatbot.tsx — Local AI chat, amber design.
 * White AI bubbles, amber-tinted user bubbles, clean compose bar.
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/use-theme';
import { useServerConfig } from '@/hooks/use-server-config';
import { TAB_BAR_HEIGHT } from '@/constants/theme';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  sources?: string[];
}

const CHAT_PORT   = '9090';

export default function ChatbotScreen() {
  const theme  = useTheme();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const { hostIp } = useServerConfig();

  const [messages, setMessages] = useState<Message[]>([{
    id: 'welcome',
    role: 'assistant',
    content: 'Hello! I am your local cloud assistant. Ask me anything about your indexed files.',
    timestamp: new Date().toISOString(),
  }]);
  const [inputText, setInputText]   = useState('');
  const [sending, setSending]       = useState(false);
  const [sessionId, setSessionId]   = useState<string | null>(null);
  const [status, setStatus]         = useState<'online' | 'offline'>('offline');

  const baseUrl = `http://${hostIp}:${CHAT_PORT}`;

  const checkStatus = async () => {
    try {
      const res  = await fetch(`${baseUrl}/api/status`, { signal: AbortSignal.timeout(3000) });
      const data = await res.json();
      setStatus(data.running ? 'online' : 'offline');
    } catch {
      setStatus('offline');
    }
  };

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending) return;
    setInputText('');
    const userMsg: Message = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMsg]);
    setSending(true);
    try {
      const res  = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId: sessionId || undefined, useContext: true }),
      });
      const data = await res.json();
      if (data.sessionId) setSessionId(data.sessionId);
      if (data.message) {
        setMessages(prev => [...prev, {
          id: `msg-${Date.now()}-assistant`,
          role: 'assistant',
          content: data.message.content,
          timestamp: data.message.timestamp,
          sources: data.message.sources,
        }]);
      } else if (data.error) throw new Error(data.error);
    } catch (e: any) {
      setMessages(prev => [...prev, {
        id: `msg-${Date.now()}-err`,
        role: 'assistant',
        content: `Connection error — make sure the local cloud server is running. (${e.message})`,
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setSending(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const handleNewSession = () => {
    setSessionId(null);
    setMessages([{
      id: `welcome-${Date.now()}`,
      role: 'assistant',
      content: 'Session reset. How can I help you?',
      timestamp: new Date().toISOString(),
    }]);
  };

  const isOnline = status === 'online';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.root, { backgroundColor: theme.background }]}
    >
      {/* ── Header ── */}
      <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 16, paddingBottom: 12 }}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.pageTitle, { color: theme.text }]}>Local AI</Text>
            <View style={styles.statusRow}>
              <View style={[styles.statusDot, { backgroundColor: isOnline ? theme.success : theme.error }]} />
              <Text style={[styles.statusLabel, { color: theme.text, opacity: 0.6 }]}>
                {isOnline ? 'Engine online' : 'Engine offline'}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={handleNewSession}
            style={({ pressed }) => [styles.newBtn, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[styles.newBtnText, { color: theme.text }]}>New chat</Text>
          </Pressable>
        </View>
      </View>

      {/* ── Messages ── */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={item => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingBottom: 20,
        }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const isUser = item.role === 'user';
          return (
            <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowBot]}>
              {/* Avatar */}
              {!isUser && (
                <View style={[styles.avatar, { backgroundColor: theme.backgroundElement }]}>
                  <Text style={{ fontSize: 12, color: theme.textSecondary }}>AI</Text>
                </View>
              )}

              <View style={[
                styles.bubble,
                isUser
                  ? { backgroundColor: theme.backgroundElement, alignSelf: 'flex-end' }
                  : { backgroundColor: theme.backgroundElement, alignSelf: 'flex-start' },
              ]}>
                <Text style={[styles.bubbleText, { color: theme.text }]}>{item.content}</Text>
                {item.sources && item.sources.length > 0 && (
                  <View style={styles.sourcesWrap}>
                    {item.sources.map((src: string, i: number) => (
                      <View key={i} style={[styles.sourceChip, { backgroundColor: theme.background + '33' }]}>
                        <Text style={[styles.sourceChipText, { color: theme.textSecondary }]} numberOfLines={1}>📄 {src}</Text>
                      </View>
                    ))}
                  </View>
                )}
                <Text style={[styles.bubbleTime, { color: theme.textMuted }]}>
                  {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>

              {isUser && (
                <View style={[styles.avatar, { backgroundColor: theme.text }]}>
                  <Text style={{ fontSize: 10, color: theme.backgroundElement, fontWeight: '700' }}>You</Text>
                </View>
              )}
            </View>
          );
        }}
      />

      {/* ── Typing indicator ── */}
      {sending && (
        <View style={[styles.typingWrap, { paddingHorizontal: 16, paddingBottom: 4 }]}>
          <View style={[styles.avatar, { backgroundColor: theme.backgroundElement }]}>
            <Text style={{ fontSize: 12, color: theme.textSecondary }}>AI</Text>
          </View>
          <View style={[styles.bubble, { backgroundColor: theme.backgroundElement }]}>
            <ActivityIndicator size="small" color={theme.textMuted} />
          </View>
        </View>
      )}

      {/* ── Composer ── */}
      <View style={[
        styles.composer,
        {
          backgroundColor: theme.backgroundElement,
          paddingBottom: insets.bottom > 0 ? insets.bottom + TAB_BAR_HEIGHT : TAB_BAR_HEIGHT + 8,
        },
      ]}>
        <TextInput
          value={inputText}
          onChangeText={setInputText}
          placeholder={isOnline ? 'Ask about your files…' : 'AI engine offline'}
          placeholderTextColor={theme.textMuted}
          editable={isOnline && !sending}
          multiline
          style={[styles.composerInput, { color: theme.text }]}
          returnKeyType="send"
          onSubmitEditing={handleSend}
          blurOnSubmit
        />
        <Pressable
          onPress={handleSend}
          disabled={!inputText.trim() || sending || !isOnline}
          style={({ pressed }) => [
            styles.sendBtn,
            {
              backgroundColor: (!inputText.trim() || sending || !isOnline)
                ? theme.backgroundSelected
                : theme.text,
              opacity: pressed ? 0.8 : 1,
              transform: [{ scale: pressed ? 0.92 : 1 }],
            },
          ]}
        >
          <Text style={[
            styles.sendIcon,
            { color: (!inputText.trim() || sending || !isOnline) ? theme.textMuted : theme.backgroundElement },
          ]}>↑</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  // Header
  headerRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  pageTitle:  { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  statusRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  statusDot:  { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: 12, fontWeight: '500' },
  newBtn:     { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  newBtnText: { fontSize: 13, fontWeight: '600' },

  // Messages
  msgRow:        { flexDirection: 'row', marginBottom: 12, gap: 8, alignItems: 'flex-end' },
  msgRowUser:    { justifyContent: 'flex-end' },
  msgRowBot:     { justifyContent: 'flex-start' },
  avatar:        { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  bubble:        { maxWidth: '78%', padding: 12, borderRadius: 14 },
  bubbleText:    { fontSize: 14, lineHeight: 21, fontWeight: '400' },
  bubbleTime:    { fontSize: 10, marginTop: 6, textAlign: 'right' },
  typingWrap:    { flexDirection: 'row', gap: 8, alignItems: 'flex-end', marginBottom: 8 },

  // Sources
  sourcesWrap:     { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8, paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(0,0,0,0.06)' },
  sourceChip:      { paddingVertical: 2, paddingHorizontal: 8, borderRadius: 10 },
  sourceChipText:  { fontSize: 10, fontWeight: '500' },

  // Composer
  composer:      { borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 16, paddingTop: 12 },
  composerInput: { flex: 1, fontSize: 15, maxHeight: 120, fontWeight: '400', paddingTop: 0 },
  sendBtn:       { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  sendIcon:      { fontSize: 18, fontWeight: '700', marginTop: -2 },
});
