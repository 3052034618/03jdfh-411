import type { Inspiration, Influence, InfluenceDimension, EndingType } from '../types';

const GHOST_KEYWORDS = ['镜', '鬼', '影', '灵', '怪', '魂', '叫', '响', '爬', '附'];
const TRUST_KEYWORDS = ['同伴', '信任', '发现', '分享', '看见', '交谈', '拒绝', '喝'];
const ESCAPE_KEYWORDS = ['逃', '钥匙', '门', '出', '离开', '开', '返回', '安全'];

export function suggestDimensions(text: string): InfluenceDimension[] {
  const suggestions: InfluenceDimension[] = [];
  const lower = text.toLowerCase();
  
  if (GHOST_KEYWORDS.some((k) => text.includes(k))) suggestions.push('ghost');
  if (TRUST_KEYWORDS.some((k) => text.includes(k))) suggestions.push('trust');
  if (ESCAPE_KEYWORDS.some((k) => text.includes(k))) suggestions.push('escape');
  
  if (suggestions.length === 0) {
    suggestions.push('ghost', 'trust');
  }
  
  return suggestions;
}

export function generateInfluencePrompt(
  dimension: InfluenceDimension,
  inspirationText: string
): string {
  const prompts: Record<InfluenceDimension, string[]> = {
    ghost: [
      `根据「${inspirationText.slice(0, 15)}」，推测鬼影出现频率会如何变化？`,
      `这个选择会不会吸引或驱散某些灵体？以什么方式？`,
      `建议：如果这是压制型操作，填写"-XX%"；如果是吸引型，填写"+XX% 特定灵体"`
    ],
    trust: [
      `同伴会如何看待「${inspirationText.slice(0, 15)}」这个行为？`,
      `不同性格的同伴会不会有不同反应？建议区分"理性派/感性派"`,
      `建议用具体数值表达信任度变化，如"+20"或"-15"`
    ],
    escape: [
      `这个选择是否解锁了新的逃离路径？需要消耗什么？`,
      `「${inspirationText.slice(0, 15)}」会不会改变最终逃离的方式？`,
      `建议包含"道具消耗"或"时间窗口"等限制条件"`
    ],
    custom: [
      `这个选择还会影响什么自定义维度？（如：线索、时间、资源）`,
      `有没有隐藏的连锁反应还没记录？`,
      `可以记录关键线索、伏笔信息、NPC好感度等特殊维度`
    ]
  };
  
  const list = prompts[dimension];
  return list[Math.floor(Math.random() * list.length)];
}

export function suggestTags(inspiration: Partial<Inspiration>): string[] {
  const tags: string[] = [];
  const text = (inspiration.title || '') + (inspiration.description || '');
  
  if (/(道具|红布|钥匙|日记|茶|首饰|画)/.test(text)) tags.push('道具');
  if (/(独自|单独|一个人)/.test(text)) tags.push('单人行动');
  if (/(信任|同伴|交谈|分享)/.test(text)) tags.push('社交');
  if (/(镜|电话|画|地下室|楼梯)/.test(text)) tags.push('场景');
  if (/(善意|归还|帮助)/.test(text)) tags.push('善意');
  if (/(背叛|拒绝|锁|骗)/.test(text)) tags.push('信任考验');
  if (/(线索|密码|信息|通话)/.test(text)) tags.push('线索');
  if (/(时间|午夜|凌晨|分钟|秒)/.test(text)) tags.push('时间限制');
  
  return tags.slice(0, 4);
}

export function getEndingTypeColor(type: EndingType): { bg: string; text: string; border: string } {
  const colors: Record<EndingType, { bg: string; text: string; border: string }> = {
    bad: { bg: 'rgba(231, 76, 60, 0.12)', text: '#EC7063', border: 'rgba(231, 76, 60, 0.3)' },
    hidden: { bg: 'rgba(46, 204, 113, 0.12)', text: '#58D68D', border: 'rgba(46, 204, 113, 0.3)' },
    true: { bg: 'rgba(241, 196, 15, 0.12)', text: '#F4D03F', border: 'rgba(241, 196, 15, 0.3)' }
  };
  return colors[type];
}

export function getDifficultyLabel(level: number): string {
  const labels = ['', '极易', '容易', '普通', '困难', '极难'];
  return labels[level] || '未知';
}

export function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}
