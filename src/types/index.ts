export type EndingType = 'bad' | 'hidden' | 'true';

export type InfluenceDimension = 'ghost' | 'trust' | 'escape' | 'custom';

export interface Influence {
  dimension: InfluenceDimension;
  label: string;
  content: string;
  level: 1 | 2 | 3 | 4 | 5;
}

export interface Inspiration {
  id: string;
  title: string;
  description: string;
  influences: Influence[];
  relatedEndingIds: string[];
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface CausalityQuestion {
  id: string;
  question: string;
  answered: boolean;
  answer?: string;
  category: 'timing' | 'knowledge' | 'mechanism' | 'consequence' | 'motivation';
}

export interface Ending {
  id: string;
  title: string;
  type: EndingType;
  description: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  conditions: string[];
  cost?: string;
  triggerHint: string;
  relatedInspirationIds: string[];
  similarityGroup?: string;
  costUnclear: boolean;
  unlocked: boolean;
}

export interface GameState {
  inspirations: Inspiration[];
  endings: Ending[];
  selectedEndingId: string | null;
  causalityQuestions: CausalityQuestion[];
}

export const INFLUENCE_LABELS: Record<InfluenceDimension, string> = {
  ghost: '鬼影频率',
  trust: '同伴信任',
  escape: '逃离方式',
  custom: '自定义'
};

export const ENDING_TYPE_LABELS: Record<EndingType, string> = {
  bad: '坏结局',
  hidden: '隐藏结局',
  true: '真结局'
};

export const QUESTION_CATEGORY_LABELS: Record<CausalityQuestion['category'], string> = {
  timing: '时间节点',
  knowledge: '信息获取',
  mechanism: '触发机制',
  consequence: '连锁后果',
  motivation: '角色动机'
};
