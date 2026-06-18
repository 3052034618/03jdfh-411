import { create } from 'zustand';
import Taro from '@tarojs/taro';
import type {
  GameState,
  Inspiration,
  Ending,
  CausalityQuestion,
  Influence,
  AnswerArchive,
  InspirationDraft
} from '../types';
import { mockInspirations, mockEndings, generateCausalityQuestions } from '../data/mockData';

const STORAGE_KEY = 'nightmare_sensei_state_v2';

interface PersistedSnapshot {
  inspirations: Inspiration[];
  drafts: InspirationDraft[];
  activeDraftId: string | null;
  endings: Ending[];
  selectedEndingId: string | null;
  answerArchive: AnswerArchive;
}

type ReviewSection = {
  category: CausalityQuestion['category'];
  label: string;
  icon: string;
  questions: { question: string; answer: string; questionId: string }[];
};

interface GameStore extends GameState {
  hydrate: () => void;
  persist: () => void;

  addInspiration: (data: Omit<Inspiration, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateInspiration: (id: string, data: Partial<Inspiration>) => void;
  deleteInspiration: (id: string) => void;

  // ========== 草稿箱 ==========
  getActiveDraft: () => InspirationDraft | null;
  newDraft: () => string;
  loadDraft: (draftId: string) => void;
  saveDraft: (data: Partial<InspirationDraft>) => void;
  deleteDraft: (draftId: string) => void;
  commitDraft: (draftId: string) => void;

  // ========== 结局（代价强制校验） ==========
  addEnding: (data: Omit<Ending, 'id'>) => { ok: boolean; reason?: string };
  updateEnding: (id: string, data: Partial<Ending>) => { ok: boolean; reason?: string };
  toggleEndingUnlocked: (id: string) => void;

  selectEnding: (id: string | null) => void;
  regenerateQuestions: (endingId: string) => void;
  answerQuestion: (endingId: string, questionId: string, answer: string) => void;

  // ========== 查询接口 ==========
  getSimilarEndings: (endingId: string) => Ending[];
  getCostUnclearEndings: () => Ending[];
  getEndingRelatedInspirations: (endingId: string) => Inspiration[];
  getCategoryProgress: (endingId: string) => Record<string, { total: number; answered: number }>;
  getEndingReview: (endingId: string) => { sections: ReviewSection[]; answeredCount: number; totalCount: number };
  getGraphData: () => {
    inspirations: (Inspiration & { endingEdges: { endingId: string; type: Ending['type'] }[] })[];
    endings: Ending[];
  };
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

function validateEndingPayload(
  data: Partial<Ending> | Omit<Ending, 'id'>
): { ok: boolean; reason?: string } {
  const costUnclear = data.costUnclear;
  const hasCost = typeof data.cost === 'string' && data.cost.trim().length > 0;
  if (!costUnclear && !hasCost && typeof data.costUnclear !== 'undefined') {
    return {
      ok: false,
      reason: '标记为"代价已明确"时，请填写具体的代价内容；或重新勾选"代价尚不明确"'
    };
  }
  return { ok: true };
}

function loadInitialState(): {
  inspirations: Inspiration[];
  drafts: InspirationDraft[];
  activeDraftId: string | null;
  endings: Ending[];
  selectedEndingId: string | null;
  answerArchive: AnswerArchive;
} {
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY);
    if (raw) {
      const parsed: PersistedSnapshot = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (parsed && Array.isArray(parsed.inspirations) && Array.isArray(parsed.endings)) {
        console.log('[Store] 从本地存储加载 v2', {
          inspirations: parsed.inspirations.length,
          drafts: parsed.drafts?.length ?? 0,
          endings: parsed.endings.length,
          hasArchive: !!parsed.answerArchive
        });
        return {
          inspirations: parsed.inspirations,
          drafts: parsed.drafts ?? [],
          activeDraftId: parsed.activeDraftId ?? null,
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
    drafts: [],
    activeDraftId: null,
    endings: mockEndings,
    selectedEndingId: mockEndings[0]?.id ?? null,
    answerArchive: {}
  };
}

const REVIEW_CATEGORIES: CausalityQuestion['category'][] = [
  'timing',
  'knowledge',
  'mechanism',
  'consequence',
  'motivation'
];

const REVIEW_LABELS: Record<CausalityQuestion['category'], string> = {
  timing: '时间节点',
  knowledge: '信息获取',
  mechanism: '触发机制',
  consequence: '连锁后果',
  motivation: '角色动机'
};

const REVIEW_ICONS: Record<CausalityQuestion['category'], string> = {
  timing: '⏰',
  knowledge: '💡',
  mechanism: '⚙️',
  consequence: '🔗',
  motivation: '🧠'
};

const loaded = loadInitialState();
const initialQuestions = mergeAnswersWithQuestions(
  generateCausalityQuestions(loaded.selectedEndingId, loaded.inspirations),
  loaded.answerArchive,
  loaded.selectedEndingId || ''
);

const initialState: GameState = {
  inspirations: loaded.inspirations,
  drafts: loaded.drafts,
  activeDraftId: loaded.activeDraftId,
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
      drafts: s.drafts,
      activeDraftId: s.activeDraftId,
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
        drafts: state.drafts,
        activeDraftId: state.activeDraftId,
        endings: state.endings,
        selectedEndingId: state.selectedEndingId,
        answerArchive: state.answerArchive
      };
      Taro.setStorageSync(STORAGE_KEY, JSON.stringify(snapshot));
      console.log('[Store] 持久化 v2', {
        inspirations: snapshot.inspirations.length,
        drafts: snapshot.drafts.length,
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

  // ========== 草稿箱 ==========
  getActiveDraft: () => {
    const { activeDraftId, drafts } = get();
    if (!activeDraftId) return null;
    return drafts.find((d) => d.id === activeDraftId) ?? null;
  },

  newDraft: () => {
    const now = Date.now();
    const draftId = `draft_${now}_${Math.random().toString(36).slice(2, 8)}`;
    const newDraft: InspirationDraft = {
      id: draftId,
      title: '',
      description: '',
      influences: [],
      relatedEndingIds: [],
      tags: [],
      updatedAt: now
    };
    set((state) => ({
      drafts: [newDraft, ...state.drafts],
      activeDraftId: draftId
    }));
    get().persist();
    console.log('[Store] newDraft', draftId);
    return draftId;
  },

  loadDraft: (draftId) => {
    set({ activeDraftId: draftId });
    console.log('[Store] loadDraft', draftId);
  },

  saveDraft: (data) => {
    const { activeDraftId } = get();
    if (!activeDraftId) {
      // 若没有 activeDraft，先创建一个
      const id = get().newDraft();
      set((state) => ({
        drafts: state.drafts.map((d) =>
          d.id === id ? { ...d, ...data, updatedAt: Date.now() } : d
        )
      }));
    } else {
      set((state) => ({
        drafts: state.drafts.map((d) =>
          d.id === activeDraftId ? { ...d, ...data, updatedAt: Date.now() } : d
        )
      }));
    }
    get().persist();
  },

  deleteDraft: (draftId) => {
    set((state) => ({
      drafts: state.drafts.filter((d) => d.id !== draftId),
      activeDraftId: state.activeDraftId === draftId ? null : state.activeDraftId
    }));
    get().persist();
    console.log('[Store] deleteDraft', draftId);
  },

  commitDraft: (draftId) => {
    const { drafts } = get();
    const draft = drafts.find((d) => d.id === draftId);
    if (!draft) return;
    const payload: Omit<Inspiration, 'id' | 'createdAt' | 'updatedAt'> = {
      title: draft.title.trim() || '未命名灵感',
      description: draft.description,
      influences: draft.influences,
      relatedEndingIds: draft.relatedEndingIds,
      tags: draft.tags
    };
    get().addInspiration(payload);
    set((state) => ({
      drafts: state.drafts.filter((d) => d.id !== draftId),
      activeDraftId: state.activeDraftId === draftId ? null : state.activeDraftId
    }));
    get().persist();
    console.log('[Store] commitDraft → addInspiration', draftId);
  },

  // ========== 结局（带代价强制校验） ==========
  addEnding: (data) => {
    const validation = validateEndingPayload(data);
    if (!validation.ok) return validation;
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
    return { ok: true };
  },

  updateEnding: (id, data) => {
    const validation = validateEndingPayload(data);
    if (!validation.ok) return validation;
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
    return { ok: true };
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
      const merged = mergeAnswersWithQuestions(fresh, state.answerArchive, endingId || '');
      return { causalityQuestions: merged };
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
  },

  getEndingReview: (endingId) => {
    const questions = generateCausalityQuestions(endingId, get().inspirations);
    const merged = mergeAnswersWithQuestions(questions, get().answerArchive, endingId);
    const answered = merged.filter((q) => q.answered);
    const sections: ReviewSection[] = REVIEW_CATEGORIES.map((category) => ({
      category,
      label: REVIEW_LABELS[category],
      icon: REVIEW_ICONS[category],
      questions: answered
        .filter((q) => q.category === category)
        .map((q) => ({
          question: q.question,
          answer: q.answer || '',
          questionId: q.id
        }))
    }));
    return {
      sections,
      answeredCount: answered.length,
      totalCount: merged.length
    };
  },

  getGraphData: () => {
    const { inspirations, endings } = get();
    const inspWithEdges = inspirations.map((ins) => ({
      ...ins,
      endingEdges: ins.relatedEndingIds
        .map((eid) => {
          const e = endings.find((x) => x.id === eid);
          return e ? { endingId: eid, type: e.type } : null;
        })
        .filter(Boolean) as { endingId: string; type: Ending['type'] }[]
    }));
    return { inspirations: inspWithEdges, endings };
  }
}));
