import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Button, Input, Textarea } from '@tarojs/components';
import classnames from 'classnames';
import Taro from '@tarojs/taro';
import styles from './index.module.scss';
import { useGameStore } from '@/store/gameStore';
import EndingCard from '@/components/EndingCard';
import TagChip from '@/components/TagChip';
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

interface EndingFormState {
  title: string;
  type: EndingType;
  description: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  conditions: string[];
  conditionInput: string;
  cost: string;
  costUnclear: boolean;
  triggerHint: string;
  similarityGroup: string;
  unlocked: boolean;
  relatedInspirationIds: string[];
}

const emptyForm: EndingFormState = {
  title: '',
  type: 'bad',
  description: '',
  difficulty: 3,
  conditions: [],
  conditionInput: '',
  cost: '',
  costUnclear: true,
  triggerHint: '',
  similarityGroup: '',
  unlocked: false,
  relatedInspirationIds: []
};

const EndingsPage: React.FC = () => {
  const {
    endings,
    inspirations,
    addEnding,
    updateEnding,
    toggleEndingUnlocked,
    getSimilarEndings,
    getCostUnclearEndings
  } = useGameStore();

  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [sortType, setSortType] = useState<SortType>('asc');
  const [selectedEnding, setSelectedEnding] = useState<Ending | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EndingFormState>({ ...emptyForm });
  const [showCostEditor, setShowCostEditor] = useState(false);
  const [costEditorValue, setCostEditorValue] = useState('');

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
    setTimeout(() => {
      useGameStore.getState().selectEnding(endingId);
    }, 300);
  };

  const openCreateEnding = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setShowEditor(true);
  };

  const openEditEnding = (ending: Ending) => {
    setEditingId(ending.id);
    setForm({
      title: ending.title,
      type: ending.type,
      description: ending.description,
      difficulty: ending.difficulty,
      conditions: [...ending.conditions],
      conditionInput: '',
      cost: ending.cost || '',
      costUnclear: ending.costUnclear,
      triggerHint: ending.triggerHint,
      similarityGroup: ending.similarityGroup || '',
      unlocked: ending.unlocked,
      relatedInspirationIds: [...ending.relatedInspirationIds]
    });
    setSelectedEnding(null);
    setShowEditor(true);
  };

  const openCostQuickEdit = (ending: Ending) => {
    setSelectedEnding(ending);
    setCostEditorValue(ending.cost || '');
    setShowCostEditor(true);
  };

  const handleCostSave = () => {
    if (!selectedEnding) return;
    if (!costEditorValue.trim()) {
      Taro.showToast({ title: '请填写结局代价', icon: 'none' });
      return;
    }
    updateEnding(selectedEnding.id, {
      cost: costEditorValue.trim(),
      costUnclear: false
    });
    Taro.showToast({ title: '代价已补充 ✅', icon: 'none' });
    setShowCostEditor(false);
    setSelectedEnding((prev) =>
      prev ? { ...prev, cost: costEditorValue.trim(), costUnclear: false } : prev
    );
  };

  const closeEditor = () => {
    setShowEditor(false);
    setEditingId(null);
  };

  const updateForm = <K extends keyof EndingFormState>(key: K, value: EndingFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const addCondition = () => {
    const text = form.conditionInput.trim();
    if (!text) return;
    updateForm('conditions', [...form.conditions, text]);
    updateForm('conditionInput', '');
  };

  const removeCondition = (idx: number) => {
    updateForm(
      'conditions',
      form.conditions.filter((_, i) => i !== idx)
    );
  };

  const toggleInspirationLink = (insId: string) => {
    if (form.relatedInspirationIds.includes(insId)) {
      updateForm(
        'relatedInspirationIds',
        form.relatedInspirationIds.filter((id) => id !== insId)
      );
    } else {
      updateForm('relatedInspirationIds', [...form.relatedInspirationIds, insId]);
    }
  };

  const handleSaveEnding = () => {
    if (!form.title.trim()) {
      Taro.showToast({ title: '请填写结局标题', icon: 'none' });
      return;
    }
    if (form.conditions.length === 0) {
      Taro.showToast({ title: '至少添加一个达成条件', icon: 'none' });
      return;
    }
    const hasClearCost = !!form.cost.trim() || !form.costUnclear;

    const payload = {
      title: form.title.trim(),
      type: form.type,
      description: form.description.trim(),
      difficulty: form.difficulty,
      conditions: form.conditions,
      cost: form.cost.trim() || undefined,
      triggerHint: form.triggerHint.trim() || '待补充',
      relatedInspirationIds: form.relatedInspirationIds,
      similarityGroup: form.similarityGroup.trim() || undefined,
      costUnclear: form.costUnclear && !form.cost.trim(),
      unlocked: form.unlocked
    };

    if (editingId) {
      updateEnding(editingId, payload);
      Taro.showToast({ title: '结局已更新', icon: 'success' });
    } else {
      addEnding(payload);
      Taro.showToast({ title: '新结局已收录 🎴', icon: 'none' });
    }
    setShowEditor(false);
    setEditingId(null);
    console.log('[EndingsPage] 保存结局:', form.title);
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

  return (
    <View className={styles.container}>
      <View className={styles.pageHeader}>
        <View style={{ flex: 1 }}>
          <Text className={styles.pageTitle}>
            <Text className={styles.pageTitleAccent}>结局</Text>卡册
          </Text>
          <Text className={styles.pageSubtitle}>
            🃏 把所有结局整理成册，注意相似的触发条件和模糊的代价
          </Text>
        </View>
        <View className={styles.fabMini} onClick={openCreateEnding}>
          <Text className={styles.fabMiniIcon}>+</Text>
        </View>
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
                    <Text
                      className={styles.alertAction}
                      onClick={() => handleCardClick(g.endings[0])}
                    >
                      去区分 →
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
                    onClick={() => openCostQuickEdit(e)}
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
                    <Text className={styles.alertAction}>✏️ 去补充</Text>
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
          <View style={{ marginTop: 80 }}>
            <EmptyState
              icon="🎴"
              title="该分类暂无结局"
              description="点击右上角 + 按钮，添加你的第一个结局"
              actionLabel="✨ 添加结局"
              onAction={openCreateEnding}
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
      {selectedEnding && !showEditor && !showCostEditor && (
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
                <View className={styles.modalSectionHeader}>
                  <Text className={styles.modalSectionTitle}>⚖️ 结局代价</Text>
                  {selectedEnding.costUnclear && (
                    <Text
                      className={styles.fixBtn}
                      onClick={() => openCostQuickEdit(selectedEnding)}
                    >
                      ✏️ 补充代价
                    </Text>
                  )}
                </View>
                {selectedEnding.costUnclear ? (
                  <View
                    className={styles.costUnclearBox}
                    onClick={() => openCostQuickEdit(selectedEnding)}
                  >
                    <Text className={styles.costUnclearIcon}>⚠️</Text>
                    <Text className={styles.costUnclearText}>
                      这个结局的代价还没想清楚。点击这里补充 → 玩家付出了什么？失去了什么？
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
                    <Text
                      className={styles.editInlineBtn}
                      onClick={() => openCostQuickEdit(selectedEnding)}
                    >
                      重新编辑
                    </Text>
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

                <Button
                  className={styles.editEndingBtn}
                  onClick={() => openEditEnding(selectedEnding)}
                >
                  ✏️ 编辑此结局
                </Button>
              </View>

              <Button
                className={styles.primaryCtaBtn}
                onClick={() => handleGotoCausality(selectedEnding.id)}
              >
                🔍 去因果检查页检查这个结局
              </Button>
            </View>
          </ScrollView>
        </View>
      )}

      {/* 代价快速补充弹窗 */}
      {showCostEditor && selectedEnding && (
        <View className={styles.modalMask} onClick={() => setShowCostEditor(false)}>
          <View
            className={styles.costEditorContent}
            onClick={(e) => e.stopPropagation()}
          >
            <View className={styles.modalDragBar} />
            <View className={styles.modalHeader}>
              <Text className={styles.costEditorTitle}>✏️ 补充结局代价</Text>
              <View
                className={styles.modalClose}
                onClick={() => setShowCostEditor(false)}
              >
                <Text className={styles.modalCloseText}>×</Text>
              </View>
            </View>
            <Text className={styles.costEditorSubtitle}>
              为【{selectedEnding.title}】补充代价，让结局更有重量感
            </Text>
            <View className={styles.costEditorHint}>
              <Text>💡 想想：玩家失去了什么？同伴、记忆、生命、还是某种无法回头的选择？</Text>
            </View>
            <Textarea
              className={styles.costEditorTextarea}
              placeholder="例如：玩家失去了左眼，但获得了能看见灵体的能力..."
              value={costEditorValue}
              onInput={(e) => setCostEditorValue(e.detail.value)}
              maxlength={300}
              autoHeight
            />
            <View className={styles.costEditorActions}>
              <Button
                className={styles.secondaryBtn}
                onClick={() => setShowCostEditor(false)}
              >
                取消
              </Button>
              <Button
                className={styles.primaryBtn}
                onClick={handleCostSave}
                disabled={!costEditorValue.trim()}
              >
                ✅ 补充完成
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* 结局编辑器弹窗 */}
      {showEditor && (
        <View className={styles.modalMask} onClick={closeEditor}>
          <ScrollView
            scrollY
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <View className={styles.modalDragBar} />
            <View className={styles.modalInner}>
              <View className={styles.modalHeader}>
                <Text className={styles.modalTitle}>
                  {editingId ? '✏️ 编辑结局' : '✨ 新增结局'}
                </Text>
                <View className={styles.modalClose} onClick={closeEditor}>
                  <Text className={styles.modalCloseText}>×</Text>
                </View>
              </View>

              <View className={styles.formSection}>
                <Text className={styles.formLabel}>结局标题</Text>
                <Input
                  className={styles.formInput}
                  placeholder="如：蒙在布中的眼"
                  value={form.title}
                  onInput={(e) => updateForm('title', e.detail.value)}
                  maxlength={20}
                />
              </View>

              <View className={styles.formSection}>
                <Text className={styles.formLabel}>结局类型</Text>
                <View className={styles.typeSelector}>
                  {(['bad', 'hidden', 'true'] as EndingType[]).map((t) => (
                    <TagChip
                      key={t}
                      label={ENDING_TYPE_LABELS[t]}
                      active={form.type === t}
                      color={t === 'bad' ? 'ghost' : t === 'hidden' ? 'trust' : 'custom'}
                      onClick={() => updateForm('type', t)}
                    />
                  ))}
                </View>
              </View>

              <View className={styles.formSection}>
                <Text className={styles.formLabel}>结局描述</Text>
                <Textarea
                  className={styles.formTextarea}
                  placeholder="详细描述这个结局发生了什么，玩家看到了什么..."
                  value={form.description}
                  onInput={(e) => updateForm('description', e.detail.value)}
                  maxlength={500}
                  autoHeight
                />
              </View>

              <View className={styles.formSection}>
                <Text className={styles.formLabel}>难度等级</Text>
                <View className={styles.levelSelector}>
                  {[1, 2, 3, 4, 5].map((lv) => (
                    <View
                      key={lv}
                      className={classnames(styles.levelOption, lv === form.difficulty && styles.active)}
                      style={
                        lv === form.difficulty
                          ? { background: getEndingTypeColor(form.type).bg, borderColor: getEndingTypeColor(form.type).border }
                          : {}
                      }
                      onClick={() => updateForm('difficulty', lv as 1 | 2 | 3 | 4 | 5)}
                    >
                      <Text
                        className={styles.levelOptionText}
                        style={lv === form.difficulty ? { color: getEndingTypeColor(form.type).text } : {}}
                      >
                        {getDifficultyLabel(lv)}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              <View className={styles.formSection}>
                <Text className={styles.formLabel}>达成条件</Text>
                <View className={styles.conditionInputRow}>
                  <Input
                    className={styles.conditionInput}
                    placeholder="例如：玩家选择了..."
                    value={form.conditionInput}
                    onInput={(e) => updateForm('conditionInput', e.detail.value)}
                    onConfirm={addCondition}
                    maxlength={60}
                  />
                  <View className={styles.addConditionBtn} onClick={addCondition}>
                    <Text className={styles.addConditionText}>+ 添加</Text>
                  </View>
                </View>
                {form.conditions.length > 0 && (
                  <View className={styles.conditionChips}>
                    {form.conditions.map((cond, i) => (
                      <View key={i} className={styles.conditionChip}>
                        <Text className={styles.conditionChipText}>▸ {cond}</Text>
                        <Text
                          className={styles.conditionChipRemove}
                          onClick={() => removeCondition(i)}
                        >
                          ×
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              <View className={styles.formSection}>
                <View className={styles.sectionHeaderRow}>
                  <Text className={styles.formLabel}>⚖️ 结局代价</Text>
                  <View className={styles.costUnclearSwitch}>
                    <Text className={styles.switchLabel}>代价尚不明确</Text>
                    <View
                      className={classnames(styles.switchBox, form.costUnclear && styles.switchOn)}
                      onClick={() => updateForm('costUnclear', !form.costUnclear)}
                    >
                      <View className={styles.switchDot} />
                    </View>
                  </View>
                </View>
                {!form.costUnclear && (
                  <Textarea
                    className={styles.formTextarea}
                    placeholder="玩家将付出什么代价？生命？记忆？还是..."
                    value={form.cost}
                    onInput={(e) => updateForm('cost', e.detail.value)}
                    maxlength={300}
                    autoHeight
                  />
                )}
                {form.costUnclear && (
                  <Text className={styles.formHint}>
                    💡 标记为"代价不明确"后，结局卡册会提醒你补充
                  </Text>
                )}
              </View>

              <View className={styles.formSection}>
                <Text className={styles.formLabel}>🔑 触发提示</Text>
                <Input
                  className={styles.formInput}
                  placeholder="一句话提示玩家如何触发这个结局"
                  value={form.triggerHint}
                  onInput={(e) => updateForm('triggerHint', e.detail.value)}
                  maxlength={80}
                />
              </View>

              <View className={styles.formSection}>
                <Text className={styles.formLabel}>🔗 关联灵感节点</Text>
                {inspirations.length === 0 ? (
                  <Text className={styles.formHint}>暂无灵感，先去「灵感速记」记录吧</Text>
                ) : (
                  <View className={styles.endingCheckList}>
                    {inspirations.slice(0, 10).map((ins) => {
                      const checked = form.relatedInspirationIds.includes(ins.id);
                      return (
                        <View
                          key={ins.id}
                          className={classnames(styles.endingCheckItem, checked && styles.endingCheckItemActive)}
                          onClick={() => toggleInspirationLink(ins.id)}
                        >
                          <View className={styles.smallCheckbox}>
                            {checked && <Text className={styles.smallCheckboxTick}>✓</Text>}
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text className={styles.endingCheckTitle}>{ins.title}</Text>
                            <Text className={styles.endingCheckHint} numberOfLines={1}>
                              {ins.description}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>

              <View className={styles.formSection}>
                <Text className={styles.formLabel}>相似分组（可选）</Text>
                <Input
                  className={styles.formInput}
                  placeholder="如：escape_with_ghost，相同组的结局会触发相似性提醒"
                  value={form.similarityGroup}
                  onInput={(e) => updateForm('similarityGroup', e.detail.value)}
                  maxlength={30}
                />
              </View>

              <View className={styles.formSection}>
                <View className={styles.sectionHeaderRow}>
                  <Text className={styles.formLabel}>🔓 是否解锁</Text>
                  <View className={styles.costUnclearSwitch}>
                    <Text className={styles.switchLabel}>{form.unlocked ? '已解锁' : '未解锁'}</Text>
                    <View
                      className={classnames(styles.switchBox, form.unlocked && styles.switchOn)}
                      onClick={() => updateForm('unlocked', !form.unlocked)}
                    >
                      <View className={styles.switchDot} />
                    </View>
                  </View>
                </View>
              </View>

              <View className={styles.footerActions}>
                <Button className={styles.cancelBtn} onClick={closeEditor}>
                  取消
                </Button>
                <Button
                  className={styles.saveBtn}
                  onClick={handleSaveEnding}
                  disabled={!form.title.trim() || form.conditions.length === 0}
                >
                  {editingId ? '保存修改' : '🎴 收录结局'}
                </Button>
              </View>
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
};

export default EndingsPage;
