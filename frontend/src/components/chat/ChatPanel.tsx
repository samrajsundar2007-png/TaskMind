import React, { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Send,
  User as UserIcon,
  CheckCircle2,
  Mic,
  Copy,
  Check,
  Volume2,
  VolumeX,
} from 'lucide-react';
import logoImg from '../../assets/logo.png';
import type { ChatMessage } from '../../types';
import * as chatService from '../../services/chat';
import * as voiceService from '../../services/voice';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';
import { VoiceModal } from '../voice/VoiceModal';
import { MarkdownRenderer } from './MarkdownRenderer';

interface ChatPanelProps {
  chatInputRef?: React.RefObject<HTMLInputElement | null>;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  chatInputRef,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [inputMessage, setInputMessage] = useState('');
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: "👋 Hi! I'm **TaskMind**, your ChatGPT-powered task and productivity assistant.\n\nType or speak any task naturally, for example:\n- `Remind me to call John tomorrow at 3pm`\n- `What are my high priority tasks today?`\n- `Give me a breakdown of my schedule this week`",
      timestamp: new Date().toISOString(),
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const chatMutation = useMutation({
    mutationFn: (text: string) =>
      chatService.sendChatMessage({
        message: text,
        user_id: user?.id,
        session_id: `session_${user?.id || 1}`,
      }),
    onSuccess: (data) => {
      const assistantMsg: ChatMessage = {
        id: `assistant_${Date.now()}`,
        sender: 'assistant',
        text: data.reply,
        timestamp: new Date().toISOString(),
        tool_calls: data.tool_calls,
        requires_confirmation: data.requires_confirmation,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['taskSummary'] });
    },
    onError: () => {
      const errorMsg: ChatMessage = {
        id: `error_${Date.now()}`,
        sender: 'assistant',
        text: 'Sorry, I encountered an issue processing that. Please try again.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    },
  });

  const handleSend = (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || chatMutation.isPending) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    chatMutation.mutate(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopyMessage = (msgId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(msgId);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const handlePlayAudio = async (msgId: string, text: string) => {
    if (playingAudioId === msgId) {
      activeAudioRef.current?.pause();
      setPlayingAudioId(null);
      return;
    }

    try {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause();
      }

      setPlayingAudioId(msgId);
      const selectedVoice = localStorage.getItem('taskmind_voice') || 'en-US-JennyNeural';
      const audioBlob = await voiceService.synthesizeSpeech(text, selectedVoice);
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      activeAudioRef.current = audio;

      audio.onended = () => {
        setPlayingAudioId(null);
        URL.revokeObjectURL(audioUrl);
      };
      audio.onerror = () => {
        setPlayingAudioId(null);
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
    } catch (err) {
      console.error('Audio playback failed:', err);
      setPlayingAudioId(null);
    }
  };

  const suggestions = [
    'Add task Submit Q3 report tomorrow at 5pm urgent',
    'Show my tasks for today',
    'What are my high priority tasks?',
    'Give me a summary of my schedule',
  ];

  return (
    <div className="flex flex-col h-full bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-2xs">
      {/* Chat Header with Official Logo */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-2.5">
          <img
            src={logoImg}
            alt="TaskMind"
            className="w-8 h-8 object-contain rounded-xl border border-indigo-100 bg-white shadow-2xs"
          />
          <div>
            <h2 className="text-sm font-bold text-gray-900 leading-none flex items-center gap-1.5">
              <span>TaskMind AI</span>
              <span className="text-3xs px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200/80">
                GPT
              </span>
            </h2>
            <p className="text-3xs text-gray-500 mt-1 font-medium">Conversational Task Intelligence</p>
          </div>
        </div>

        {/* Voice Trigger Button */}
        <Button
          onClick={() => setIsVoiceModalOpen(true)}
          variant="outline"
          size="sm"
          className="border-indigo-200 text-indigo-700 bg-indigo-50/60 hover:bg-indigo-100/70"
          icon={<Mic size={14} className="text-indigo-600" />}
        >
          <span>Voice</span>
        </Button>
      </div>

      {/* Message Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-2.5 ${
              msg.sender === 'user' ? 'flex-row-reverse' : ''
            }`}
          >
            {/* Avatar */}
            {msg.sender === 'user' ? (
              <div className="w-7 h-7 rounded-xl flex items-center justify-center text-xs shrink-0 select-none bg-gray-900 text-white">
                <UserIcon size={14} />
              </div>
            ) : (
              <img
                src={logoImg}
                alt="TaskMind"
                className="w-7 h-7 object-contain rounded-xl border border-indigo-100 bg-white shrink-0 shadow-2xs"
              />
            )}

            {/* Bubble */}
            <div
              className={`max-w-[85%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed group relative ${
                msg.sender === 'user'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-gray-100/80 border border-gray-200/80 text-gray-900 shadow-2xs'
              }`}
            >
              {msg.sender === 'user' ? (
                <p className="whitespace-pre-wrap">{msg.text}</p>
              ) : (
                <MarkdownRenderer content={msg.text} />
              )}

              {/* Tool Execution Badges */}
              {msg.tool_calls && msg.tool_calls.length > 0 && (
                <div className="mt-2.5 pt-2 border-t border-gray-200/60 space-y-1.5">
                  {msg.tool_calls.map((tc) => (
                    <div
                      key={tc.id}
                      className="flex items-center gap-1.5 text-2xs font-semibold px-2 py-1 rounded-lg bg-white/80 border border-gray-200 text-indigo-700"
                    >
                      <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                      <span className="truncate">Executed: {tc.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Action Toolbar for Assistant Messages (Copy, Speak) */}
              {msg.sender === 'assistant' && (
                <div className="mt-2.5 pt-2 border-t border-gray-200/60 flex items-center justify-between text-2xs text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleCopyMessage(msg.id, msg.text)}
                      className="p-1 rounded-md hover:bg-gray-200/70 text-gray-500 hover:text-gray-800 transition-colors cursor-pointer flex items-center gap-1"
                      title="Copy response"
                    >
                      {copiedMsgId === msg.id ? (
                        <>
                          <Check size={12} className="text-emerald-600" />
                          <span className="text-emerald-600 font-semibold">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy size={12} />
                          <span>Copy</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handlePlayAudio(msg.id, msg.text)}
                      className={`p-1 rounded-md hover:bg-gray-200/70 transition-colors cursor-pointer flex items-center gap-1 ${
                        playingAudioId === msg.id ? 'text-indigo-600 font-semibold' : 'text-gray-500 hover:text-gray-800'
                      }`}
                      title={playingAudioId === msg.id ? 'Stop audio' : 'Listen to response'}
                    >
                      {playingAudioId === msg.id ? (
                        <>
                          <VolumeX size={12} className="animate-pulse" />
                          <span>Stop</span>
                        </>
                      ) : (
                        <>
                          <Volume2 size={12} />
                          <span>Speak</span>
                        </>
                      )}
                    </button>
                  </div>

                  <span className="text-3xs text-gray-400">
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}

              {/* Confirmation Action for Delete */}
              {msg.requires_confirmation && (
                <div className="mt-3 pt-2.5 border-t border-gray-200 flex items-center gap-2">
                  <button
                    onClick={() => handleSend('Yes, confirm delete')}
                    className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-2xs transition-all cursor-pointer"
                  >
                    Confirm Delete
                  </button>
                  <button
                    onClick={() => handleSend('Cancel')}
                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 text-xs font-medium shadow-2xs transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {chatMutation.isPending && (
          <div className="flex items-start gap-2.5">
            <img
              src={logoImg}
              alt="TaskMind"
              className="w-7 h-7 object-contain rounded-xl border border-indigo-100 bg-white shrink-0 shadow-2xs animate-pulse"
            />
            <div className="bg-gray-100 border border-gray-200 rounded-2xl px-4 py-3 text-xs text-gray-500 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce [animation-delay:0.4s]" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Pills */}
      {messages.length <= 3 && (
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/40 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {suggestions.map((sug, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(sug)}
              className="text-2xs font-medium px-2.5 py-1 rounded-full bg-white hover:bg-indigo-50 border border-gray-200 hover:border-indigo-200 text-gray-600 hover:text-indigo-700 transition-all shrink-0 cursor-pointer text-left"
            >
              {sug}
            </button>
          ))}
        </div>
      )}

      {/* Input Form with Mic trigger */}
      <div className="p-3.5 border-t border-gray-100 bg-white">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              ref={chatInputRef}
              type="text"
              placeholder="Ask anything or speak tasks in natural language..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-gray-50/90 hover:bg-gray-100/80 focus:bg-white text-gray-900 border border-gray-200 rounded-2xl px-4 py-2.5 text-xs sm:text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors min-h-[44px]"
            />
          </div>

          <Button
            type="button"
            onClick={() => setIsVoiceModalOpen(true)}
            variant="outline"
            size="md"
            className="rounded-2xl px-3 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/50"
            aria-label="Speak task"
          >
            <Mic size={16} className="text-indigo-600" />
          </Button>

          <Button
            onClick={() => handleSend()}
            variant="primary"
            size="md"
            disabled={!inputMessage.trim() || chatMutation.isPending}
            className="rounded-2xl px-4 shadow-2xs"
            aria-label="Send message"
          >
            <Send size={16} />
          </Button>
        </div>
      </div>

      {/* Embedded Voice Modal */}
      <VoiceModal
        isOpen={isVoiceModalOpen}
        onClose={() => setIsVoiceModalOpen(false)}
      />
    </div>
  );
};
