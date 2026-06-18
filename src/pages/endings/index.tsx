import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, Button, Input, Textarea } from '@tarojs/components';
import classnames from 'classnames';
import Taro from '@tarojs/taro';
import styles from './index.module.scss';
import { useGameStore } from '@/store/gameStore';
import EndingCard from '@/components/EndingCard';
import TagChip from '@/components/TagChip';
import EmptyState from '@/components/EmptyState';
import type { Ending, EndingType, Inspiration } from '@/types';
import { ENDING_TYPE_LABELS } from '@/types';
import { getEndingTypeColor, getDifficultyLabel } from '@/utils/aiPrompt';

type TabType = 'all' | EndingType;
type SortType = 'asc' | 'desc';
type EndingsViewMode = 'list' | 'graph';

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

interface GraphRow {
  inspiration: Inspiration & { endingEdges: { endingId: string; type: EndingType }[] };
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
    getCostUnclearEndings,
    getGraphData,
    selectEnding,
    selectInspirationForCausality,
    setPendingInspirationEditId,
    getHighlightedPath
  } = useGameStore();

  const [viewMode, setViewMode] = useState<EndingsViewMode>('list');
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [sortType, setSortType] = useState<SortType>('asc');
  const [selectedEnding, setSelectedEnding] = useState<Ending | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EndingFormState>({ ...emptyForm });
  const [showCostEditor, setShowCostEditor] = useState(false);
  const [costEditorValue, setCostEditorValue] = useState('');
  const [planningTargetEndingId, setPlanningTargetEndingId] = useState<string | null>(null);

  const trueEndings = useMemo(() => endings.filter((e) => e.type === 'true'), [endings]);

  const tabCounts = useMemo(() => ({
    all: endings.length,
    bad: endings.filter((e) => e.type === 'bad').length,
    hidden: endings.filter((e) => e.type === 'hidden').length,
    true: endings.filter((e) => e.type === 'true').length
  }), [endings]);

  const graphData = useMemo(() => getGraphData(), [getGraphData]);

  const highlightData = useMemo(() => {
    if (!planningTargetEndingId) return null;
    return getHighlightedPath(planningTargetEndingId);
  }, [planningTargetEndingId, getHighlightedPath]);

  const planningTargetEnding = useMemo(() => {
    if (!planningTargetEndingId) return null;
    return endings.find((e) => e.id === planningTargetEndingId) || null;
  }, [planningTargetEndingId, endings]);

  const graphRows = useMemo<GraphRow[]>(() => {
    let rows: GraphRow[] = graphData.inspirations
      .filter((ins) => ins.endingEdges.length > 0)
      .map((ins) => ({ inspiration: ins }));

    // 路线规划模式：只显示相关的灵感 + 全部显示但高亮
    if (highlightData) {
      rows = rows.filter((row) => {
        const insId = row.inspiration.id;
        // 显示所有高亮的灵感 + 有坏结局岔路的灵感
        return highlightData.highlightedInspirationIds.includes(insId) ||
          row.inspiration.endingEdges.some((e) => highlightData.allConnectedEndingIds.includes(e.endingId));
      });
    }
    return rows;
  }, [graphData, highlightData]);

  const orphanInspirations = useMemo(() => {
    return graphData.inspirations.filter((i) => i.endingEdges.length === 0);
  }, [graphData]);

  const orphanEndings = useMemo(() => {
    return graphData.endings.filter((e) => e.relatedInspirationIds.length === 0);
  }, [graphData]);

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
  };

  const handleInspirationCardClick = (insId: string) => {
    const ins = inspirations.find((i) => i.id === insId);
    if (!ins) return;

    Taro.showActionSheet({
      itemList: [
        '✏️ 编辑此灵感',
        '🔍 带着去因果检查',
        `🎯 ${planningTargetEndingId ? '取消路线规划' : '设为路线规划目标'}`
      ],
      success: (res) => {
        if (res.tapIndex === 0) {
          // 编辑此灵感
          setPendingInspirationEditId(insId);
          Taro.switchTab({ url: '/pages/inspiration/index' });
        } else if (res.tapIndex === 1) {
          // 带着去因果检查
          if (ins.relatedEndingIds.length === 0) {
            Taro.showToast({ title: '该灵感还未关联任何结局', icon: 'none' });
            return;
          }
          if (ins.relatedEndingIds.length === 1) {
            // 只有一个结局，直接跳
            selectEnding(ins.relatedEndingIds[0]);
            selectInspirationForCausality(insId);
            Taro.switchTab({ url: '/pages/causality/index' });
          } else {
            // 多个结局，让用户选
            const endingOptions = ins.relatedEndingIds.map((eid) => {
              const e = endings.find((x) => x.id === eid);
              const typeLabel = ENDING_TYPE_LABELS[e?.type || 'bad'];
              return `【${typeLabel}】${e?.title || '未知结局'}`;
            });
            Taro.showActionSheet({
              itemList: endingOptions,
              success: (r2) => {
                const selectedEndingId = ins.relatedEndingIds[r2.tapIndex];
                selectEnding(selectedEndingId);
                selectInspirationForCausality(insId);
                Taro.switchTab({ url: '/pages/causality/index' });
              }
            });
          }
        } else if (res.tapIndex === 2) {
          if (planningTargetEndingId) {
            setPlanningTargetEndingId(null);
            Taro.showToast({ title: '已退出路线规划模式', icon: 'none' });
          }
        }
      }
    });
  };

  const handlePlanningTargetSelect = (endingId: string) => {
    if (planningTargetEndingId === endingId) {
      setPlanningTargetEndingId(null);
    } else {
      setPlanningTargetEndingId(endingId);
      Taro.showToast({
        title: '路线规划：高亮所有通向此结局的节点',
        icon: 'none',
        duration: 1800
      });
    }
  };

  const handleEndingNodeClick = (endingId: string) => {
    const ending = endings.find((e) => e.id === endingId);
    if (!ending) return;

    // 如果是路线规划模式，先弹出 ActionSheet 提供更多选项
    if (planningTargetEndingId !== null) {
      const insLeading = inspirations.filter((i) => i.relatedEndingIds.includes(endingId));
      const options = [
        '🔍 带着去因果检查补链',
        '🎯 查看详情',
        planningTargetEndingId !== endingId && ending.type === 'true' ? '⭐ 切换为规划目标' : null
      ].filter(Boolean) as string[];

      Taro.showActionSheet({
        itemList: options,
        success: (res) => {
          if (res.tapIndex === 0) {
            // 带着去因果检查
            if (insLeading.length > 0) {
              // 有相关灵感，让用户选
              const insOptions = insLeading.slice(0, 5).map((i) => `带着灵感：${i.title.slice(0, 10)}${i.title.length > 10 ? '...' : ''}`);
              Taro.showActionSheet({
                itemList: [...insOptions, '不指定灵感，直接跳因果检查'],
                success: (r2) => {
                  if (r2.tapIndex < insOptions.length) {
                    handleGotoCausalityFromGraph(endingId, insLeading[r2.tapIndex].id);
                  } else {
                    handleGotoCausalityFromGraph(endingId);
                  }
                }
              });
            } else {
              handleGotoCausalityFromGraph(endingId);
            }
          } else if (res.tapIndex === 1) {
            setSelectedEnding(ending);
          } else if (res.tapIndex === 2 && ending.type === 'true' && planningTargetEndingId !== endingId) {
            handlePlanningTargetSelect(endingId);
          }
        }
      });
      return;
    }

    // 非规划模式，真结局可设为目标，其他看详情
    if (ending.type === 'true' && trueEndings.length > 1) {
      Taro.showActionSheet({
        itemList: ['🎯 设为路线规划目标', '🎴 查看详情'],
        success: (res) => {
          if (res.tapIndex === 0) {
            handlePlanningTargetSelect(endingId);
          } else {
            setSelectedEnding(ending);
          }
        }
      });
    } else {
      setSelectedEnding(ending);
    }
  };

  const handleGotoCausalityFromGraph = (endingId: string, inspirationId?: string) => {
    Taro.switchTab({ url: '/pages/causality/index' });
    setTimeout(() => {
      useGameStore.getState().selectEnding(endingId);
      if (inspirationId) {
        useGameStore.getState().selectInspirationForCausality(inspirationId);
      }
    }, 300);
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
    const result = updateEnding(selectedEnding.id, {
      cost: costEditorValue.trim(),
      costUnclear: false
    });
    if (!result.ok) {
      Taro.showToast({ title: result.reason || '保存失败', icon: 'none' });
      return;
    }
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

    let result: { ok: boolean; reason?: string };
    if (editingId) {
      result = updateEnding(editingId, payload);
    } else {
      result = addEnding(payload);
    }

    if (!result.ok) {
      Taro.showModal({
        title: '保存失败',
        content: result.reason || '请检查填写内容',
        showCancel: false,
        confirmText: '好的'
      });
      return;
    }

    Taro.showToast({
      title: editingId ? '结局已更新' : '新结局已收录 🎴',
      icon: editingId ? 'success' : 'none'
    });
    setShowEditor(false);
    setEditingId(null);
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

  const isInspirationHighlighted = (insId: string) => {
    return highlightData?.highlightedInspirationIds.includes(insId) ?? false;
  };

  const isInspirationBadDiversion = (insId: string) => {
    return highlightData?.badDiversionInspirationIds.includes(insId) ?? false;
  };

  const isEndingHighlighted = (endingId: string) => {
    return highlightData?.highlightedEndingIds.includes(endingId) ?? false;
  };

  const isEndingRequired = (endingId: string) => {
    return highlightData?.requiredEndingIds.includes(endingId) ?? false;
  };

  const isEndingBranch = (endingId: string) => {
    return highlightData?.branchEndingIds.includes(endingId) ?? false;
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

      {/* 视图模式切换 */}
      <View className={styles.viewModeTabs}>
        <View
          className={classnames(styles.viewModeTab, viewMode === 'list' && styles.active)}
          onClick={() => setViewMode('list')}
        >
          <Text className={styles.viewModeTabIcon}>🃏</Text>
          <Text className={styles.viewModeTabText}>卡册视图</Text>
        </View>
        <View
          className={classnames(styles.viewModeTab, viewMode === 'graph' && styles.active)}
          onClick={() => setViewMode('graph')}
        >
          <Text className={styles.viewModeTabIcon}>🗺️</Text>
          <Text className={styles.viewModeTabText}>路径视图</Text>
          {graphRows.length > 0 && (
            <View className={styles.viewModeTabBadgeBlue}>
              <Text className={styles.viewModeTabBadgeText}>{graphRows.length}</Text>
            </View>
          )}
        </View>
      </View>

      {/* =============== 卡册视图 =============== */}
      {viewMode === 'list' && (
        <>
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
        </>
      )}

      {/* =============== 路径视图 =============== */}
      {viewMode === 'graph' && (
        <View className={styles.graphArea}>
          <View className={styles.graphLegendBar}>
            <View className={styles.graphLegendCard}>
              <Text className={styles.graphLegendTitle}>🗺️ 灵感 → 结局 路径图</Text>
              <Text className={styles.graphLegendHint}>
                点击灵感节点：可编辑或带着去因果检查；点击真结局：开启路线规划模式
              </Text>
            </View>
            <View className={styles.graphLegendRow}>
              {(['bad', 'hidden', 'true'] as EndingType[]).map((t) => (
                <View key={t} className={styles.graphLegendItem}>
                  <View
                    className={styles.graphLegendDot}
                    style={{ background: getEndingTypeColor(t).text }}
                  />
                  <Text className={styles.graphLegendLabel}>
                    {ENDING_TYPE_LABELS[t]}
                  </Text>
                </View>
              ))}
              <View className={styles.graphLegendItem}>
                <View
                  className={styles.graphLegendDot}
                  style={{ background: 'linear-gradient(135deg, #F39C12, #E67E22)' }}
                />
                <Text className={styles.graphLegendLabel}>路线规划目标</Text>
              </View>
              <View className={styles.graphLegendItem}>
                <View
                  className={styles.graphLegendDot}
                  style={{ background: '#E74C3C' }}
                />
                <Text className={styles.graphLegendLabel}>坏结局岔路</Text>
              </View>
            </View>
          </View>

          {/* 路线规划控制区 */}
          {trueEndings.length > 0 && (
            <View className={styles.planningBar}>
              <Text className={styles.planningBarLabel}>🎯 路线规划：选择真结局作为目标</Text>
              <ScrollView scrollX className={styles.planningTargetList} enhanced showScrollbar={false}>
                {trueEndings.map((te) => (
                  <View
                    key={te.id}
                    className={classnames(
                      styles.planningTargetChip,
                      planningTargetEndingId === te.id && 'active'
                    )}
                    style={
                      planningTargetEndingId === te.id
                        ? { borderColor: '#F1C40F', background: 'rgba(241, 196, 15, 0.15)' }
                        : {}
                    }
                    onClick={() => handlePlanningTargetSelect(te.id)}
                  >
                    <Text
                      className={styles.planningTargetText}
                      style={planningTargetEndingId === te.id ? { color: '#F1C40F' } : {}}
                    >
                      {planningTargetEndingId === te.id ? '🎯 ' : ''}{te.title}
                    </Text>
                  </View>
                ))}
                {planningTargetEndingId && (
                  <View
                    className={styles.planningTargetChip}
                    onClick={() => setPlanningTargetEndingId(null)}
                  >
                    <Text className={styles.planningTargetText}>✕ 退出规划</Text>
                  </View>
                )}
              </ScrollView>

              {planningTargetEnding && highlightData && (
                <View className={styles.planningSummaryBar}>
                  <Text className={styles.planningSummaryText}>
                    <Text style={{ color: '#F1C40F', fontWeight: 'bold' }}>路线分析：</Text>
                    通向【{planningTargetEnding.title}】共 {highlightData.highlightedInspirationIds.length} 个灵感节点 · 
                    必经前置 {highlightData.requiredEndingIds.length} 个 · 旁支 {highlightData.branchEndingIds.length} 个 · 
                    其中 {highlightData.badDiversionInspirationIds.length} 个节点会岔向坏结局。
                  </Text>
                </View>
              )}
            </View>
          )}

          {graphRows.length === 0 ? (
            <View className={styles.graphEmptyWrap}>
              <EmptyState
                icon="🕸️"
                title={highlightData ? '该路线尚无因果路径' : '还没有串起因果路径'}
                description={
                  highlightData
                    ? '这个真结局还没有关联的灵感节点，去灵感速记里为灵感绑定通向它的结局吧'
                    : '先去「灵感速记」为每个灵感勾选通向的结局，再来这里查看完整的因果路径图'
                }
              />
            </View>
          ) : (
            <>
              {graphRows.map((row) => {
                const insId = row.inspiration.id;
                const highlighted = isInspirationHighlighted(insId);
                const badDiversion = isInspirationBadDiversion(insId);
                return (
                  <View key={row.inspiration.id} className={styles.graphRowCard}>
                    <View
                      className={classnames(
                        styles.graphInspirationNode,
                        highlighted && 'highlighted',
                        badDiversion && 'badDiversion'
                      )}
                      style={
                        highlighted
                          ? {
                              background: 'linear-gradient(135deg, rgba(46, 204, 113, 0.25), rgba(39, 174, 96, 0.08))',
                              borderColor: '#2ECC71',
                              boxShadow: '0 0 0 2rpx rgba(46, 204, 113, 0.25)'
                            }
                          : badDiversion
                            ? {
                                background: 'linear-gradient(135deg, rgba(231, 76, 60, 0.2), rgba(192, 57, 43, 0.06))',
                                borderColor: '#E74C3C'
                              }
                            : {}
                      }
                      onClick={() => handleInspirationCardClick(insId)}
                    >
                      <Text
                        className={styles.graphInspirationDot}
                        style={{
                          color: badDiversion ? '#E74C3C' : highlighted ? '#2ECC71' : '#9B59B6'
                        }}
                      >
                        ●
                      </Text>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text className={styles.graphInspirationTitle}>
                          {badDiversion && <Text style={{ color: '#E74C3C', marginRight: 8 }}>⚠️ </Text>}
                          {row.inspiration.title || '未命名灵感'}
                        </Text>
                        <Text className={styles.graphInspirationDesc} numberOfLines={2}>
                          {row.inspiration.description}
                        </Text>
                      </View>
                    </View>

                    <View className={styles.graphEdges}>
                      {row.inspiration.endingEdges.map((edge, idx) => {
                        const ending = endings.find((e) => e.id === edge.endingId);
                        if (!ending) return null;
                        const targetHighlighted = isEndingHighlighted(edge.endingId);
                        const isRequired = isEndingRequired(edge.endingId);
                        const isBranch = isEndingBranch(edge.endingId);
                        return (
                          <View key={edge.endingId}>
                            {idx < row.inspiration.endingEdges.length && (
                              <View className={styles.edgeConnector}>
                                <View
                                  className={styles.edgeLine}
                                  style={{
                                    background: isRequired
                                      ? 'linear-gradient(180deg, rgba(52, 152, 219, 0.8), rgba(52, 152, 219, 0.2))'
                                      : isBranch
                                      ? 'linear-gradient(180deg, rgba(46, 204, 113, 0.6), rgba(46, 204, 113, 0.15))'
                                      : targetHighlighted
                                      ? 'linear-gradient(180deg, rgba(46, 204, 113, 0.7), rgba(46, 204, 113, 0.15))'
                                      : undefined
                                  }}
                                />
                                <Text
                                  className={styles.edgeArrow}
                                  style={{
                                    color: isRequired ? '#3498DB' : isBranch ? '#2ECC71' : targetHighlighted ? '#2ECC71' : undefined
                                  }}
                                >
                                  ↳
                                </Text>
                              </View>
                            )}
                            <View
                              className={classnames(
                                styles.graphEndingNode,
                                `ending-${edge.type}`,
                                targetHighlighted && 'highlighted',
                                planningTargetEndingId === edge.endingId && 'target',
                                isRequired && 'required',
                                isBranch && 'branch'
                              )}
                              style={{
                                borderColor: planningTargetEndingId === edge.endingId
                                  ? '#F1C40F'
                                  : isRequired
                                  ? '#3498DB'
                                  : isBranch
                                  ? '#2ECC71'
                                  : getEndingTypeColor(edge.type).text,
                                background: planningTargetEndingId === edge.endingId
                                  ? 'rgba(241, 196, 15, 0.18)'
                                  : isRequired
                                  ? 'linear-gradient(135deg, rgba(52, 152, 219, 0.2), rgba(41, 128, 185, 0.08))'
                                  : isBranch
                                  ? 'linear-gradient(135deg, rgba(46, 204, 113, 0.15), rgba(39, 174, 96, 0.06))'
                                  : targetHighlighted
                                  ? 'linear-gradient(135deg, rgba(46, 204, 113, 0.18), rgba(39, 174, 96, 0.08))'
                                  : getEndingTypeColor(edge.type).bg,
                                boxShadow: planningTargetEndingId === edge.endingId
                                  ? '0 0 0 3rpx rgba(241, 196, 15, 0.35)'
                                  : isRequired
                                  ? '0 0 0 2rpx rgba(52, 152, 219, 0.25)'
                                  : isBranch
                                  ? '0 0 0 2rpx rgba(46, 204, 113, 0.2)'
                                  : targetHighlighted
                                  ? '0 0 0 2rpx rgba(46, 204, 113, 0.25)'
                                  : undefined
                              }}
                              onClick={() => handleEndingNodeClick(edge.endingId)}
                            >
                              <View className={styles.graphEndingMain}>
                                <View className={styles.graphEndingBadgeRow}>
                                  <Text
                                    className={styles.graphEndingBadge}
                                    style={{
                                      background: getEndingTypeColor(edge.type).bg,
                                      color: getEndingTypeColor(edge.type).text,
                                      border: `1rpx solid ${getEndingTypeColor(edge.type).border}`
                                    }}
                                  >
                                    {planningTargetEndingId === edge.endingId
                                      ? '🎯 '
                                      : isRequired
                                      ? '🔹 '
                                      : isBranch
                                      ? '🔸 '
                                      : ''}{ENDING_TYPE_LABELS[edge.type]}
                                  </Text>
                                  {isRequired && (
                                    <Text className={styles.graphEndingTagBlue}>必经前置</Text>
                                  )}
                                  {isBranch && (
                                    <Text className={styles.graphEndingTagGreen}>旁支</Text>
                                  )}
                                </View>
                                <Text className={styles.graphEndingTitle}>
                                  {ending.title}
                                </Text>
                              </View>
                              <View className={styles.graphEndingMeta}>
                                <Text className={styles.graphEndingDifficulty}>
                                  难度{getDifficultyLabel(ending.difficulty)}
                                </Text>
                                <View
                                  className={styles.graphEndingCausalityBtn}
                                  onClick={(e) => {
                                    e.stopPropagation?.();
                                    handleGotoCausalityFromGraph(edge.endingId, insId);
                                  }}
                                >
                                  <Text className={styles.graphEndingCausalityText}>🔍 因果检查</Text>
                                </View>
                              </View>
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                );
              })}
            </>
          )}

          {/* 未连通部分 */}
          {(orphanInspirations.length > 0 || orphanEndings.length > 0) && !highlightData && (
            <View className={styles.orphanSection}>
              <View className={styles.orphanHeader}>
                <Text className={styles.orphanHeaderTitle}>🔌 还没连起来的节点</Text>
                <Text className={styles.orphanHeaderHint}>
                  把下面这些连进因果链，整棵结局树会更完整
                </Text>
              </View>

              {orphanInspirations.length > 0 && (
                <View className={styles.orphanBlock}>
                  <Text className={styles.orphanBlockLabel}>
                    💡 未绑定结局的灵感（{orphanInspirations.length}）
                  </Text>
                  <View className={styles.orphanChipRow}>
                    {orphanInspirations.map((ins) => (
                      <View key={ins.id} className={styles.orphanChip}>
                        <Text className={styles.orphanChipText} numberOfLines={1}>
                          {ins.title || '未命名灵感'}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {orphanEndings.length > 0 && (
                <View className={styles.orphanBlock}>
                  <Text className={styles.orphanBlockLabel}>
                    🎴 未关联灵感的结局（{orphanEndings.length}）
                  </Text>
                  <View className={styles.orphanChipRow}>
                    {orphanEndings.map((e) => (
                      <View
                        key={e.id}
                        className={classnames(styles.orphanChip, 'endingChip')}
                        style={{
                          borderColor: getEndingTypeColor(e.type).text,
                          background: getEndingTypeColor(e.type).bg
                        }}
                        onClick={() => handleEndingNodeClick(e.id)}
                      >
                        <Text
                          className={styles.orphanChipText}
                          style={{ color: getEndingTypeColor(e.type).text }}
                          numberOfLines={1}
                        >
                          {e.title}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* 详情弹窗 */}
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

      {/* 代价快速编辑器 */}
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
                {!form.costUnclear && !form.cost.trim() && (
                  <Text className={styles.formWarning}>
                    ⚠️ 已关闭"尚不明确"，请在上方填写具体的代价内容，否则无法保存
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
                    {inspirations.slice(0, 12).map((ins) => {
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
                            <Text className={styles.endingCheckTitle}>{ins.title || '未命名灵感'}</Text>
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
