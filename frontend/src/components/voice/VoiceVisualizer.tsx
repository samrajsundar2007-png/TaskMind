import React from 'react';

interface VoiceVisualizerProps {
  isRecording?: boolean;
  isPlaying?: boolean;
  audioLevel?: number; // 0 - 100
}

export const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({
  isRecording = false,
  isPlaying = false,
  audioLevel = 0,
}) => {
  const bars = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  return (
    <div className="relative flex items-center justify-center py-6">
      {/* Dynamic Aura Ripples when active */}
      {(isRecording || isPlaying) && (
        <>
          <div
            className={`absolute rounded-full transition-all duration-300 pointer-events-none ${
              isRecording ? 'bg-red-500/15 animate-ping' : 'bg-indigo-500/15 animate-ping'
            }`}
            style={{
              width: `${90 + audioLevel * 1.2}px`,
              height: `${90 + audioLevel * 1.2}px`,
            }}
          />
          <div
            className={`absolute rounded-full transition-all duration-150 pointer-events-none ${
              isRecording ? 'bg-red-500/20' : 'bg-indigo-500/20'
            }`}
            style={{
              width: `${75 + audioLevel * 0.8}px`,
              height: `${75 + audioLevel * 0.8}px`,
            }}
          />
        </>
      )}

      {/* Center Waveform Bars */}
      <div className="flex items-center gap-1.5 h-16 z-10">
        {bars.map((bar, idx) => {
          // Calculate dynamic height based on audio level and index distance from center
          const distFromCenter = Math.abs(idx - 5.5);
          const factor = Math.max(0.2, 1 - distFromCenter * 0.15);
          const height = isRecording
            ? Math.max(12, Math.min(54, (audioLevel * factor * 1.5) + (Math.sin(idx + Date.now() * 0.01) * 6)))
            : isPlaying
            ? Math.max(10, Math.min(48, 20 + Math.sin(idx * 0.8 + Date.now() * 0.01) * 20))
            : 8;

          return (
            <div
              key={bar}
              className={`w-1.5 rounded-full transition-all duration-75 ${
                isRecording
                  ? 'bg-red-500 shadow-2xs shadow-red-200'
                  : isPlaying
                  ? 'bg-indigo-600 shadow-2xs shadow-indigo-200 animate-pulse'
                  : 'bg-gray-200'
              }`}
              style={{ height: `${height}px` }}
            />
          );
        })}
      </div>
    </div>
  );
};
