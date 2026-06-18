import { create } from 'zustand';
import type { GameState, Inspiration, Ending, CausalityQuestion, Influence } from '../types';
import { mockInspirations, mockEndings, generateCausalityQuestions } from '../data/mockData';

interface GameStore extends GameState {
  addInspiration: (data: Omit<Inspiration, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateInspiration: (id: string, data: Partial<Inspiration>) => void;
  deleteInspiration: (id: string) => void;
  
  addEnding: (data: Omit<Ending, 'id'>) => void;
  updateEnding: (id: string, data: Partial<Ending>) => void;
  toggleEndingUnlocked: (id: string) => void;
  
  selectEnding: (id: string | null) => void;
  regenerateQuestions: (endingId: string) => void;
  answerQuestion: (questionId: string, answer: string) => void;
  
  getSimilarEndings: (endingId: string) => Ending[];
  getCostUnclearEndings: () => Ending[];
  getEndingRelatedInspirations: (endingId: string) => Inspiration[];
}

const initialState: GameState = {
  inspirations: mockInspirations,
  endings: mockEndings,
  selectedEndingId: mockEndings[0]?.id ?? null,
  causalityQuestions: generateCausalityQuestions(mockEndings[0]?.id ?? null, mockInspirations)
};

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,

  addInspiration: (data) => {
    const now = Date.now();
    const newItem: Inspiration = {
      ...data,
      id: `ins_${now}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: now,
      updatedAt: now
    };
    set((state) => ({ inspirations: [newItem, ...state.inspirations] }));
    console.log('[Store] addInspiration', newItem.id);
  },

  updateInspiration: (id, data) => {
    set((state) => ({
      inspirations: state.inspirations.map((item) =>
        item.id === id ? { ...item, ...data, updatedAt: Date.now() } : item
      )
    }));
    console.log('[Store] updateInspiration', id);
  },

  deleteInspiration: (id) => {
    set((state) => ({ inspirations: state.inspirations.filter((i) => i.id !== id) }));
    console.log('[Store] deleteInspiration', id);
  },

  addEnding: (data) => {
    const newItem: Ending = {
      ...data,
      id: `end_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    };
    set((state) => ({ endings: [...state.endings, newItem] }));
  },

  updateEnding: (id, data) => {
    set((state) => ({
      endings: state.endings.map((e) => (e.id === id ? { ...e, ...data } : e))
    }));
  },

  toggleEndingUnlocked: (id) => {
    set((state) => ({
      endings: state.endings.map((e) =>
        e.id === id ? { ...e, unlocked: !e.unlocked } : e
      )
    }));
  },

  selectEnding: (id) => {
    const questions = generateCausalityQuestions(id, get().inspirations);
    set({ selectedEndingId: id, causalityQuestions: questions });
    console.log('[Store] selectEnding', id, 'questions:', questions.length);
  },

  regenerateQuestions: (endingId) => {
    const questions = generateCausalityQuestions(endingId, get().inspirations);
    set({ causalityQuestions: questions });
  },

  answerQuestion: (questionId, answer) => {
    set((state) => ({
      causalityQuestions: state.causalityQuestions.map((q) =>
        q.id === questionId ? { ...q, answered: true, answer } : q
      )
    }));
  },

  getSimilarEndings: (endingId) => {
    const target = get().endings.find((e) => e.id === endingId);
    if (!target?.similarityGroup) return [];
    return get().endings.filter(
      (e) => e.similarityGroup === target.similarityGroup && e.id !== endingId
    );
  },

  getCostUnclearEndings: () => {
    return get().endings.filter((e) => e.costUnclear);
  },

  getEndingRelatedInspirations: (endingId) => {
    const ending = get().endings.find((e) => e.id === endingId);
    if (!ending) return [];
    return get().inspirations.filter((i) => ending.relatedInspirationIds.includes(i.id));
  }
}));
