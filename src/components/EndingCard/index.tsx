import React from 'react';
import { View, Text } from '@tarojs/components';
import classnames from 'classnames';
import styles from './index.module.scss';
import type { Ending } from '@/types';
import { ENDING_TYPE_LABELS } from '@/types';
import { getEndingTypeColor, getDifficultyLabel } from '@/utils/aiPrompt';

interface EndingCardProps {
  data: Ending;
  onClick?: () => void;
  selected?: boolean;
  showWarning?: boolean;
  warningType?: 'similar' | 'cost';
}

const EndingCard: React.FC<EndingCardProps> = ({ data, onClick, selected, showWarning, warningType }) => {
  const colors = getEndingTypeColor(data.type);

  return (
    <View
      className={classnames(styles.card, selected && styles.selected)}
      onClick={onClick}
      style={selected ? { borderColor: colors.border, boxShadow: `0 0 0 2rpx ${colors.border}` } : {}}
    >
      <View className={styles.header}>
        <View className={styles.typeBadge} style={{ background: colors.bg, color: colors.text, borderColor: colors.border }}>
          {ENDING_TYPE_LABELS[data.type]}
        </View>

        <View className={styles.difficultyBox}>
          <Text className={styles.difficultyLabel} style={{ color: colors.text }}>
            {getDifficultyLabel(data.difficulty)}
          </Text>
          <View className={styles.difficultyDots}>
            {[1, 2, 3, 4, 5].map((lv) => (
              <View
                key={lv}
                className={classnames(styles.diffDot, lv <= data.difficulty && styles.diffDotActive)}
                style={lv <= data.difficulty ? { background: colors.text } : {}}
              />
            ))}
          </View>
        </View>
      </View>

      <Text className={styles.title}>{data.title}</Text>

      <Text className={styles.hint}>🔑 {data.triggerHint}</Text>

      {showWarning && (
        <View className={styles.warningBox}>
          <Text className={styles.warningIcon}>⚠️</Text>
          <Text className={styles.warningText}>
            {warningType === 'similar' ? '与其他结局条件相似，注意区分触发点' : '结局代价尚不明确，建议补充'}
          </Text>
        </View>
      )}

      {!data.unlocked && (
        <View className={styles.lockOverlay}>
          <Text className={styles.lockIcon}>🔒</Text>
          <Text className={styles.lockText}>未解锁</Text>
        </View>
      )}
    </View>
  );
};

export default EndingCard;
