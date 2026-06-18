import React from 'react';
import { View, Text } from '@tarojs/components';
import classnames from 'classnames';
import styles from './index.module.scss';

interface TagChipProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
  color?: 'ghost' | 'trust' | 'escape' | 'custom' | 'default';
  onRemove?: () => void;
}

const TagChip: React.FC<TagChipProps> = ({ label, active, onClick, color = 'default', onRemove }) => {
  const colorMap: Record<string, { bg: string; text: string; activeBg: string; activeText: string }> = {
    ghost: {
      bg: 'rgba(231, 76, 60, 0.1)',
      text: '#EC7063',
      activeBg: 'rgba(231, 76, 60, 0.25)',
      activeText: '#F1948A'
    },
    trust: {
      bg: 'rgba(46, 204, 113, 0.1)',
      text: '#58D68D',
      activeBg: 'rgba(46, 204, 113, 0.25)',
      activeText: '#82E0AA'
    },
    escape: {
      bg: 'rgba(52, 152, 219, 0.1)',
      text: '#5DADE2',
      activeBg: 'rgba(52, 152, 219, 0.25)',
      activeText: '#85C1E9'
    },
    custom: {
      bg: 'rgba(155, 89, 182, 0.1)',
      text: '#AF7AC5',
      activeBg: 'rgba(155, 89, 182, 0.25)',
      activeText: '#D2B4DE'
    },
    default: {
      bg: 'rgba(120, 120, 138, 0.15)',
      text: '#B8B8C8',
      activeBg: 'rgba(155, 89, 182, 0.2)',
      activeText: '#D2B4DE'
    }
  };

  const c = colorMap[color] || colorMap.default;

  return (
    <View
      className={classnames(styles.chip, active && styles.active)}
      onClick={onClick}
      style={{
        background: active ? c.activeBg : c.bg,
        borderColor: active ? c.activeText : 'transparent'
      }}
    >
      <Text
        className={styles.label}
        style={{ color: active ? c.activeText : c.text }}
      >
        {label}
      </Text>
      {onRemove && (
        <View className={styles.removeBtn} onClick={(e) => { e.stopPropagation(); onRemove(); }}>
          <Text className={styles.removeText}>×</Text>
        </View>
      )}
    </View>
  );
};

export default TagChip;
