import React, { useState, useRef } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { supabase } from '../lib/supabase';

const initialMessage = {
  id: 'intro',
  role: 'bot',
  text: 'Hi! I am Dr. AI. Ask me anything about your medicines, dosage reminders, or general medical instructions and I will share evidence-based guidance. I am not a doctor, so double-check urgent questions with your physician.',
};

export const ChatScreen = () => {
  const [messages, setMessages] = useState([initialMessage]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef(null);

  const sendPrompt = async () => {
    if (!input.trim() || sending) return;
    const prompt = input.trim();
    setInput('');
    const userMessage = { id: Date.now().toString(), role: 'user', text: prompt };
    setMessages((prev) => [...prev, userMessage]);
    setSending(true);

    // Create a placeholder bot message
    const botMessageId = `${Date.now()}-bot`;
    setMessages((prev) => [...prev, { id: botMessageId, role: 'bot', text: '...' }]);

    try {
      const systemPrompt = `You are a friendly and empathetic medical assistant acting as a Doctor. 
      Your responses must be:
      1. **Short and Concise**: Avoid long paragraphs.
      2. **Summarized**: Give the key information immediately.
      3. **Numbered Lists**: Use numbered lists (1., 2., 3.) for steps or points. Do NOT use bullet points (*).
      4. **Friendly Tone**: Be polite and reassuring.
      
      Always include a brief disclaimer that you are an AI and not a substitute for professional medical advice.
      If the user asks about non-medical topics, politely redirect them.`;

      const history = messages
        .filter((m) => m.id !== 'intro')
        .map((m) => ({
          role: m.role === 'user' ? 'user' : 'model',
          text: m.text,
        }));

      // Add current message
      history.push({ role: 'user', text: `${systemPrompt}\n\nUser Query: ${prompt}` });

      const { data, error } = await supabase.functions.invoke('chat', {
        body: { messages: history },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data) throw new Error('No data received from chat service');

      const fullText = data.text || "I'm sorry, I couldn't generate a response.";

      // Simulate streaming (Typewriter effect)
      let currentText = '';
      const chunkSize = 4;

      for (let i = 0; i < fullText.length; i += chunkSize) {
        currentText = fullText.slice(0, i + chunkSize);

        setMessages((prev) => {
          const newMessages = [...prev];
          const index = newMessages.findIndex((m) => m.id === botMessageId);
          if (index !== -1) {
            newMessages[index] = { ...newMessages[index], text: currentText };
          }
          return newMessages;
        });

        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Ensure full text is set at the end
      setMessages((prev) => {
        const newMessages = [...prev];
        const index = newMessages.findIndex((m) => m.id === botMessageId);
        if (index !== -1) {
          newMessages[index] = { ...newMessages[index], text: fullText };
        }
        return newMessages;
      });

    } catch (err) {
      console.warn('Chat failure', err);
      setMessages((prev) => {
        const newMessages = [...prev];
        const index = newMessages.findIndex((m) => m.id === botMessageId);
        if (index !== -1) {
          newMessages[index] = {
            ...newMessages[index],
            text: `I had trouble reaching the medical assistant. ${err.message || 'Please check your connection.'}`
          };
        }
        return newMessages;
      });
    } finally {
      setSending(false);
    }
  };

  const renderItem = ({ item }) => (
    <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.botBubble]}>
      <Text style={[styles.bubbleText, item.role === 'user' && styles.userText]}>{item.text}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 30}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Dr. AI</Text>
          <Text style={styles.subtitle}>Your friendly medical assistant</Text>
        </View>
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.chatContent}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />
        <View style={styles.inputRow}>
          <TextInput
            placeholder="Ask about symptoms, medicines..."
            style={styles.input}
            value={input}
            onChangeText={setInput}
            multiline
            placeholderTextColor="#9ca3af"
          />
          <Ionicons
            name="send"
            size={24}
            color={sending ? '#9ca3af' : '#008080'}
            style={styles.sendIcon}
            onPress={sendPrompt}
          />
        </View>
        {sending && (
          <View style={styles.loader}>
            <ActivityIndicator color="#008080" />
            <Text style={styles.loaderText}>Dr. AI is typing...</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F0F8FF', // AliceBlue - softer background
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginTop: 10, // Added top margin
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E6E6FA', // Lavender border
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#008080', // Teal
    letterSpacing: 0.5,
  },
  subtitle: {
    color: '#708090', // SlateGray
    fontSize: 12,
    marginTop: 2,
  },
  chatContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    paddingTop: 20,
    gap: 16,
  },
  bubble: {
    padding: 16,
    borderRadius: 20,
    maxWidth: '85%',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  botBubble: {
    backgroundColor: '#FFFFFF',
    alignSelf: 'flex-start',
    borderTopLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  userBubble: {
    backgroundColor: '#008080',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  bubbleText: {
    color: '#2F4F4F', // DarkSlateGray
    lineHeight: 24,
    fontSize: 16,
  },
  userText: {
    color: '#fff',
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 5, // Raised input row further
    backgroundColor: '#fff',
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#E0FFFF', // LightCyan
  },
  input: {
    flex: 1,
    maxHeight: 100,
    fontSize: 16,
    color: '#333',
  },
  sendIcon: {
    marginLeft: 12,
  },
  loader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  loaderText: {
    color: '#008080',
    fontSize: 14,
    fontWeight: '600',
  },
});
