import { useState, useRef, useCallback, useEffect } from 'react';

export interface UseVoiceRecorderReturn {
  isRecording: boolean;
  isPlaying: boolean;
  audioLevel: number;
  duration: number;
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<Blob | null>;
  cancelRecording: () => void;
  playAudioBase64: (base64Data: string, onEnd?: () => void) => void;
  playAudioBlob: (blob: Blob, onEnd?: () => void) => void;
  stopAudio: () => void;
  error: string | null;
}

export const useVoiceRecorder = (): UseVoiceRecorderReturn => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const currentAudioElementRef = useRef<HTMLAudioElement | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      if (currentAudioElementRef.current) {
        currentAudioElementRef.current.pause();
      }
    };
  }, []);

  const updateAudioLevel = useCallback(() => {
    if (!analyserRef.current || !isRecording) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const average = sum / dataArray.length;
    // Normalize to 0 - 100
    const level = Math.min(100, Math.round((average / 128) * 100));
    setAudioLevel(level);

    animFrameRef.current = requestAnimationFrame(updateAudioLevel);
  }, [isRecording]);

  const startRecording = async (): Promise<boolean> => {
    setError(null);
    audioChunksRef.current = [];

    // Stop any ongoing playback on user speech (barge-in support)
    stopAudio();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone access is not supported in this browser.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Initialize Web Audio API for visualizer
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Initialize MediaRecorder
      const mimeTypes = ['audio/webm', 'audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'];
      let selectedMime = '';
      for (const m of mimeTypes) {
        if (MediaRecorder.isTypeSupported(m)) {
          selectedMime = m;
          break;
        }
      }

      const options = selectedMime ? { mimeType: selectedMime } : undefined;
      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.start(100); // 100ms time slice
      setIsRecording(true);
      setDuration(0);

      // Duration counter
      timerRef.current = window.setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);

      // Start visualizer animation loop
      animFrameRef.current = requestAnimationFrame(updateAudioLevel);

      return true;
    } catch (err: any) {
      console.error('Error starting audio recording:', err);
      setError(err.message || 'Could not access microphone.');
      return false;
    }
  };

  const stopRecording = (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
        setIsRecording(false);
        resolve(null);
        return;
      }

      const recorder = mediaRecorderRef.current;

      recorder.onstop = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        setAudioLevel(0);
        setIsRecording(false);

        // Stop all audio tracks to release microphone hardware indicator
        recorder.stream.getTracks().forEach((track) => track.stop());

        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close();
        }

        const mimeType = recorder.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        resolve(audioBlob);
      };

      recorder.stop();
    });
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    audioChunksRef.current = [];
    setIsRecording(false);
    setAudioLevel(0);
    setDuration(0);
  };

  const playAudioBlob = (blob: Blob, onEnd?: () => void) => {
    stopAudio();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    currentAudioElementRef.current = audio;
    setIsPlaying(true);

    audio.onended = () => {
      setIsPlaying(false);
      URL.revokeObjectURL(url);
      currentAudioElementRef.current = null;
      if (onEnd) onEnd();
    };

    audio.onerror = () => {
      setIsPlaying(false);
      URL.revokeObjectURL(url);
      currentAudioElementRef.current = null;
    };

    audio.play().catch((err) => {
      console.warn('Audio autoplay blocked or failed:', err);
      setIsPlaying(false);
    });
  };

  const playAudioBase64 = (base64Data: string, onEnd?: () => void) => {
    if (!base64Data) return;
    try {
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'audio/mpeg' });
      playAudioBlob(blob, onEnd);
    } catch (err) {
      console.error('Failed to decode base64 audio:', err);
    }
  };

  const stopAudio = () => {
    if (currentAudioElementRef.current) {
      currentAudioElementRef.current.pause();
      currentAudioElementRef.current.currentTime = 0;
      currentAudioElementRef.current = null;
    }
    setIsPlaying(false);
  };

  return {
    isRecording,
    isPlaying,
    audioLevel,
    duration,
    startRecording,
    stopRecording,
    cancelRecording,
    playAudioBase64,
    playAudioBlob,
    stopAudio,
    error,
  };
};
