import { create } from 'zustand';
import Taro from '@tarojs/taro';
import type { GameState, Inspiration, Ending, CausalityQuestion, Influence, AnswerArchive } from '../types';
import { mockInspirations, mockEndings, generateCausalityQuestions } from '../data/mockData';

const STORAGE_KEY = 'nightmare_sensei_state_v1';

interface PersistedSnapshot {
  inspirations: Inspiration[];
  endings: Ending[];
  selectedEndingId: string | null;
  answerArchive: AnswerArchive;
}

interface GameStore extends GameState {
  hydrate: () => void;
  persist: () => void;

  addInspiration: (data: Omit<Inspiration, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateInspiration: (id: string, data: Partial<Inspiration>) => void;
  deleteInspiration: (id: string) => void;

  addEnding: (data: Omit<Ending, 'id'>) => void;
  updateEnding: (id: string, data: Partial<Ending>) => void;
  toggleEndingUnlocked: (id: string) => void;

  selectEnding: (id: string | null) => void;
  regenerateQuestions: (endingId: string) => void;
  answerQuestion: (endingId: string, questionId: string, answer: string) => void;

  getSimilarEndings: (endingId: string) => Ending[];
  getCostUnclearEndings: () => Ending[];
  getEndingRelatedInspirations: (endingId: string) => Inspiration[];
  getCategoryProgress: (endingId: string) => Record<string, { total: number; answered: number }>;
}

function mergeAnswersWithQuestions(
  questions: CausalityQuestion[],
  archive: AnswerArchive,
  endingId: string
): CausalityQuestion[] {
  const endingAnswers = archive[endingId] || {};
  return questions.map((q) => {
    const saved = endingAnswers[q.id];
    if (saved) {
      return { ...q, answered: saved.answered, answer: saved.answer };
    }
    return q;
  });
}

function loadInitialState(): {
  inspirations: Inspiration[];
  endings: Ending[];
  selectedEndingId: string | null;
  answerArchive: AnswerArchive;
} {
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY);
    if (raw) {
      const parsed: PersistedSnapshot = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (parsed && Array.isArray(parsed.inspirations) && Array.isArray(parsed.endings)) {
        console.log('[Store] 从本地存储加载数据', {
          inspirations: parsed.inspirations.length,
          endings: parsed.endings.length,
          hasArchive: !!parsed.answerArchive
        });
        return {
          inspirations: parsed.inspirations,
          endings: parsed.endings,
          selectedEndingId: parsed.selectedEndingId || null,
          answerArchive: parsed.answerArchive || {}
        };
      }
    }
  } catch (err) {
    console.error('[Store] 加载本地存储失败，使用默认数据', err);
  }
  return {
    inspirations: mockInspirations,
    endings: mockEndings,
    selectedEndingId: mockEndings[0]?.id ?? null,
    answerArchive: {}
  };
}

const loaded = loadInitialState();
const initialQuestions = mergeAnswersWithQuestions(
  generateCausalityQuestions(loaded.selectedEndingId, loaded.inspirations),
  loaded.answerArchive,
  loaded.selectedEndingId || ''
);

const initialState: GameState = {
  inspirations: loaded.inspirations,
  endings: loaded.endings,
  selectedEndingId: loaded.selectedEndingId,
  causalityQuestions: initialQuestions,
  answerArchive: loaded.answerArchive
};

export const useGameStore = create<GameStore>((set, get) => ({
  ...initialState,

  hydrate: () => {
    const s = loadInitialState();
    const questions = mergeAnswersWithQuestions(
      generateCausalityQuestions(s.selectedEndingId, s.inspirations),
      s.answerArchive,
      s.selectedEndingId || ''
    );
    set({
      inspirations: s.inspirations,
      endings: s.endings,
      selectedEndingId: s.selectedEndingId,
      answerArchive: s.answerArchive,
      causalityQuestions: questions
    });
  },

  persist: () => {
    try {
      const state = get();
      const snapshot: PersistedSnapshot = {
        inspirations: state.inspirations,
        endings: state.endings,
        selectedEndingId: state.selectedEndingId,
        answerArchive: state.answerArchive
      };
      Taro.setStorageSync(STORAGE_KEY, JSON.stringify(snapshot));
      console.log('[Store] 持久化成功', {
        inspirations: snapshot.inspirations.length,
        endings: snapshot.endings.length,
        answerKeys: Object.keys(snapshot.answerArchive).length
      });
    } catch (err) {
      console.error('[Store] 持久化失败', err);
    }
  },

  addInspiration: (data) => {
    const now = Date.now();
    const newItem: Inspiration = {
      ...data,
      id: `ins_${now}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: now,
      updatedAt: now
    };
    set((state) => {
      const nextInspirations = [newItem, ...state.inspirations];
      const updatedEndings = state.endings.map((e) => {
        if (newItem.relatedEndingIds.includes(e.id) && !e.relatedInspirationIds.includes(newItem.id)) {
          return { ...e, relatedInspirationIds: [...e.relatedInspirationIds, newItem.id] };
        }
        return e;
      });
      const nextQuestions = mergeAnswersWithQuestions(
        state.causalityQuestions.length > 0
          ? generateCausalityQuestions(state.selectedEndingId, nextInspirations)
          : [],
        state.answerArchive,
        state.selectedEndingId || ''
      );
      return { inspirations: nextInspirations, endings: updatedEndings, causalityQuestions: nextQuestions };
    });
    get().persist();
    console.log('[Store] addInspiration', newItem.id, '关联结局:', newItem.relatedEndingIds);
  },

  updateInspiration: (id, data) => {
    set((state) => {
      const prev = state.inspirations.find((i) => i.id === id);
      const nextInspirations = state.inspirations.map((item) =>
        item.id === id ? { ...item, ...data, updatedAt: Date.now() } : item
      );
      let updatedEndings = state.endings;
      if (data.relatedEndingIds !== undefined && prev) {
        const prevSet = new Set(prev.relatedEndingIds);
        const nextSet = new Set(data.relatedEndingIds);
        const added = data.relatedEndingIds.filter((eid) => !prevSet.has(eid));
        const removed = prev.relatedEndingIds.filter((eid) => !nextSet.has(eid));
        updatedEndings = state.endings.map((e) => {
          if (added.includes(e.id) && !e.relatedInspirationIds.includes(id)) {
            return { ...e, relatedInspirationIds: [...e.relatedInspirationIds, id] };
          }
          if (removed.includes(e.id)) {
            return { ...e, relatedInspirationIds: e.relatedInspirationIds.filter((iid) => iid !== id) };
          }
          return e;
        });
      }
      const nextQuestions = mergeAnswersWithQuestions(
        state.causalityQuestions.length > 0
          ? generateCausalityQuestions(state.selectedEndingId, nextInspirations)
          : [],
        state.answerArchive,
        state.selectedEndingId || ''
      );
      return { inspirations: nextInspirations, endings: updatedEndings, causalityQuestions: nextQuestions };
    });
    get().persist();
    console.log('[Store] updateInspiration', id);
  },

  deleteInspiration: (id) => {
    set((state) => {
      const nextInspirations = state.inspirations.filter((i) => i.id !== id);
      const updatedEndings = state.endings.map((e) => ({
        ...e,
        relatedInspirationIds: e.relatedInspirationIds.filter((iid) => iid !== id)
      }));
      const nextQuestions = mergeAnswersWithQuestions(
        generateCausalityQuestions(state.selectedEndingId, nextInspirations),
        state.answerArchive,
        state.selectedEndingId || ''
      );
      return { inspirations: nextInspirations, endings: updatedEndings, causalityQuestions: nextQuestions };
    });
    get().persist();
    console.log('[Store] deleteInspiration', id);
  },

  addEnding: (data) => {
    const newItem: Ending = {
      ...data,
      id: `end_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    };
    set((state) => {
      const nextEndings = [...state.endings, newItem];
      const nextInspirations = state.inspirations.map((ins) => {
        if (newItem.relatedInspirationIds.includes(ins.id) && !ins.relatedEndingIds.includes(newItem.id)) {
          return { ...ins, relatedEndingIds: [...ins.relatedEndingIds, newItem.id] };
        }
        return ins;
      });
      return { endings: nextEndings, inspirations: nextInspirations };
    });
    get().persist();
    console.log('[Store] addEnding', newItem.title);
  },

  updateEnding: (id, data) => {
    set((state) => {
      const prev = state.endings.find((e) => e.id === id);
      const nextEndings = state.endings.map((e) => (e.id === id ? { ...e, ...data } : e));
      let nextInspirations = state.inspirations;
      if (data.relatedInspirationIds !== undefined && prev) {
        const prevSet = new Set(prev.relatedInspirationIds);
        const nextSet = new Set(data.relatedInspirationIds);
        const added = data.relatedInspirationIds.filter((iid) => !prevSet.has(iid));
        const removed = prev.relatedInspirationIds.filter((iid) => !nextSet.has(iid));
        nextInspirations = state.inspirations.map((ins) => {
          if (added.includes(ins.id) && !ins.relatedEndingIds.includes(id)) {
            return { ...ins, relatedEndingIds: [...ins.relatedEndingIds, id] };
          }
          if (removed.includes(ins.id)) {
            return { ...ins, relatedEndingIds: ins.relatedEndingIds.filter((eid) => eid !== id) };
          }
          return ins;
        });
      }
      return { endings: nextEndings, inspirations: nextInspirations };
    });
    get().persist();
  },

  toggleEndingUnlocked: (id) => {
    set((state) => ({
      endings: state.endings.map((e) =>
        e.id === id ? { ...e, unlocked: !e.unlocked } : e
      )
    }));
    get().persist();
  },

  selectEnding: (id) => {
    set((state) => {
      const questions = generateCausalityQuestions(id, state.inspirations);
      const merged = mergeAnswersWithQuestions(questions, state.answerArchive, id || '');
      return { selectedEndingId: id, causalityQuestions: merged };
    });
    get().persist();
    console.log('[Store] selectEnding', id);
  },

  regenerateQuestions: (endingId) => {
    set((state) => {
      const fresh = generateCausalityQuestions(endingId, state.inspirations);
      return { causalityQuestions: fresh };
    });
  },

  answerQuestion: (endingId, questionId, answer) => {
    set((state) => {
      const endingAnswers = state.answerArchive[endingId] || {};
      const nextArchive = {
        ...state.answerArchive,
        [endingId]: {
          ...endingAnswers,
          [questionId]: { answered: true, answer }
        }
      };
      const nextQuestions = state.causalityQuestions.map((q) =>
        q.id === questionId ? { ...q, answered: true, answer } : q
      );
      return { answerArchive: nextArchive, causalityQuestions: nextQuestions };
    });
    get().persist();
    console.log('[Store] answerQuestion', endingId, questionId);
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
  },

  getCategoryProgress: (endingId) => {
    const questions = generateCausalityQuestions(endingId, get().inspirations);
    const merged = mergeAnswersWithQuestions(questions, get().answerArchive, endingId);
    const result: Record<string, { total: number; answered: number }> = {};
    merged.forEach((q) => {
      if (!result[q.category]) result[q.category] = { total: 0, answered: 0 };
      result[q.category].total++;
      if (q.answered) result[q.category].answered++;
    });
    return result;
  }
}));
