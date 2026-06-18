import React, { useMemo, useEffect, useState } from 'react';
import { View, Text, ScrollView } from '@tarojs/components';
import classnames from 'classnames';
import Taro from '@tarojs/taro';
import styles from './index.module.scss';
import { useGameStore } from '@/store/gameStore';
import QuestionBubble from '@/components/QuestionBubble';
import EmptyState from '@/components/EmptyState';
import type { Ending, EndingType } from '@/types';
import { ENDING_TYPE_LABELS } from '@/types';
import { getEndingTypeColor, getDifficultyLabel } from '@/utils/aiPrompt';

type ViewMode = 'interview' | 'review';

const CausalityPage: React.FC = () => {
  const {
    endings,
    selectedEndingId,
    causalityQuestions,
    selectEnding,
    regenerateQuestions,
    answerQuestion,
    getEndingRelatedInspirations,
    getCategoryProgress,
    getEndingReview
  } = useGameStore();

  const [viewMode, setViewMode] = useState<ViewMode>('interview');

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

  const reviewData = useMemo(() => {
    if (!selectedEndingId) return null;
    return getEndingReview(selectedEndingId);
  }, [selectedEndingId, getEndingReview]);

  useEffect(() => {
    if (endings.length > 0 && !selectedEndingId) {
      selectEnding(endings[0].id);
    }
  }, [endings, selectedEndingId, selectEnding]);

  const handleSelectEnding = (ending: Ending) => {
    selectEnding(ending.id);
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

          {/* 模式切换 Tab */}
          <View className={styles.viewModeTabs}>
            <View
              className={classnames(styles.viewModeTab, viewMode === 'interview' && styles.active)}
              onClick={() => setViewMode('interview')}
            >
              <Text className={styles.viewModeTabIcon}>❓</Text>
              <Text className={styles.viewModeTabText}>追问模式</Text>
              {progress.total - progress.answered > 0 && (
                <View className={styles.viewModeTabBadge}>
                  <Text className={styles.viewModeTabBadgeText}>
                    {progress.total - progress.answered}
                  </Text>
                </View>
              )}
            </View>
            <View
              className={classnames(styles.viewModeTab, viewMode === 'review' && styles.active)}
              onClick={() => setViewMode('review')}
            >
              <Text className={styles.viewModeTabIcon}>📝</Text>
              <Text className={styles.viewModeTabText}>复盘视图</Text>
              {reviewData && reviewData.answeredCount > 0 && (
                <View className={styles.viewModeTabBadgeGreen}>
                  <Text className={styles.viewModeTabBadgeText}>
                    {reviewData.answeredCount}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* 分类进度（两种模式通用） */}
          {categoryList.length > 0 && (
            <View className={styles.categorySection}>
              <Text className={styles.categorySectionTitle}>📂 各环节补充情况</Text>
              <View className={styles.categoryGrid}>
                {categoryList.map(([category, info]) => {
                  const percent = info.total > 0 ? Math.round((info.answered / info.total) * 100) : 0;
                  const c = getCategoryColor(category);
                  const labelMap: Record<string, string> = {
                    timing: '时间节点',
                    knowledge: '信息获取',
                    mechanism: '触发机制',
                    consequence: '连锁后果',
                    motivation: '角色动机'
                  };
                  const iconMap: Record<string, string> = {
                    timing: '⏰',
                    knowledge: '💡',
                    mechanism: '⚙️',
                    consequence: '🔗',
                    motivation: '🧠'
                  };
                  return (
                    <View key={category} className={styles.categoryItem}>
                      <View className={styles.categoryHeader}>
                        <Text className={styles.categoryIcon}>
                          {iconMap[category]}
                        </Text>
                        <View style={{ flex: 1 }}>
                          <Text className={styles.categoryName} style={{ color: c.text }}>
                            {labelMap[category]}
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
                          还差 {info.total - info.answered} 个{labelMap[category]}问题没补
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* =============== 追问模式 =============== */}
          {viewMode === 'interview' && (
            <>
              <View className={styles.refreshBtn} onClick={handleRefresh}>
                <Text className={styles.refreshBtnText}>🔄 换一组问题</Text>
              </View>

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
          )}

          {/* =============== 复盘视图 =============== */}
          {viewMode === 'review' && reviewData && (
            <View className={styles.reviewArea}>
              {reviewData.answeredCount === 0 ? (
                <View className={styles.emptyQuestions}>
                  <EmptyState
                    icon="✏️"
                    title="还没有补充任何内容"
                    description="先切到「追问模式」回答几个问题，再来这里看整理好的复盘吧"
                    actionLabel="❓ 去回答问题"
                    onAction={() => setViewMode('interview')}
                  />
                </View>
              ) : (
                <>
                  <View className={styles.reviewHeaderCard}>
                    <Text className={styles.reviewHeaderTitle}>📑 因果链复盘笔记</Text>
                    <Text className={styles.reviewHeaderMeta}>
                      为【{selectedEnding.title}】已补充 {reviewData.answeredCount}/{reviewData.totalCount} 条内容
                    </Text>
                    <Text className={styles.reviewHeaderHint}>
                      💡 以下按「时间→信息→机制→后果→动机」五个环节整理，便于你把整段因果链串起来阅读
                    </Text>
                  </View>

                  {reviewData.sections.map((section) => (
                    section.questions.length > 0 && (
                      <View key={section.category} className={styles.reviewSection}>
                        <View
                          className={styles.reviewSectionHeader}
                          style={{
                            background: getCategoryColor(section.category).bg,
                            borderLeft: `6rpx solid ${getCategoryColor(section.category).text}`
                          }}
                        >
                          <Text className={styles.reviewSectionIcon}>{section.icon}</Text>
                          <View style={{ flex: 1 }}>
                            <Text
                              className={styles.reviewSectionTitle}
                              style={{ color: getCategoryColor(section.category).text }}
                            >
                              {section.label}
                            </Text>
                            <Text className={styles.reviewSectionCount}>
                              已补充 {section.questions.length} 条
                            </Text>
                          </View>
                        </View>

                        {section.questions.map((qa, idx) => (
                          <View key={qa.questionId} className={styles.qaCard}>
                            <View className={styles.qaCardIndex}>
                              <Text className={styles.qaCardIndexText}>{idx + 1}</Text>
                            </View>
                            <View className={styles.qaCardBody}>
                              <View className={styles.qaQuestionRow}>
                                <Text className={styles.qaQuestionLabel}>问</Text>
                                <Text className={styles.qaQuestionText}>{qa.question}</Text>
                              </View>
                              <View className={styles.qaAnswerRow}>
                                <Text className={styles.qaAnswerLabel}>答</Text>
                                <Text className={styles.qaAnswerText}>{qa.answer}</Text>
                              </View>
                            </View>
                          </View>
                        ))}
                      </View>
                    )
                  ))}

                  {reviewData.answeredCount < reviewData.totalCount && (
                    <View className={styles.reviewGapCard}>
                      <Text className={styles.reviewGapTitle}>🕳️ 还有环节没补完</Text>
                      <Text className={styles.reviewGapText}>
                        还差 {reviewData.totalCount - reviewData.answeredCount} 条问题没回答。切回「追问模式」继续补完，整条因果链会更清晰。
                      </Text>
                      <View
                        className={styles.reviewGapBtn}
                        onClick={() => setViewMode('interview')}
                      >
                        <Text className={styles.reviewGapBtnText}>❓ 切换到追问模式</Text>
                      </View>
                    </View>
                  )}
                </>
              )}
            </View>
          )}
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
