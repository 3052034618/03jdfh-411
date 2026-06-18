import type { Inspiration, Ending, CausalityQuestion, InfluenceDimension } from '../types';

const now = Date.now();

export const mockInspirations: Inspiration[] = [
  {
    id: 'ins_001',
    title: '把镜子蒙上红布',
    description: '玩家在走廊尽头的梳妆台前，发现一块叠好的红布，选择用它盖住那面似乎映出多余人影的古镜。',
    influences: [
      { dimension: 'ghost', label: '鬼影频率', content: '镜中女鬼出现频率-60%，但走廊鬼影+30%', level: 4 },
      { dimension: 'trust', label: '同伴信任', content: '迷信的同伴认为这是"自欺欺人"，信任度-15', level: 2 },
      { dimension: 'escape', label: '逃离方式', content: '解锁"红布包裹钥匙"逃离法，但红布会消耗', level: 3 }
    ],
    relatedEndingIds: ['end_001', 'end_003'],
    tags: ['道具', '镜', '压制'],
    createdAt: now - 3600000,
    updatedAt: now - 3600000
  },
  {
    id: 'ins_002',
    title: '深夜独自去地下室',
    description: '凌晨两点电闸跳闸，玩家选择独自一人去地下室恢复供电，没有叫醒沉睡的同伴。',
    influences: [
      { dimension: 'ghost', label: '鬼影频率', content: '地下室专属"扶梯怪"100%触发，若3分钟内返回则无伤', level: 5 },
      { dimension: 'trust', label: '同伴信任', content: '被发现后+25信任（勇敢），若受伤则+40（牺牲）', level: 4 },
      { dimension: 'escape', label: '逃离方式', content: '可能获得"地下室备用钥匙"，开侧门逃离', level: 2 }
    ],
    relatedEndingIds: ['end_002', 'end_004'],
    tags: ['单人行动', '时间限制', '探索'],
    createdAt: now - 7200000,
    updatedAt: now - 7200000
  },
  {
    id: 'ins_003',
    title: '接听神秘来电',
    description: '大厅座机突然响起，来电显示是十年前就已去世的宅邸主人。是否拿起听筒？',
    influences: [
      { dimension: 'ghost', label: '鬼影频率', content: '接听后，宅邸内所有电话会持续响铃，吸引灵体聚集', level: 3 },
      { dimension: 'trust', label: '同伴信任', content: '若分享通话内容，理性派同伴信任-20，感性派+30', level: 3 },
      { dimension: 'escape', label: '逃离方式', content: '通话中透露的"午夜十二点北门开"信息', level: 4 },
      { dimension: 'custom', label: '关键线索', content: '得知"第三幅画后藏着保险箱密码"', level: 5 }
    ],
    relatedEndingIds: ['end_003', 'end_005'],
    tags: ['电话', '线索', '信息差'],
    createdAt: now - 86400000,
    updatedAt: now - 86400000
  },
  {
    id: 'ins_004',
    title: '把日记本还给女孩幽灵',
    description: '在儿童房捡到一本带血的日记本，封面写着小女孩的名字。是否归还给楼梯间遇到的女孩幽灵？',
    influences: [
      { dimension: 'ghost', label: '鬼影频率', content: '归还后女孩不再攻击，且会警告其他灵体的位置', level: 2 },
      { dimension: 'trust', label: '同伴信任', content: '同伴看到你与幽灵交谈，产生分歧', level: 3 },
      { dimension: 'escape', label: '逃离方式', content: '女孩给出"母亲的首饰盒"作为钥匙道具', level: 4 }
    ],
    relatedEndingIds: ['end_003', 'end_005', 'end_006'],
    tags: ['善意', '契约', 'NPC'],
    createdAt: now - 172800000,
    updatedAt: now - 172800000
  },
  {
    id: 'ins_005',
    title: '喝下厨房的安神茶',
    description: '同伴在厨房泡了安神茶说要"让大家睡个好觉"，茶的颜色不太对。要不要喝？',
    influences: [
      { dimension: 'ghost', label: '鬼影频率', content: '茶里的草药配方，会使某些灵体更容易附身', level: 4 },
      { dimension: 'trust', label: '同伴信任', content: '拒绝喝茶 = 不信任同伴，信任-30', level: 4 },
      { dimension: 'escape', label: '逃离方式', content: '若不喝，会在半夜发现同伴异样，触发"反叛路线"', level: 5 }
    ],
    relatedEndingIds: ['end_001', 'end_002', 'end_004'],
    tags: ['背叛', '信任考验', '伏笔'],
    createdAt: now - 259200000,
    updatedAt: now - 259200000
  }
];

export const mockEndings: Ending[] = [
  {
    id: 'end_001',
    title: '蒙在布中的眼',
    type: 'bad',
    description: '红布确实遮住了镜中人，但镜中人从其他镜面爬出时，你已经无处可逃。最后你被发现时，头上蒙着那块红布，眼睛被缝合。',
    difficulty: 2,
    conditions: [
      '选择了"把镜子蒙上红布"',
      '未发现其他镜子也需要覆盖',
      '同伴信任低于40'
    ],
    cost: '玩家一人死亡，其余同伴幸存但永远失去对红色物品的判断力',
    triggerHint: '单独行动+忽视"红布只能遮一面"的提示',
    relatedInspirationIds: ['ins_001', 'ins_005'],
    similarityGroup: 'mirror_death',
    costUnclear: false,
    unlocked: true
  },
  {
    id: 'end_002',
    title: '扶梯上的最后一阶',
    type: 'bad',
    description: '电闸在最后一秒被推上，但你在扶梯最后一阶被什么东西拉住脚踝。楼上的同伴只听到一声闷响和拖行的声音。',
    difficulty: 3,
    conditions: [
      '独自去地下室',
      '未携带打火机或照明工具',
      '超过3分钟未返回'
    ],
    cost: '玩家永久失踪，地下室永远锁闭',
    triggerHint: '无光源+超时',
    relatedInspirationIds: ['ins_002', 'ins_005'],
    similarityGroup: 'basement_fate',
    costUnclear: false,
    unlocked: true
  },
  {
    id: 'end_003',
    title: '画中人的邀请',
    type: 'hidden',
    description: '你按照通话提示，在第三幅画后找到了密码。保险箱里是另一块红布和一封信。信上写着："把画挂上，欢迎加入我们。"你成了宅邸新的画像。',
    difficulty: 4,
    conditions: [
      '接听神秘来电',
      '归还日记（女孩透露画作线索）',
      '在午夜十二点前打开保险箱',
      '选择"把自己的画像挂上"'
    ],
    triggerHint: '关键线索全部收集+正确时间点',
    relatedInspirationIds: ['ins_001', 'ins_003', 'ins_004'],
    similarityGroup: 'transformation',
    costUnclear: true,
    unlocked: false
  },
  {
    id: 'end_004',
    title: '侧门的光',
    type: 'hidden',
    description: '地下室备用钥匙打开了那扇从不上锁的侧门。门外是停车场，车还在。你发动引擎，后视镜里坐着一个女孩微笑着挥手。',
    difficulty: 3,
    conditions: [
      '独自去地下室（3分钟内成功返回）',
      '喝下安神茶（否则门被同伴锁死）',
      '未触发任何坏结局条件'
    ],
    triggerHint: '速度+信任+好结果',
    relatedInspirationIds: ['ins_002', 'ins_005'],
    similarityGroup: 'escape_with_ghost',
    costUnclear: true,
    unlocked: false
  },
  {
    id: 'end_005',
    title: '永不熄灯的宅邸',
    type: 'true',
    description: '你把日记还给女孩，戴上首饰盒里的发簪，接听了那通电话。宅邸主人感谢你的善良，在清晨打开了正门。你带走了所有人，包括每一个被困住的灵魂。',
    difficulty: 5,
    conditions: [
      '接听神秘来电并记住所有信息',
      '归还日记给女孩幽灵',
      '获得女孩给的首饰盒',
      '同伴信任总和超过150',
      '不触发任何坏结局条件'
    ],
    cost: '玩家会在每年生日收到一封来自宅邸的感谢信',
    triggerHint: '全善意路线+全线索+高信任',
    relatedInspirationIds: ['ins_003', 'ins_004'],
    costUnclear: false,
    unlocked: false
  },
  {
    id: 'end_006',
    title: '第七个同伴',
    type: 'hidden',
    description: '逃出宅邸时，清点人数发现多了一个人。那个小女孩跟你们一起走了。她从此成了你们团队中最安静、最幸运的一员。',
    difficulty: 4,
    conditions: [
      '归还日记',
      '女孩好感度达到最高',
      '真结局未达成，但逃出成功',
      '逃出时未清点人数'
    ],
    triggerHint: '善意+意外',
    relatedInspirationIds: ['ins_004'],
    similarityGroup: 'escape_with_ghost',
    costUnclear: true,
    unlocked: false
  }
];

const QUESTION_TEMPLATES: Record<string, Record<InfluenceDimension | 'general', string[]>> = {
  timing: {
    ghost: ['鬼影在什么时间点开始出现变化？变化前有什么预兆？'],
    trust: ['信任变化发生在哪个剧情节点？是当场变化还是事后揭晓？'],
    escape: ['逃离方式在游戏的哪个阶段可用？是否有时间窗口？'],
    custom: ['这个影响在什么时间范围内生效？是否只在特定章节有效？'],
    general: ['玩家在什么时机做出这个选择？太早或太晚选择会怎样？']
  },
  knowledge: {
    ghost: ['玩家怎么知道这个选择能影响鬼影？是提示、试错还是同伴告知？'],
    trust: ['同伴如何得知玩家的选择？是公开、被撞见还是事后发现？'],
    escape: ['玩家如何解锁这个逃离方式？需要什么前置信息？'],
    custom: ['玩家需要哪些背景知识才能做出这个选择？信息从哪里来？'],
    general: ['玩家选择前掌握了多少信息？信息不完整时选择会怎样？']
  },
  mechanism: {
    ghost: ['影响鬼影的具体机制是什么？概率、计数器还是触发式？'],
    trust: ['信任度如何量化影响后续剧情？是阈值判断还是梯度影响？'],
    escape: ['逃离方式的触发流程是？需要哪些道具或操作步骤？'],
    custom: ['自定义影响如何在系统中实现？参数如何调整？'],
    general: ['这个选择的因果机制是否自洽？有没有遗漏的中间环节？']
  },
  consequence: {
    ghost: ['鬼影频率变化后，有没有连锁的剧情后果？'],
    trust: ['信任变化后，同伴的行为有什么可见的改变？'],
    escape: ['选择这个逃离方式后，对结局有什么长期影响？'],
    custom: ['这个自定义影响会触发哪些后续分支？'],
    general: ['选择后会解锁/锁闭哪些其他选项？有没有蝴蝶效应？']
  },
  motivation: {
    ghost: ['玩家为什么选择改变鬼影频率？是恐惧、好奇还是策略？'],
    trust: ['玩家选择影响信任时，动机是什么？掌控、善意还是自保？'],
    escape: ['玩家优先考虑某一逃离方式的动机是什么？'],
    custom: ['玩家做出这个选择的心理动机是什么？'],
    general: ['这个选择是否符合角色设定？有没有动机断层？']
  }
};

export function generateCausalityQuestions(
  endingId: string | null,
  inspirations: Inspiration[]
): CausalityQuestion[] {
  if (!endingId) return [];

  const relatedInspirations = inspirations.filter((i) => i.relatedEndingIds.includes(endingId));
  console.log('[AI Prompt] 生成因果检查问题，相关灵感数:', relatedInspirations.length);
  
  const questions: CausalityQuestion[] = [];
  const categories: CausalityQuestion['category'][] = ['timing', 'knowledge', 'mechanism', 'consequence', 'motivation'];

  if (relatedInspirations.length === 0) {
    questions.push({
      id: `q_general_0`,
      question: '这个结局目前没有关联任何灵感节点。玩家是通过哪些选择一步步走到这个结局的？',
      answered: false,
      category: 'mechanism'
    });
    questions.push({
      id: `q_general_1`,
      question: '达成这个结局的关键转折点是什么？玩家在哪个瞬间"注定"了这个结果？',
      answered: false,
      category: 'timing'
    });
    return questions;
  }

  relatedInspirations.forEach((inspiration, idx) => {
    categories.forEach((category, catIdx) => {
      const dimKeys = inspiration.influences.map((i) => i.dimension);
      const chosenDim = dimKeys[catIdx % dimKeys.length] || 'general';
      const templates = QUESTION_TEMPLATES[category][chosenDim] || QUESTION_TEMPLATES[category].general;
      const template = templates[idx % templates.length];
      
      questions.push({
        id: `q_${inspiration.id}_${category}`,
        question: `关于【${inspiration.title}】：${template}`,
        answered: false,
        category
      });
    });
  });

  const globalQuestions: CausalityQuestion[] = [
    {
      id: 'q_global_cost',
      question: '这个结局的代价对玩家来说是否公平？玩家有没有合理的途径提前预判？',
      answered: false,
      category: 'consequence'
    },
    {
      id: 'q_global_emotion',
      question: '玩家在走向这个结局过程中，情绪曲线是怎样的？有没有足够的铺垫？',
      answered: false,
      category: 'motivation'
    }
  ];

  return [...questions, ...globalQuestions];
}
