import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Mic,
  CheckCircle2,
  Sun,
  Calendar,
  BarChart3,
  Send,
  ArrowRight,
  ArrowLeft,
  X,
  Sparkles,
  Check,
} from 'lucide-react';
import { Button } from '../ui/Button';
import * as authService from '../../services/auth';

interface TourStep {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  description: string;
  keyFeatures: string[];
  sampleAction: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Natural AI Chat Assistant',
    subtitle: 'Conversational Task Creation & Management',
    icon: <MessageSquare size={24} />,
    iconBg: 'bg-indigo-50 border-indigo-100',
    iconColor: 'text-indigo-600',
    description:
      'Manage tasks naturally just by chatting. TaskMind understands complex dates, deadlines, priorities, and recurring patterns.',
    keyFeatures: [
      'Natural date parsing: "tomorrow at 5pm", "in 45 minutes", "every Monday 10am"',
      'Intelligent ambiguity detection: asks clarifying questions when dates are vague',
      'ChatGPT-style formatting with structured tables and checklists',
    ],
    sampleAction: 'Try typing: "Add task review quarterly roadmap tomorrow at 4pm urgent"',
  },
  {
    title: 'Neural Voice AI Assistant',
    subtitle: 'Hands-Free Speech Interaction',
    icon: <Mic size={24} />,
    iconBg: 'bg-purple-50 border-purple-100',
    iconColor: 'text-purple-600',
    description:
      'Talk directly to TaskMind using high-accuracy speech recognition (Whisper) and listen to lifelike neural voice responses (Edge TTS).',
    keyFeatures: [
      'One-click microphone activation or voice recording',
      'Realistic natural neural voices customizable in Settings',
      'Audio playback on chat bubbles and briefings',
    ],
    sampleAction: 'Click the microphone icon in the chat header or press the Voice button.',
  },
  {
    title: 'Smart Task Management',
    subtitle: 'Instant Filtering, Search & Priority',
    icon: <CheckCircle2 size={24} />,
    iconBg: 'bg-emerald-50 border-emerald-100',
    iconColor: 'text-emerald-600',
    description:
      'Stay in total control with clean list views, quick status toggles, estimated durations, and category tags.',
    keyFeatures: [
      'One-click status changes: Pending, Done, Snoozed',
      'Recurring tasks automatically reschedule the next occurrence upon completion',
      'Full-text instant search and priority filters (High, Medium, Low)',
    ],
    sampleAction: 'Press "N" on your keyboard anytime to quickly add a new task.',
  },
  {
    title: 'Daily Intelligence Briefing',
    subtitle: 'AI Workload & Burnout Guard',
    icon: <Sun size={24} />,
    iconBg: 'bg-amber-50 border-amber-100',
    iconColor: 'text-amber-600',
    description:
      'Start each morning with a concise summary of tasks due today, overdue alerts, and workload overload warnings.',
    keyFeatures: [
      'Calculates total estimated workload hours per day',
      'Proactive warnings if your schedule exceeds healthy daily capacity',
      'Actionable recommendations to reschedule or delegate',
    ],
    sampleAction: 'Listen to your morning briefing with the Audio button on the Dashboard.',
  },
  {
    title: '7-Day Calendar Matrix',
    subtitle: 'Visual Schedule Breakdown',
    icon: <Calendar size={24} />,
    iconBg: 'bg-blue-50 border-blue-100',
    iconColor: 'text-blue-600',
    description:
      'Plan your week visually with the interactive 7-day schedule matrix organizing tasks across days and hours.',
    keyFeatures: [
      'Organized day cards with overdue badges and time slots',
      'Quick task actions directly from the calendar cards',
      'Interactive navigation across upcoming weeks',
    ],
    sampleAction: 'Switch to the "Calendar" tab in the navigation bar to view your week.',
  },
  {
    title: 'Productivity Analytics & Review',
    subtitle: 'Weekly Performance Insights',
    icon: <BarChart3 size={24} />,
    iconBg: 'bg-rose-50 border-rose-100',
    iconColor: 'text-rose-600',
    description:
      'Track your productivity momentum, on-time completion rates, snooze frequencies, and category distribution.',
    keyFeatures: [
      'On-time completion percentage metrics',
      'Task category workload distribution charts',
      'Weekly AI review summaries celebrating completed milestones',
    ],
    sampleAction: 'Open the "Stats" tab in the sidebar to review your productivity score.',
  },
  {
    title: 'Telegram Bot & Shortcuts',
    subtitle: 'Mobile Alerts & Fast Navigation',
    icon: <Send size={24} />,
    iconBg: 'bg-sky-50 border-sky-100',
    iconColor: 'text-sky-600',
    description:
      'Never miss a deadline. Receive interactive Telegram notifications on your phone with action buttons.',
    keyFeatures: [
      'Interactive Telegram buttons: [Done], [Snooze 1h], [Tomorrow]',
      'Escalating reminders for urgent high-priority tasks',
      'Keyboard shortcuts: press "/" to focus chat, "N" for new task',
    ],
    sampleAction: 'Go to Settings to link your Telegram account with the /start command.',
  },
];

interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: number;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
  isOpen,
  onClose,
  userId,
}) => {
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const step = TOUR_STEPS[currentStep];
  const isLastStep = currentStep === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(0, prev - 1));
  };

  const handleComplete = async () => {
    localStorage.setItem('taskmind_tour_completed', 'true');
    if (userId) {
      try {
        await authService.completeOnboarding(userId);
      } catch (err) {
        console.warn('Could not update onboarding status:', err);
      }
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl border border-gray-200 shadow-2xl max-w-xl w-full overflow-hidden animate-in zoom-in-95">
        {/* Top Progress Bar */}
        <div className="w-full bg-gray-100 h-1.5 flex">
          {TOUR_STEPS.map((_, idx) => (
            <div
              key={idx}
              className={`h-full flex-1 transition-all duration-300 ${
                idx <= currentStep ? 'bg-indigo-600' : 'bg-transparent'
              }`}
            />
          ))}
        </div>

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-2xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
              <Sparkles size={12} />
              <span>Feature Tour</span>
            </span>
            <span className="text-2xs font-bold text-gray-400">
              Step {currentStep + 1} of {TOUR_STEPS.length}
            </span>
          </div>

          <button
            onClick={handleComplete}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer text-xs font-medium flex items-center gap-1"
          >
            <span>Skip Tour</span>
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Step Icon & Titles */}
          <div className="flex items-start gap-4">
            <div
              className={`w-14 h-14 rounded-2xl ${step.iconBg} border flex items-center justify-center ${step.iconColor} shrink-0 shadow-2xs`}
            >
              {step.icon}
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 leading-snug">
                {step.title}
              </h2>
              <p className="text-xs sm:text-sm font-semibold text-indigo-600 mt-0.5">
                {step.subtitle}
              </p>
            </div>
          </div>

          {/* Description */}
          <p className="text-xs sm:text-sm text-gray-600 leading-relaxed">
            {step.description}
          </p>

          {/* Bullet Highlights */}
          <div className="bg-gray-50/80 border border-gray-200/80 rounded-2xl p-4 space-y-2.5">
            <div className="text-2xs font-bold text-gray-400 uppercase tracking-wider">
              What it does:
            </div>
            <ul className="space-y-2">
              {step.keyFeatures.map((feat, idx) => (
                <li key={idx} className="flex items-start gap-2.5 text-xs text-gray-700">
                  <div className="w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Check size={10} className="stroke-[3]" />
                  </div>
                  <span>{feat}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Sample Pro Tip / Action */}
          <div className="p-3.5 rounded-xl bg-indigo-50/60 border border-indigo-100 text-xs text-indigo-900 flex items-start gap-2.5">
            <Sparkles size={16} className="text-indigo-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Pro Tip: </span>
              <span>{step.sampleAction}</span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleBack}
            disabled={currentStep === 0}
            icon={<ArrowLeft size={14} />}
          >
            Back
          </Button>

          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                  idx === currentStep
                    ? 'w-6 bg-indigo-600'
                    : 'bg-gray-300 hover:bg-gray-400'
                }`}
                aria-label={`Go to step ${idx + 1}`}
              />
            ))}
          </div>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleNext}
            className="shadow-2xs"
            icon={isLastStep ? <Check size={14} /> : <ArrowRight size={14} />}
          >
            {isLastStep ? 'Get Started' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  );
};
