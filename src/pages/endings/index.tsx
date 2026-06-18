import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Button } from '@tarojs/components';
import classnames from 'classnames';
import Taro from '@tarojs/taro';
import styles from './index.module.scss';
import { useGameStore } from '@/store/gameStore';
import EndingCard from '@/components/EndingCard';
import EmptyState from '@/components/EmptyState';
import type { Ending, EndingType } from '@/types';
import { ENDING_TYPE_LABELS } from '@/types';
import { getEndingTypeColor, getDifficultyLabel } from '@/utils/aiPrompt';

type TabType = 'all' | EndingType;
type SortType = 'asc' | 'desc';

interface SimilarGroup {
  groupId: string;
  endings: Ending[];
}

const EndingsPage: React.FC = () => {
  const { endings, toggleEndingUnlocked, getSimilarEndings, getCostUnclearEndings, inspirations } = useGameStore();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [sortType, setSortType] = useState<SortType>('asc');
  const [selectedEnding, setSelectedEnding] = useState<Ending | null>(null);

  const tabCounts = useMemo(() => ({
    all: endings.length,
    bad: endings.filter((e) => e.type === 'bad').length,
    hidden: endings.filter((e) => e.type === 'hidden').length,
    true: endings.filter((e) => e.type === 'true').length
  }), [endings]);

  const similarGroups = useMemo<SimilarGroup[]>(() => {
    const groups: Record<string, Ending[]> = {};
    endings.forEach((e) => {
      if (e.similarityGroup) {
        if (!groups[e.similarityGroup]) groups[e.similarityGroup] = [];
        groups[e.similarityGroup].push(e);
      }
    });
    return Object.entries(groups)
      .filter(([_, list]) => list.length >= 2)
      .map(([groupId, endingList]) => ({ groupId, endings: endingList }));
  }, [endings]);

  const costUnclearEndings = useMemo(() => getCostUnclearEndings(), [getCostUnclearEndings]);

  const filteredEndings = useMemo(() => {
    let list = [...endings];
    if (activeTab !== 'all') {
      list = list.filter((e) => e.type === activeTab);
    }
    list.sort((a, b) => sortType === 'asc' ? a.difficulty - b.difficulty : b.difficulty - a.difficulty);
    return list;
  }, [endings, activeTab, sortType]);

  const groupedByType = useMemo(() => {
    if (activeTab !== 'all') return null;
    const order: EndingType[] = ['bad', 'hidden', 'true'];
    return order.map((type) => ({
      type,
      list: filteredEndings.filter((e) => e.type === type)
    }));
  }, [filteredEndings, activeTab]);

  const handleCardClick = (ending: Ending) => {
    setSelectedEnding(ending);
    console.log('[EndingsPage] 查看结局详情:', ending.title);
  };

  const closeModal = () => {
    setSelectedEnding(null);
  };

  const handleToggleUnlock = (id: string) => {
    toggleEndingUnlocked(id);
    Taro.showToast({ title: '已更新解锁状态', icon: 'none' });
    setSelectedEnding((prev) => prev ? { ...prev, unlocked: !prev.unlocked } : prev);
  };

  const handleGotoCausality = (endingId: string) => {
    closeModal();
    Taro.switchTab({ url: '/pages/causality/index' });
    // 延迟后选中该结局（通过store已共享状态）
    setTimeout(() => {
      useGameStore.getState().selectEnding(endingId);
    }, 300);
  };

  const getTabBg = (tab: TabType) => {
    const map: Record<TabType, string> = {
      all: 'linear-gradient(135deg, #9B59B6, #6C3483)',
      bad: 'linear-gradient(135deg, #EC7063, #C0392B)',
      hidden: 'linear-gradient(135deg, #58D68D, #27AE60)',
      true: 'linear-gradient(135deg, #F4D03F, #D4AC0D)'
    };
    return { background: map[tab] };
  };

  const getTabTextClass = (tab: TabType) => {
    const map: Record<TabType, string> = {
      all: 'var(--tab-all, #9B59B6)',
      bad: 'var(--tab-bad, #EC7063)',
      hidden: 'var(--tab-hidden, #58D68D)',
      true: 'var(--tab-true, #F4D03F)'
    };
    return map[tab];
  };

  return (
    <View className={styles.container}>
      <View className={styles.pageHeader}>
        <Text className={styles.pageTitle}>
          <Text className={styles.pageTitleAccent}>结局</Text>卡册
        </Text>
        <Text className={styles.pageSubtitle}>
          🃏 把所有结局整理成册，注意相似的触发条件和模糊的代价
        </Text>
      </View>

      {/* Tab 切换 */}
      <View className={styles.tabBar}>
        {([
          { key: 'all' as const, label: '全部' },
          { key: 'bad' as const, label: '坏结局' },
          { key: 'hidden' as const, label: '隐藏结局' },
          { key: 'true' as const, label: '真结局' }
        ]).map((tab) => (
          <View
            key={tab.key}
            className={classnames(styles.tabItem, activeTab === tab.key && styles.active)}
            style={activeTab === tab.key ? getTabBg(tab.key) : {}}
            onClick={() => setActiveTab(tab.key)}
          >
            <Text className={styles.tabText}>
              {tab.label}
              <Text className={styles.tabCount}>{tabCounts[tab.key]}</Text>
            </Text>
          </View>
        ))}
      </View>

      {/* 智能提醒横幅 */}
      {activeTab === 'all' && (similarGroups.length > 0 || costUnclearEndings.length > 0) && (
        <>
          {similarGroups.length > 0 && (
            <View className={classnames(styles.alertBanner, 'warning')}>
              <View className={styles.alertHeader}>
                <Text className={styles.alertIcon}>⚠️</Text>
                <Text className={styles.alertTitle}>
                  {similarGroups.length} 组结局条件相似
                </Text>
              </View>
              <View className={styles.alertList}>
                {similarGroups.map((g) => (
                  <View key={g.groupId} className={styles.alertItem}>
                    <Text
                      className={styles.alertBadge}
                      style={{
                        background: 'rgba(243, 156, 18, 0.2)',
                        color: '#F5B041'
                      }}
                    >
                      相似组
                    </Text>
                    <Text className={styles.alertItemText}>
                      {g.endings.map((e) => `【${e.title}】`).join(' 与 ')}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {costUnclearEndings.length > 0 && (
            <View className={classnames(styles.alertBanner, 'danger')}>
              <View className={styles.alertHeader}>
                <Text className={styles.alertIcon}>❓</Text>
                <Text className={styles.alertTitle}>
                  {costUnclearEndings.length} 个结局代价尚不明确
                </Text>
              </View>
              <View className={styles.alertList}>
                {costUnclearEndings.slice(0, 3).map((e) => (
                  <View
                    key={e.id}
                    className={styles.alertItem}
                    onClick={() => handleCardClick(e)}
                  >
                    <Text
                      className={styles.alertBadge}
                      style={{
                        background: getEndingTypeColor(e.type).bg,
                        color: getEndingTypeColor(e.type).text
                      }}
                    >
                      {ENDING_TYPE_LABELS[e.type]}
                    </Text>
                    <Text className={styles.alertItemText}>【{e.title}】代价是什么？</Text>
                    <Text className={styles.alertAction}>去补充 →</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </>
      )}

      {/* 排序栏 */}
      <View className={styles.sortBar}>
        <Text className={styles.sortLabel}>
          共 {filteredEndings.length} 个结局
        </Text>
        <View className={styles.sortOptions}>
          <View
            className={classnames(styles.sortOption, sortType === 'asc' && styles.active)}
            onClick={() => setSortType('asc')}
          >
            <Text className={styles.sortOptionText}>难度 ↑</Text>
          </View>
          <View
            className={classnames(styles.sortOption, sortType === 'desc' && styles.active)}
            onClick={() => setSortType('desc')}
          >
            <Text className={styles.sortOptionText}>难度 ↓</Text>
          </View>
        </View>
      </View>

      {/* 结局列表 */}
      <View className={styles.endingsList}>
        {filteredEndings.length === 0 ? (
          <View style={{ marginTop: 120 }}>
            <EmptyState
              icon="🎴"
              title="该分类暂无结局"
              description="恐怖故事的结局，可以是绝望、意外、也可以是一丝温暖的救赎"
            />
          </View>
        ) : activeTab === 'all' && groupedByType ? (
          groupedByType.map((group) => (
            group.list.length > 0 && (
              <View key={group.type}>
                <View className={classnames(styles.sectionHeader, group.type)}>
                  <Text className={styles.sectionTitle}>
                    {ENDING_TYPE_LABELS[group.type]}
                  </Text>
                  <Text className={styles.sectionCount}>{group.list.length} 个</Text>
                </View>
                {group.list.map((ending) => {
                  const similar = getSimilarEndings(ending.id);
                  const hasWarning = similar.length > 0 || ending.costUnclear;
                  return (
                    <EndingCard
                      key={ending.id}
                      data={ending}
                      showWarning={hasWarning}
                      warningType={ending.costUnclear ? 'cost' : 'similar'}
                      onClick={() => handleCardClick(ending)}
                    />
                  );
                })}
              </View>
            )
          ))
        ) : (
          filteredEndings.map((ending) => {
            const similar = getSimilarEndings(ending.id);
            const hasWarning = similar.length > 0 || ending.costUnclear;
            return (
              <EndingCard
                key={ending.id}
                data={ending}
                showWarning={hasWarning}
                warningType={ending.costUnclear ? 'cost' : 'similar'}
                onClick={() => handleCardClick(ending)}
              />
            );
          })
        )}
      </View>

      {/* 结局详情弹窗 */}
      {selectedEnding && (
        <View className={styles.modalMask} onClick={closeModal}>
          <ScrollView
            scrollY
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <View className={styles.modalDragBar} />
            <View className={styles.modalInner}>
              <View className={styles.modalHeader}>
                <View className={styles.modalBadges}>
                  <Text
                    className={styles.modalBadge}
                    style={{
                      background: getEndingTypeColor(selectedEnding.type).bg,
                      color: getEndingTypeColor(selectedEnding.type).text,
                      border: `1rpx solid ${getEndingTypeColor(selectedEnding.type).border}`
                    }}
                  >
                    {ENDING_TYPE_LABELS[selectedEnding.type]}
                  </Text>
                  <Text className={styles.diffBadge}>
                    难度·{getDifficultyLabel(selectedEnding.difficulty)}
                  </Text>
                </View>
                <View className={styles.modalClose} onClick={closeModal}>
                  <Text className={styles.modalCloseText}>×</Text>
                </View>
              </View>

              <Text className={styles.modalTitle}>{selectedEnding.title}</Text>

              <View
                className={styles.modalDescBox}
                style={{ borderLeftColor: getEndingTypeColor(selectedEnding.type).text }}
              >
                <Text className={styles.modalDesc}>{selectedEnding.description}</Text>
              </View>

              <View className={styles.modalSection}>
                <Text className={styles.modalSectionTitle}>📋 达成条件</Text>
                {selectedEnding.conditions.map((cond, i) => (
                  <View key={i} className={styles.conditionItemModal}>
                    <View className={styles.conditionCheck}>✓</View>
                    <Text className={styles.conditionTextModal}>{cond}</Text>
                  </View>
                ))}
              </View>

              <View className={styles.modalSection}>
                <Text className={styles.modalSectionTitle}>⚖️ 结局代价</Text>
                {selectedEnding.costUnclear ? (
                  <View className={styles.costUnclearBox}>
                    <Text className={styles.costUnclearIcon}>⚠️</Text>
                    <Text className={styles.costUnclearText}>
                      这个结局的代价还没想清楚。玩家付出了什么？失去了什么？代价的模糊会让结局缺乏重量哦。
                    </Text>
                  </View>
                ) : selectedEnding.cost ? (
                  <View
                    className={styles.costBoxModal}
                    style={{
                      background: 'rgba(155, 89, 182, 0.08)',
                      borderColor: 'rgba(155, 89, 182, 0.2)'
                    }}
                  >
                    <Text
                      className={styles.costLabelModal}
                      style={{ color: '#AF7AC5' }}
                    >
                      玩家将付出
                    </Text>
                    <Text className={styles.costTextModal}>{selectedEnding.cost}</Text>
                  </View>
                ) : null}
              </View>

              <View className={styles.modalSection}>
                <Text className={styles.modalSectionTitle}>🔑 触发提示</Text>
                <View
                  className={styles.costBoxModal}
                  style={{
                    background: 'rgba(52, 152, 219, 0.08)',
                    borderColor: 'rgba(52, 152, 219, 0.2)'
                  }}
                >
                  <Text
                    className={styles.costLabelModal}
                    style={{ color: '#5DADE2' }}
                  >
                    设计提示
                  </Text>
                  <Text className={styles.costTextModal}>{selectedEnding.triggerHint}</Text>
                </View>
              </View>

              <View className={styles.modalSection}>
                <Text className={styles.modalSectionTitle}>📊 数据概览</Text>
                <View className={styles.statsRowModal}>
                  <View className={styles.statItemModal}>
                    <Text
                      className={styles.statNumModal}
                      style={{ color: getEndingTypeColor(selectedEnding.type).text }}
                    >
                      {selectedEnding.conditions.length}
                    </Text>
                    <Text className={styles.statLabelModal}>条件数</Text>
                  </View>
                  <View className={styles.statItemModal}>
                    <Text
                      className={styles.statNumModal}
                      style={{ color: '#9B59B6' }}
                    >
                      {selectedEnding.relatedInspirationIds.length}
                    </Text>
                    <Text className={styles.statLabelModal}>关联灵感</Text>
                  </View>
                  <View className={styles.statItemModal}>
                    <Text
                      className={styles.statNumModal}
                      style={{ color: '#F4D03F' }}
                    >
                      {selectedEnding.difficulty}
                    </Text>
                    <Text className={styles.statLabelModal}>难度等级</Text>
                  </View>
                </View>

                <Button
                  className={classnames(styles.toggleUnlockBtn, selectedEnding.unlocked && styles.unlockedToggle)}
                  onClick={() => handleToggleUnlock(selectedEnding.id)}
                >
                  {selectedEnding.unlocked ? '🔓 标记为已解锁' : '🔒 标记为未解锁'}
                </Button>
              </View>

              <Button
                className={styles.toggleUnlockBtn}
                style={{
                  background: 'linear-gradient(135deg, #9B59B6, #6C3483)',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 600,
                  marginTop: 24
                }}
                onClick={() => handleGotoCausality(selectedEnding.id)}
              >
                🔍 去因果检查页检查这个结局
              </Button>
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
};

export default EndingsPage;
