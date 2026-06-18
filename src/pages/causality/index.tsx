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
type ReviewSubMode = 'sections' | 'timeline';
type CollapseMode = 'all' | 'incomplete';

const REVIEW_CATEGORY_ORDER: string[] = ['timing', 'knowledge', 'mechanism', 'consequence', 'motivation'];

const CausalityPage: React.FC = () => {
  const {
    endings,
    selectedEndingId,
    selectedInspirationForCausalityId,
    causalityQuestions,
    selectEnding,
    selectInspirationForCausality,
    regenerateQuestions,
    answerQuestion,
    getEndingRelatedInspirations,
    getCategoryProgress,
    getEndingReview,
    exportReviewToNotes,
    getInspirationById
  } = useGameStore();

  const contextInspiration = useMemo(() => {
    if (!selectedInspirationForCausalityId) return null;
    return getInspirationById(selectedInspirationForCausalityId) || null;
  }, [selectedInspirationForCausalityId, getInspirationById]);

  const [viewMode, setViewMode] = useState<ViewMode>('interview');
  const [reviewSubMode, setReviewSubMode] = useState<ReviewSubMode>('sections');
  const [collapseMode, setCollapseMode] = useState<CollapseMode>('all');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [showExportToast, setShowExportToast] = useState(false);

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

      {/* 灵感上下文横幅 */}
      {contextInspiration && (
        <View className={styles.inspirationContextBanner}>
          <Text className={styles.inspirationContextIcon}>🎯</Text>
          <View className={styles.inspirationContextContent}>
            <Text className={styles.inspirationContextLabel}>当前带着灵感补链</Text>
            <Text className={styles.inspirationContextTitle}>{contextInspiration.title}</Text>
          </View>
          <View
            className={styles.inspirationContextClear}
            onClick={() => selectInspirationForCausality(null)}
          >
            <Text>清除</Text>
          </View>
        </View>
      )}

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
                      highlighted={!!contextInspiration}
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
                    <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <Text className={styles.reviewHeaderTitle}>📑 因果链复盘笔记</Text>
                      <View
                        className={styles.exportBtn}
                        onClick={async () => {
                          const notes = exportReviewToNotes(selectedEndingId || '');
                          if (!notes.trim()) {
                            Taro.showToast({ title: '还没有内容可导出', icon: 'none' });
                            return;
                          }
                          try {
                            Taro.setClipboardData({
                              data: notes,
                              success: () => {
                                Taro.showToast({ title: '已复制到剪贴板 📋', icon: 'none' });
                              }
                            });
                          } catch (e) {
                            Taro.showModal({
                              title: '创作笔记',
                              content: '复制到剪贴板失败，以下是完整内容：\n\n' + notes,
                              showCancel: false,
                              confirmText: '好的'
                            });
                          }
                        }}
                      >
                        <Text className={styles.exportBtnText}>📋 导出笔记</Text>
                      </View>
                    </View>
                    <Text className={styles.reviewHeaderMeta}>
                      为【{selectedEnding.title}】已补充 {reviewData.answeredCount}/{reviewData.totalCount} 条内容
                    </Text>
                    <Text className={styles.reviewHeaderHint}>
                      💡 以下按「时间→信息→机制→后果→动机」五个环节整理，便于你把整段因果链串起来阅读
                    </Text>

                    {/* 复盘二级 Tab */}
                    <View className={styles.reviewSubTabs}>
                      <View
                        className={classnames(styles.reviewSubTab, reviewSubMode === 'sections' && styles.active)}
                        onClick={() => setReviewSubMode('sections')}
                      >
                        <Text className={styles.reviewSubTabIcon}>📋</Text>
                        <Text className={styles.reviewSubTabText}>分段复盘</Text>
                      </View>
                      <View
                        className={classnames(styles.reviewSubTab, reviewSubMode === 'timeline' && styles.active)}
                        onClick={() => setReviewSubMode('timeline')}
                      >
                        <Text className={styles.reviewSubTabIcon}>⏳</Text>
                        <Text className={styles.reviewSubTabText}>剧情时间线</Text>
                      </View>
                    </View>

                    {/* 折叠模式切换 */}
                    {reviewSubMode === 'sections' && (
                      <View className={styles.collapseToggleRow}>
                        <Text
                          className={classnames(styles.collapseOption, collapseMode === 'all' && styles.active)}
                          onClick={() => setCollapseMode('all')}
                        >
                          📂 显示全部
                        </Text>
                        <Text
                          className={classnames(styles.collapseOption, collapseMode === 'incomplete' && styles.active)}
                          onClick={() => setCollapseMode('incomplete')}
                        >
                          👁️ 只看未补全
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* =============== 分段复盘模式 =============== */}
                  {reviewSubMode === 'sections' && (
                    <>
                      {REVIEW_CATEGORY_ORDER.map((cat) => {
                        const section = reviewData.sections.find((s) => s.category === cat);
                        if (!section) return null;

                        const catProgress = categoryProgress[cat];
                        const isComplete = catProgress && catProgress.answered === catProgress.total;
                        const shouldShow = collapseMode === 'all' || !isComplete;
                        if (!shouldShow && section.questions.length === 0) return null;

                        const isCollapsed = collapsedSections[cat] && isComplete;

                        return (
                          <View key={section.category} className={styles.reviewSection}>
                            <View
                              className={styles.reviewSectionHeader}
                              style={{
                                background: getCategoryColor(section.category).bg,
                                borderLeft: `6rpx solid ${getCategoryColor(section.category).text}`,
                                cursor: isComplete ? 'pointer' : 'default'
                              }}
                              onClick={() => {
                                if (isComplete) {
                                  setCollapsedSections((prev) => ({
                                    ...prev,
                                    [cat]: !prev[cat]
                                  }));
                                }
                              }}
                            >
                              <Text className={styles.reviewSectionIcon}>{section.icon}</Text>
                              <View style={{ flex: 1 }}>
                                <Text
                                  className={styles.reviewSectionTitle}
                                  style={{ color: getCategoryColor(section.category).text }}
                                >
                                  {section.label}
                                  {isComplete && (
                                    <Text className={styles.sectionCompleteBadge}>✓ 已补完</Text>
                                  )}
                                </Text>
                                <Text className={styles.reviewSectionCount}>
                                  已补充 {section.questions.length} 条
                                  {catProgress && ` · ${catProgress.answered}/${catProgress.total}`}
                                </Text>
                              </View>
                              {isComplete && (
                                <Text className={styles.collapseArrow}>
                                  {isCollapsed ? '›' : '⌄'}
                                </Text>
                              )}
                            </View>

                            {!isCollapsed && section.questions.map((qa, idx) => (
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

                            {!isCollapsed && section.questions.length === 0 && catProgress && catProgress.total > 0 && (
                              <View className={styles.emptySectionHint}>
                                <Text className={styles.emptySectionHintText}>
                                  这个环节还差 {catProgress.total} 个问题没回答，切到追问模式补一下 →
                                </Text>
                              </View>
                            )}
                          </View>
                        );
                      })}

                      {collapseMode === 'incomplete' &&
                        reviewData.sections.every((s) => {
                          const p = categoryProgress[s.category];
                          return p && p.answered === p.total;
                        }) && (
                        <View className={styles.allCompleteHint}>
                          <Text className={styles.allCompleteText}>
                            🎉 所有环节都已补完！你可以切换到「剧情时间线」模式，把整段因果链串起来阅读。
                          </Text>
                        </View>
                      )}
                    </>
                  )}

                  {/* =============== 剧情时间线模式 =============== */}
                  {reviewSubMode === 'timeline' && (
                    <View className={styles.timelineArea}>
                      <View className={styles.timelineIntroCard}>
                        <Text className={styles.timelineIntroTitle}>⏳ 剧情时间线</Text>
                        <Text className={styles.timelineIntroText}>
                          从选择点出发，按「时间→信息→机制→后果→动机」串起整段因果链，看起来像一条从选择到后果的剧情链。
                        </Text>
                      </View>

                      {/* 灵感选择点作为时间线起点 */}
                      {relatedInspirations.length > 0 && (
                        <View className={styles.timelineChoicePoints}>
                          <Text className={styles.timelineChoiceLabel}>🎯 关键选择点</Text>
                          {relatedInspirations.slice(0, 3).map((ins, i) => (
                            <View key={ins.id} className={styles.timelineChoiceCard}>
                              <Text className={styles.timelineChoiceIndex}>#{i + 1}</Text>
                              <View style={{ flex: 1, minWidth: 0 }}>
                                <Text className={styles.timelineChoiceTitle}>{ins.title}</Text>
                                <Text className={styles.timelineChoiceDesc} numberOfLines={2}>
                                  {ins.description}
                                </Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      )}

                      {/* 时间线主体 */}
                      <View className={styles.timelineMain}>
                        {REVIEW_CATEGORY_ORDER.map((cat, catIdx) => {
                          const section = reviewData.sections.find((s) => s.category === cat);
                          if (!section) return null;
                          const catProgress = categoryProgress[cat];
                          const isComplete = catProgress && catProgress.answered === catProgress.total;

                          return (
                            <View key={cat} className={styles.timelineNode}>
                              <View className={styles.timelineNodeLeft}>
                                <View
                                  className={styles.timelineNodeDot}
                                  style={{
                                    background: isComplete
                                      ? getCategoryColor(cat).text
                                      : 'transparent',
                                    borderColor: getCategoryColor(cat).text
                                  }}
                                >
                                  {isComplete && (
                                    <Text className={styles.timelineNodeDotTick}>✓</Text>
                                  )}
                                </View>
                                {catIdx < REVIEW_CATEGORY_ORDER.length - 1 && (
                                  <View
                                    className={styles.timelineNodeLine}
                                    style={{
                                      background: isComplete
                                        ? `linear-gradient(180deg, ${getCategoryColor(cat).text}, ${getCategoryColor(REVIEW_CATEGORY_ORDER[catIdx + 1]).text})`
                                        : '#3A3A5A'
                                    }}
                                  />
                                )}
                              </View>

                              <View className={styles.timelineNodeContent}>
                                <View
                                  className={styles.timelineNodeHeader}
                                  style={{
                                    background: getCategoryColor(cat).bg,
                                    borderLeft: `4rpx solid ${getCategoryColor(cat).text}`
                                  }}
                                >
                                  <Text className={styles.timelineNodeIcon}>{section.icon}</Text>
                                  <Text
                                    className={styles.timelineNodeTitle}
                                    style={{ color: getCategoryColor(cat).text }}
                                  >
                                    {section.label}
                                  </Text>
                                  {!isComplete && catProgress && (
                                    <Text className={styles.timelineNodeProgressBadge}>
                                      {catProgress.answered}/{catProgress.total}
                                    </Text>
                                  )}
                                </View>

                                {section.questions.length > 0 ? (
                                  <View className={styles.timelineNodeItems}>
                                    {section.questions.map((qa, idx) => (
                                      <View key={qa.questionId} className={styles.timelineItem}>
                                        <View className={styles.timelineItemQ}>
                                          <Text className={styles.timelineItemQLabel}>Q</Text>
                                          <Text className={styles.timelineItemQText}>{qa.question}</Text>
                                        </View>
                                        <View className={styles.timelineItemA}>
                                          <Text className={styles.timelineItemALabel}>A</Text>
                                          <Text className={styles.timelineItemAText}>{qa.answer}</Text>
                                        </View>
                                      </View>
                                    ))}
                                  </View>
                                ) : (
                                  <View className={styles.timelineNodeGap}>
                                    <Text className={styles.timelineNodeGapText}>
                                      ⏳ 这个环节还没有补充内容...
                                    </Text>
                                  </View>
                                )}
                              </View>
                            </View>
                          );
                        })}
                      </View>

                      {/* 结局终点 */}
                      <View className={styles.timelineEnding}>
                        <View className={styles.timelineEndingLine} />
                        <View
                          className={styles.timelineEndingCard}
                          style={{
                            borderColor: getEndingTypeColor(selectedEnding.type).text,
                            background: `linear-gradient(135deg, ${getEndingTypeColor(selectedEnding.type).bg}, rgba(0,0,0,0.02))`
                          }}
                        >
                          <Text
                            className={styles.timelineEndingBadge}
                            style={{
                              background: getEndingTypeColor(selectedEnding.type).bg,
                              color: getEndingTypeColor(selectedEnding.type).text,
                              border: `1rpx solid ${getEndingTypeColor(selectedEnding.type).border}`
                            }}
                          >
                            {ENDING_TYPE_LABELS[selectedEnding.type]}
                          </Text>
                          <Text className={styles.timelineEndingTitle}>
                            {selectedEnding.title}
                          </Text>
                          <Text className={styles.timelineEndingDesc}>
                            {selectedEnding.description}
                          </Text>
                        </View>
                      </View>
                    </View>
                  )}

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
