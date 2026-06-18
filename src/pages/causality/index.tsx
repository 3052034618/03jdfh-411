import React, { useMemo, useEffect } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import classnames from 'classnames';
import Taro from '@tarojs/taro';
import styles from './index.module.scss';
import { useGameStore } from '@/store/gameStore';
import QuestionBubble from '@/components/QuestionBubble';
import TagChip from '@/components/TagChip';
import EmptyState from '@/components/EmptyState';
import type { Ending, EndingType } from '@/types';
import { ENDING_TYPE_LABELS, QUESTION_CATEGORY_LABELS, QUESTION_CATEGORY_ICONS } from '@/types';
import { getEndingTypeColor, getDifficultyLabel } from '@/utils/aiPrompt';

const CausalityPage: React.FC = () => {
  const {
    endings,
    selectedEndingId,
    causalityQuestions,
    selectEnding,
    regenerateQuestions,
    answerQuestion,
    getEndingRelatedInspirations,
    getCategoryProgress
  } = useGameStore();

  const selectedEnding = useMemo(
    () => endings.find((e) => e.id === selectedEndingId) || null,
    [endings, selectedEndingId]
  );

  const relatedInspirations = useMemo(
    () => (selectedEndingId ? getEndingRelatedInspirations(selectedEndingId) : []),
    [selectedEndingId, getEndingRelatedInspirations]
  );

  const progress = useMemo(() => {
    const total = causalityQuestions.length;
    if (total === 0) return { total, answered: 0, percent: 0 };
    const answered = causalityQuestions.filter((q) => q.answered).length;
    return { total, answered, percent: Math.round((answered / total) * 100) };
  }, [causalityQuestions]);

  const categoryProgress = useMemo(() => {
    if (!selectedEndingId) return {};
    return getCategoryProgress(selectedEndingId);
  }, [selectedEndingId, getCategoryProgress]);

  useEffect(() => {
    if (endings.length > 0 && !selectedEndingId) {
      selectEnding(endings[0].id);
    }
  }, [endings, selectedEndingId, selectEnding]);

  const handleSelectEnding = (ending: Ending) => {
    selectEnding(ending.id);
    console.log('[CausalityPage] 选中结局:', ending.title);
  };

  const handleRefresh = () => {
    if (!selectedEndingId) return;
    regenerateQuestions(selectedEndingId);
    Taro.showToast({ title: '已重新生成问题', icon: 'none' });
  };

  const handleAnswer = (questionId: string, answer: string) => {
    if (!selectedEndingId) return;
    answerQuestion(selectedEndingId, questionId, answer);
    Taro.vibrateShort && Taro.vibrateShort({ type: 'light' });
  };

  const getSelectorBadgeStyle = (type: EndingType) => {
    const c = getEndingTypeColor(type);
    return { background: c.bg, color: c.text, border: `1rpx solid ${c.border}` };
  };

  const getActiveSelectorStyle = (type: EndingType) => {
    const c = getEndingTypeColor(type);
    return { borderColor: c.text };
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 80) return { color: '#58D68D' };
    if (percent >= 50) return { color: '#F4D03F' };
    return {};
  };

  const getCategoryColor = (category: string) => {
    const map: Record<string, { bg: string; text: string }> = {
      timing: { bg: 'rgba(241, 196, 15, 0.15)', text: '#F4D03F' },
      knowledge: { bg: 'rgba(52, 152, 219, 0.15)', text: '#5DADE2' },
      mechanism: { bg: 'rgba(155, 89, 182, 0.15)', text: '#AF7AC5' },
      consequence: { bg: 'rgba(231, 76, 60, 0.15)', text: '#EC7063' },
      motivation: { bg: 'rgba(46, 204, 113, 0.15)', text: '#58D68D' }
    };
    return map[category] || map.mechanism;
  };

  const categoryList = Object.entries(categoryProgress);

  return (
    <View className={styles.container}>
      <View className={styles.pageHeader}>
        <Text className={styles.pageTitle}>
          <Text className={styles.pageTitleAccent}>因果</Text>检查
        </Text>
        <Text className={styles.pageSubtitle}>
          🔍 让我问你几个问题，把缺失的环节补全，让因果链能自洽
        </Text>
      </View>

      {/* 结局选择器 */}
      <Text className={styles.endingSelectorLabel}>选择要检查的结局</Text>
      <ScrollView scrollX className={styles.selectorScroll} enhanced showScrollbar={false}>
        {endings.map((ending) => {
          const colors = getEndingTypeColor(ending.type);
          const isActive = selectedEndingId === ending.id;
          return (
            <View
              key={ending.id}
              className={classnames(styles.selectorCard, isActive && styles.active)}
              style={isActive ? getActiveSelectorStyle(ending.type) : {}}
              onClick={() => handleSelectEnding(ending)}
            >
              {!ending.unlocked && <Text className={styles.selectorLock}>🔒</Text>}
              <Text
                className={styles.selectorBadge}
                style={getSelectorBadgeStyle(ending.type)}
              >
                {ENDING_TYPE_LABELS[ending.type]}
              </Text>
              <Text className={styles.selectorTitle}>{ending.title}</Text>
              <Text className={styles.selectorHint}>
                难度：{getDifficultyLabel(ending.difficulty)} · {ending.conditions.length}个条件
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {selectedEnding ? (
        <>
          {/* 结局详情卡片 */}
          <View className={styles.endingDetailCard}>
            <View className={styles.detailHeader}>
              <Text
                className={styles.detailTypeBadge}
                style={{
                  background: getEndingTypeColor(selectedEnding.type).bg,
                  color: getEndingTypeColor(selectedEnding.type).text,
                  border: `1rpx solid ${getEndingTypeColor(selectedEnding.type).border}`
                }}
              >
                {ENDING_TYPE_LABELS[selectedEnding.type]}
              </Text>
              <View className={styles.detailDiffBadge}>
                <Text className={styles.detailDiffLabel}>难度</Text>
                <Text className={styles.detailDiffValue}>
                  {getDifficultyLabel(selectedEnding.difficulty)}
                </Text>
              </View>
            </View>

            <Text className={styles.detailTitle}>{selectedEnding.title}</Text>

            <Text className={styles.detailDesc}>{selectedEnding.description}</Text>

            <Text className={styles.detailSectionTitle}>📋 达成条件</Text>
            <View className={styles.conditionList}>
              {selectedEnding.conditions.map((cond, i) => (
                <View key={i} className={styles.conditionItem}>
                  <Text className={styles.conditionBullet}>▸</Text>
                  <Text>{cond}</Text>
                </View>
              ))}
            </View>

            {selectedEnding.cost && (
              <View className={styles.costBox}>
                <Text className={styles.costLabel}>⚖️ 结局代价</Text>
                <Text className={styles.costText}>{selectedEnding.cost}</Text>
              </View>
            )}

            {/* 关联灵感 */}
            <View className={styles.relatedInspirations}>
              <Text className={styles.detailSectionTitle}>🔗 关联灵感节点</Text>
              {relatedInspirations.length === 0 ? (
                <View className={styles.relatedHint}>
                  💡 这个结局还没有关联任何灵感。去「灵感速记」添加一些选择点，再把它们和这个结局连起来吧。
                </View>
              ) : (
                <>
                  <View className={styles.relatedHint}>
                    已关联 {relatedInspirations.length} 个灵感节点。以下是这个结局在因果链上的关键选择点：
                  </View>
                  {relatedInspirations.map((ins) => (
                    <View key={ins.id} className={styles.relatedCard}>
                      <Text className={styles.relatedCardTitle}>→ {ins.title}</Text>
                      <Text className={styles.relatedCardDesc}>{ins.description}</Text>
                    </View>
                  ))}
                </>
              )}
            </View>
          </View>

          {/* 进度统计 */}
          <View className={styles.progressSection}>
            <View className={styles.progressHeader}>
              <Text className={styles.progressTitle}>因果链完整度</Text>
              <Text
                className={styles.progressValue}
                style={getProgressColor(progress.percent)}
              >
                {progress.percent}%
              </Text>
            </View>
            <View className={styles.progressBarBg}>
              <View
                className={styles.progressBarFill}
                style={{
                  width: `${progress.percent}%`,
                  background: progress.percent >= 80
                    ? 'linear-gradient(90deg, #2ECC71, #27AE60)'
                    : progress.percent >= 50
                    ? 'linear-gradient(90deg, #F1C40F, #F39C12)'
                    : 'linear-gradient(90deg, #9B59B6, #3498DB)'
                }}
              />
            </View>
            <View className={styles.progressStats}>
              <View className={styles.progressStatItem}>
                <Text
                  className={styles.progressStatNum}
                  style={{ color: '#58D68D' }}
                >
                  {progress.answered}
                </Text>
                <Text className={styles.progressStatLabel}>已补充</Text>
              </View>
              <View className={styles.progressStatItem}>
                <Text
                  className={styles.progressStatNum}
                  style={{ color: '#F4D03F' }}
                >
                  {progress.total - progress.answered}
                </Text>
                <Text className={styles.progressStatLabel}>待思考</Text>
              </View>
              <View className={styles.progressStatItem}>
                <Text
                  className={styles.progressStatNum}
                  style={{ color: '#5DADE2' }}
                >
                  {progress.total}
                </Text>
                <Text className={styles.progressStatLabel}>总问题</Text>
              </View>
            </View>
          </View>

          {/* 分类进度 */}
          {categoryList.length > 0 && (
            <View className={styles.categorySection}>
              <Text className={styles.categorySectionTitle}>📂 各环节补充情况</Text>
              <View className={styles.categoryGrid}>
                {categoryList.map(([category, info]) => {
                  const percent = info.total > 0 ? Math.round((info.answered / info.total) * 100) : 0;
                  const c = getCategoryColor(category);
                  return (
                    <View key={category} className={styles.categoryItem}>
                      <View className={styles.categoryHeader}>
                        <Text className={styles.categoryIcon}>
                          {QUESTION_CATEGORY_ICONS[category as keyof typeof QUESTION_CATEGORY_ICONS]}
                        </Text>
                        <View style={{ flex: 1 }}>
                          <Text className={styles.categoryName} style={{ color: c.text }}>
                            {QUESTION_CATEGORY_LABELS[category as keyof typeof QUESTION_CATEGORY_LABELS]}
                          </Text>
                          <Text className={styles.categoryProgressText}>
                            {info.answered}/{info.total} · {percent}%
                          </Text>
                        </View>
                      </View>
                      <View className={styles.categoryBarBg}>
                        <View
                          className={styles.categoryBarFill}
                          style={{ width: `${percent}%`, background: c.text }}
                        />
                      </View>
                      {info.answered < info.total && (
                        <Text className={styles.categoryMissing}>
                          还差 {info.total - info.answered} 个{QUESTION_CATEGORY_LABELS[category as keyof typeof QUESTION_CATEGORY_LABELS]}问题没补
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          <View className={styles.refreshBtn} onClick={handleRefresh}>
            <Text className={styles.refreshBtnText}>🔄 换一组问题</Text>
          </View>

          {/* 问题列表 */}
          <View className={styles.questionsArea}>
            {causalityQuestions.length === 0 ? (
              <View className={styles.emptyQuestions}>
                <EmptyState
                  icon="🤔"
                  title="暂时没有问题"
                  description="关联更多灵感节点后，可以生成更有针对性的因果检查问题"
                />
              </View>
            ) : (
              causalityQuestions.map((q, idx) => (
                <QuestionBubble
                  key={q.id}
                  data={q}
                  index={idx}
                  onAnswer={(ans) => handleAnswer(q.id, ans)}
                />
              ))
            )}
          </View>
        </>
      ) : (
        <View style={{ marginTop: 120 }}>
          <EmptyState
            icon="📖"
            title="还没有结局"
            description="先去「结局卡册」创建一些结局，再回来检查因果链是否完整"
          />
        </View>
      )}
    </View>
  );
};

export default CausalityPage;
