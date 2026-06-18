import React from 'react';
import { View, Text } from '@tarojs/components';
import styles from './index.module.scss';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon = '🌙',
  title,
  description,
  actionLabel,
  onAction
}) => {
  return (
    <View className={styles.wrapper}>
      <Text className={styles.icon}>{icon}</Text>
      <Text className={styles.title}>{title}</Text>
      {description && (
        <Text className={styles.description}>{description}</Text>
      )}
      {actionLabel && onAction && (
        <View className={styles.actionBtn} onClick={onAction}>
          <Text className={styles.actionText}>{actionLabel}</Text>
        </View>
      )}
    </View>
  );
};

export default EmptyState;
