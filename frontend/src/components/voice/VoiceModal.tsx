import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import confetti from 'canvas-confetti';
import {
  Mic,
  Square,
  Volume2,
  VolumeX,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import logoImg from '../../assets/logo.png';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { VoiceVisualizer } from './VoiceVisualizer';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import { useAuth } from '../../context/AuthContext';
import * as voiceService from '../../services/voice';
import type { ChatToolCall } from '../../types';

interface VoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  voiceName?: string;
}

type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'complete' | 'error';

export const VoiceModal: React.FC<VoiceModalProps> = ({
  isOpen,
  onClose,
  voiceName = 'en-US-JennyNeural',
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const {
    isRecording,
    isPlaying,
    audioLevel,
    duration,
    startRecording,
    stopRecording,
    cancelRecording,
    playAudioBase64,
    stopAudio,
    error: recorderError,
  } = useVoiceRecorder();

  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState<string>('');
  const [reply, setReply] = useState<string>('');
  const [toolCalls, setToolCalls] = useState<ChatToolCall[]>([]);
  const [lastAudioBase64, setLastAudioBase64] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset state when opening/closing
  useEffect(() => {
    if (isOpen) {
      setVoiceState('idle');
      setTranscript('');
      setReply('');
      setToolCalls([]);
      setLastAudioBase64('');
      setErrorMessage(null);
    } else {
      cancelRecording();
      stopAudio();
    }
  }, [isOpen]);

  const handleStartListening = async () => {
    setErrorMessage(null);
    const success = await startRecording();
    if (success) {
      setVoiceState('listening');
    } else {
      setVoiceState('error');
      setErrorMessage(recorderError || 'Could not start microphone.');
    }
  };

  const handleStopAndProcess = async () => {
    setVoiceState('processing');
    const audioBlob = await stopRecording();

    if (!audioBlob || audioBlob.size === 0) {
      setVoiceState('idle');
      return;
    }

    try {
      const response = await voiceService.sendVoiceChat(
        audioBlob,
        user?.id,
        `voice_session_${user?.id || 1}`,
        voiceName
      );

      setTranscript(response.transcript);
      setReply(response.reply);
      setToolCalls(response.tool_calls || []);
      setLastAudioBase64(response.audio_base64);

      // Invalidate queries so dashboard reflects any created or updated tasks
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['taskSummary'] });
      queryClient.invalidateQueries({ queryKey: ['dailyBriefing'] });

      // If tools were executed, trigger confetti
      if (response.tool_calls && response.tool_calls.length > 0) {
        confetti({
          particleCount: 40,
          spread: 50,
          origin: { y: 0.7 },
        });
      }

      // Play synthesized spoken reply
      if (response.audio_base64) {
        setVoiceState('speaking');
        playAudioBase64(response.audio_base64, () => {
          setVoiceState('complete');
        });
      } else {
        setVoiceState('complete');
      }
    } catch (err: any) {
      console.error('Voice chat failed:', err);
      setVoiceState('error');
      setErrorMessage(err?.response?.data?.detail || 'Voice processing failed. Please try again.');
    }
  };

  const handleReplaySpeech = () => {
    if (lastAudioBase64) {
      setVoiceState('speaking');
      playAudioBase64(lastAudioBase64, () => {
        setVoiceState('complete');
      });
    }
  };

  const getStateTitle = () => {
    switch (voiceState) {
      case 'listening':
        return 'Listening...';
      case 'processing':
        return 'Thinking & Scheduling...';
      case 'speaking':
        return 'Speaking Response...';
      case 'complete':
        return 'Completed';
      case 'error':
        return 'Voice Error';
      case 'idle':
      default:
        return 'TaskMind Voice Agent';
    }
  };

  const getStateSubtitle = () => {
    switch (voiceState) {
      case 'listening':
        return `Tap stop when done speaking (${duration}s)`;
      case 'processing':
        return 'Transcribing with Whisper STT & executing deterministic tools';
      case 'speaking':
        return 'Playing Edge Neural voice response';
      case 'complete':
        return 'Task updated successfully';
      case 'error':
        return errorMessage || 'An error occurred during voice communication';
      case 'idle':
      default:
        return 'Talk to TaskMind in natural language';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} maxWidth="lg">
      <div className="text-center space-y-5">
        {/* Header Title with Official Logo */}
        <div className="space-y-1">
          <img
            src={logoImg}
            alt="TaskMind"
            className="w-16 h-16 object-contain rounded-2xl mx-auto shadow-sm border border-indigo-100 bg-white"
          />
          <h2 className="text-lg font-bold text-gray-900 mt-3">{getStateTitle()}</h2>
          <p className="text-xs text-gray-500">{getStateSubtitle()}</p>
        </div>

        {/* Visualizer */}
        <VoiceVisualizer
          isRecording={isRecording}
          isPlaying={isPlaying}
          audioLevel={audioLevel}
        />

        {/* Live / Transcribed Dialog Card */}
        {(transcript || reply || voiceState === 'processing') && (
          <div className="bg-gray-50 border border-gray-200/80 rounded-2xl p-4 text-left space-y-3 animate-in fade-in">
            {transcript && (
              <div>
                <p className="text-3xs font-bold text-gray-400 uppercase tracking-wider">You said:</p>
                <p className="text-xs font-semibold text-gray-900 mt-0.5">"{transcript}"</p>
              </div>
            )}

            {voiceState === 'processing' && !reply && (
              <div className="flex items-center gap-2 text-xs text-indigo-600">
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce [animation-delay:0.2s]" />
                <span className="w-2 h-2 rounded-full bg-indigo-600 animate-bounce [animation-delay:0.4s]" />
                <span>Analyzing intent with LLM & scheduling...</span>
              </div>
            )}

            {reply && (
              <div className="pt-2 border-t border-gray-200/60">
                <p className="text-3xs font-bold text-indigo-600 uppercase tracking-wider">TaskMind:</p>
                <p className="text-xs text-gray-800 mt-0.5 whitespace-pre-wrap">{reply}</p>
              </div>
            )}

            {/* Executed Tools Badges */}
            {toolCalls.length > 0 && (
              <div className="pt-2 border-t border-gray-200/60 flex items-center gap-2 flex-wrap">
                {toolCalls.map((tc) => (
                  <span
                    key={tc.id}
                    className="inline-flex items-center gap-1 text-3xs font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200"
                  >
                    <CheckCircle2 size={12} />
                    <span>Executed: {tc.name}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium text-left">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Action Button Controls */}
        <div className="flex items-center justify-center gap-3 pt-2">
          {voiceState === 'idle' && (
            <Button
              onClick={handleStartListening}
              variant="primary"
              size="lg"
              className="rounded-full px-8 py-3.5 shadow-md bg-indigo-600 hover:bg-indigo-700"
              icon={<Mic size={20} />}
            >
              Start Speaking
            </Button>
          )}

          {voiceState === 'listening' && (
            <Button
              onClick={handleStopAndProcess}
              variant="danger"
              size="lg"
              className="rounded-full px-8 py-3.5 shadow-md animate-pulse"
              icon={<Square size={18} />}
            >
              Finish & Send
            </Button>
          )}

          {(voiceState === 'speaking' || isPlaying) && (
            <Button
              onClick={stopAudio}
              variant="outline"
              size="md"
              icon={<VolumeX size={16} />}
            >
              Mute Speech
            </Button>
          )}

          {(voiceState === 'complete' || voiceState === 'error') && (
            <>
              <Button
                onClick={handleStartListening}
                variant="primary"
                size="md"
                icon={<Mic size={16} />}
              >
                Speak Again
              </Button>

              {lastAudioBase64 && (
                <Button
                  onClick={handleReplaySpeech}
                  variant="outline"
                  size="md"
                  icon={<Volume2 size={16} />}
                >
                  Replay
                </Button>
              )}

              <Button
                onClick={onClose}
                variant="ghost"
                size="md"
              >
                Done
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};
