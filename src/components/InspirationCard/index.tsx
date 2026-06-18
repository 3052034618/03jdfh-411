import React from 'react';
import { View, Text } from '@tarojs/components';
import classnames from 'classnames';
import styles from './index.module.scss';
import type { Inspiration } from '@/types';
import { INFLUENCE_LABELS } from '@/types';
import { formatTime } from '@/utils/aiPrompt';

interface InspirationCardProps {
  data: Inspiration;
  onClick?: () => void;
  compact?: boolean;
}

const InspirationCard: React.FC<InspirationCardProps> = ({ data, onClick, compact }) => {
  const getDimBg = (dim: string) => {
    const map: Record<string, string> = {
      ghost: 'rgba(231, 76, 60, 0.12)',
      trust: 'rgba(46, 204, 113, 0.12)',
      escape: 'rgba(52, 152, 219, 0.12)',
      custom: 'rgba(155, 89, 182, 0.12)'
    };
    return map[dim] || map.custom;
  };

  const getDimColor = (dim: string) => {
    const map: Record<string, string> = {
      ghost: '#EC7063',
      trust: '#58D68D',
      escape: '#5DADE2',
      custom: '#AF7AC5'
    };
    return map[dim] || map.custom;
  };

  return (
    <View
      className={classnames(styles.card, compact && styles.compact)}
      onClick={onClick}
    >
      <View className={styles.header}>
        <Text className={styles.title}>{data.title}</Text>
        <Text className={styles.time}>{formatTime(data.createdAt)}</Text>
      </View>

      {!compact && (
        <Text className={styles.description}>{data.description}</Text>
      )}

      {data.influences.length > 0 && (
        <View className={styles.influences}>
          {data.influences.map((inf, i) => (
            <View
              key={i}
              className={styles.influenceItem}
              style={{ background: getDimBg(inf.dimension), borderLeftColor: getDimColor(inf.dimension) }}
            >
              <View className={styles.influenceHeader}>
                <Text className={styles.influenceLabel} style={{ color: getDimColor(inf.dimension) }}>
                  {INFLUENCE_LABELS[inf.dimension]}
                </Text>
                <View className={styles.levelDots}>
                  {[1, 2, 3, 4, 5].map((lv) => (
                    <View
                      key={lv}
                      className={classnames(
                        styles.levelDot,
                        lv <= inf.level && styles.levelDotActive
                      )}
                      style={lv <= inf.level ? { background: getDimColor(inf.dimension) } : {}}
                    />
                  ))}
                </View>
              </View>
              <Text className={styles.influenceContent}>{inf.content}</Text>
            </View>
          ))}
        </View>
      )}

      {data.tags.length > 0 && (
        <View className={styles.tags}>
          {data.tags.map((tag, i) => (
            <Text key={i} className={styles.tag}>#{tag}</Text>
          ))}
        </View>
      )}
    </View>
  );
};

export default InspirationCard;
