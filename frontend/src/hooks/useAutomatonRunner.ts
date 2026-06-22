import { useState, useCallback, useRef, useEffect } from 'react';
import axios from 'axios';
import { AutomatonSchema, SimulationStep } from '../types/schema';

export type PlayState = 'idle' | 'playing' | 'paused' | 'done';

export interface RunnerState {
  steps: SimulationStep[];
  currentStep: number;
  playState: PlayState;
  speed: number;          // ms per step
  activeNodeId: string | null;
  activeEdgeId: string | null;
  accepted: boolean | null;
  error: string | null;
  loadSimulation: (automaton: AutomatonSchema, inputString: string) => Promise<void>;
  play: ()         => void;
  pause: ()        => void;
  stepForward: ()  => void;
  stepBackward: () => void;
  reset: ()        => void;
  setSpeed: (ms: number) => void;
}

export function useAutomatonRunner(): RunnerState {
  const [steps,       setSteps]       = useState<SimulationStep[]>([]);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [playState,   setPlayState]   = useState<PlayState>('idle');
  const [speed,       setSpeedState]  = useState<number>(800);
  const [accepted,    setAccepted]    = useState<boolean | null>(null);
  const [error,       setError]       = useState<string | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepsRef    = useRef<SimulationStep[]>([]);
  const stepRef     = useRef(0);
  const speedRef    = useRef(800);

  stepsRef.current = steps;
  stepRef.current  = currentStep;
  speedRef.current = speed;

  const clearTimer = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  };

  // Auto-advance on play
  useEffect(() => {
    if (playState !== 'playing') { clearTimer(); return; }

    intervalRef.current = setInterval(() => {
      const next = stepRef.current + 1;
      if (next >= stepsRef.current.length) {
        clearTimer();
        setPlayState('done');
        return;
      }
      setCurrentStep(next);
    }, speedRef.current);

    return clearTimer;
  }, [playState, speed]);

  const loadSimulation = useCallback(async (automaton: AutomatonSchema, inputString: string) => {
    clearTimer();
    setPlayState('idle');
    setSteps([]);
    setCurrentStep(0);
    setAccepted(null);
    setError(null);

    try {
      const { data } = await axios.post('/api/simulate', { automaton, inputString });
      setSteps(data.steps);
      setAccepted(data.accepted);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    }
  }, []);

  const play = useCallback(() => {
    if (steps.length === 0) return;
    if (currentStep >= steps.length - 1) setCurrentStep(0);
    setPlayState('playing');
  }, [steps.length, currentStep]);

  const pause = useCallback(() => {
    clearTimer();
    setPlayState('paused');
  }, []);

  const stepForward = useCallback(() => {
    clearTimer();
    setPlayState('paused');
    setCurrentStep(prev => Math.min(prev + 1, stepsRef.current.length - 1));
  }, []);

  const stepBackward = useCallback(() => {
    clearTimer();
    setPlayState('paused');
    setCurrentStep(prev => Math.max(prev - 1, 0));
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    setCurrentStep(0);
    setPlayState('idle');
  }, []);

  const setSpeed = useCallback((ms: number) => setSpeedState(ms), []);

  const current = steps[currentStep];

  return {
    steps, currentStep, playState, speed, accepted, error,
    activeNodeId: current?.state      ?? null,
    activeEdgeId: current?.edgeId     ?? null,
    loadSimulation, play, pause, stepForward, stepBackward, reset, setSpeed,
  };
}
