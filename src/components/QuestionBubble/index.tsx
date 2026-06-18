import React, { useState } from 'react';
import { View, Text, Textarea, Button } from '@tarojs/components';
import classnames from 'classnames';
import styles from './index.module.scss';
import type { CausalityQuestion } from '@/types';
import { QUESTION_CATEGORY_LABELS } from '@/types';

interface QuestionBubbleProps {
  data: CausalityQuestion;
  onAnswer: (answer: string) => void;
  index: number;
}

const QuestionBubble: React.FC<QuestionBubbleProps> = ({ data, onAnswer, index }) => {
  const [answerText, setAnswerText] = useState(data.answer || '');
  const [isEditing, setIsEditing] = useState(!data.answered);

  const handleSubmit = () => {
    if (answerText.trim()) {
      onAnswer(answerText.trim());
      setIsEditing(false);
    }
  };

  const categoryColorMap: Record<string, { bg: string; text: string }> = {
    timing: { bg: 'rgba(241, 196, 15, 0.12)', text: '#F4D03F' },
    knowledge: { bg: 'rgba(52, 152, 219, 0.12)', text: '#5DADE2' },
    mechanism: { bg: 'rgba(155, 89, 182, 0.12)', text: '#AF7AC5' },
    consequence: { bg: 'rgba(231, 76, 60, 0.12)', text: '#EC7063' },
    motivation: { bg: 'rgba(46, 204, 113, 0.12)', text: '#58D68D' }
  };

  const colors = categoryColorMap[data.category] || categoryColorMap.mechanism;

  return (
    <View className={classnames(styles.wrapper, data.answered && styles.answered)}>
      <View className={styles.numberBadge}>Q{index + 1}</View>

      <View className={styles.questionBubble} style={{ borderColor: colors.bg }}>
        <View className={styles.bubbleHeader}>
          <Text
            className={styles.categoryTag}
            style={{ background: colors.bg, color: colors.text }}
          >
            {QUESTION_CATEGORY_LABELS[data.category]}
          </Text>
          {data.answered && (
            <Text className={styles.answeredBadge}>✓ 已回答</Text>
          )}
        </View>
        <Text className={styles.questionText}>{data.question}</Text>
      </View>

      {(isEditing || !data.answered) && (
        <View className={styles.answerSection}>
          <Textarea
            className={styles.textarea}
            placeholder="在这里补充因果链的缺失环节...让它成为能自洽的逻辑"
            placeholderClass={styles.textareaPlaceholder}
            value={answerText}
            onInput={(e) => setAnswerText(e.detail.value)}
            maxlength={500}
            autoHeight
          />
          <View className={styles.actionRow}>
            <Text className={styles.hintText}>💡 想想：玩家怎么知道？何时发生？代价是什么？</Text>
            <Button
              className={styles.submitBtn}
              onClick={handleSubmit}
              disabled={!answerText.trim()}
            >
              记录
            </Button>
          </View>
        </View>
      )}

      {data.answered && !isEditing && (
        <View className={styles.answerBubble}>
          <View className={styles.answerLabel}>📝 你的补充</View>
          <Text className={styles.answerText}>{data.answer}</Text>
          <Button
            className={styles.editBtn}
            onClick={() => setIsEditing(true)}
          >
            重新编辑
          </Button>
        </View>
      )}
    </View>
  );
};

export default QuestionBubble;
