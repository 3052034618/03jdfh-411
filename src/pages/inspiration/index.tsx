import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, ScrollView, Input, Textarea, Button } from '@tarojs/components';
import classnames from 'classnames';
import Taro from '@tarojs/taro';
import styles from './index.module.scss';
import { useGameStore } from '@/store/gameStore';
import InspirationCard from '@/components/InspirationCard';
import TagChip from '@/components/TagChip';
import EmptyState from '@/components/EmptyState';
import type { Influence, InfluenceDimension, Inspiration, EndingType, InspirationDraft } from '@/types';
import { INFLUENCE_LABELS, ENDING_TYPE_LABELS } from '@/types';
import { suggestDimensions, generateInfluencePrompt, suggestTags, getEndingTypeColor } from '@/utils/aiPrompt';

type FilterType = 'all' | InfluenceDimension;
type InspirationView = 'formal' | 'draft';

const formatTime = (ts: number) => {
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60 * 1000) return '刚刚';
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / 86400000)} 天前`;
  return `${d.getMonth() + 1}月${d.getDate()}日`;
};

const InspirationPage: React.FC = () => {
  const {
    inspirations,
    endings,
    addInspiration,
    updateInspiration,
    deleteInspiration,
    drafts,
    activeDraftId,
    newDraft,
    saveDraft,
    loadDraft,
    deleteDraft,
    commitDraft,
    getActiveDraft
  } = useGameStore();

  const [view, setView] = useState<InspirationView>('formal');
  const [filter, setFilter] = useState<FilterType>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDraftMode, setIsDraftMode] = useState(false);
  const [showDraftRestoreHint, setShowDraftRestoreHint] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [influences, setInfluences] = useState<Influence[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedEndingIds, setSelectedEndingIds] = useState<string[]>([]);

  // 草稿自动保存节流定时器
  const autoSaveTimerRef = useRef<number | null>(null);
  const autoSaveIndicatorRef = useRef<View>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const suggestedDims = useMemo(() => suggestDimensions(title + description), [title, description]);
  const suggestedTags = useMemo(() => suggestTags({ title, description }), [title, description]);
  const aiPromptText = useMemo(() => {
    if (!title && !description) return '输入灵感内容后，AI 会帮你识别应该记录哪些影响维度...';
    const activeDim = influences[0]?.dimension || suggestedDims[0] || 'ghost';
    return generateInfluencePrompt(activeDim, title + description);
  }, [title, description, influences, suggestedDims]);

  const filteredInspirations = useMemo(() => {
    if (filter === 'all') return inspirations;
    return inspirations.filter((ins) =>
      ins.influences.some((inf) => inf.dimension === filter)
    );
  }, [inspirations, filter]);

  const sortedDrafts = useMemo(() => {
    return [...drafts].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [drafts]);

  const stats = useMemo(() => {
    let ghostCount = 0, trustCount = 0, escapeCount = 0;
    inspirations.forEach((ins) => {
      ins.influences.forEach((inf) => {
        if (inf.dimension === 'ghost') ghostCount++;
        else if (inf.dimension === 'trust') trustCount++;
        else if (inf.dimension === 'escape') escapeCount++;
      });
    });
    return { total: inspirations.length, ghost: ghostCount, trust: trustCount, escape: escapeCount };
  }, [inspirations]);

  // ===== 草稿自动保存 =====
  const triggerAutoSave = () => {
    if (!isDraftMode) return;
    const activeDraft = getActiveDraft();
    if (!activeDraft) return;

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    setAutoSaveStatus('saving');
    autoSaveTimerRef.current = window.setTimeout(() => {
      const validInfluences = influences.filter((i) => {
        if (!i.content.trim() && !i.label) return false;
        return true;
      });
      saveDraft({
        title,
        description,
        influences: validInfluences,
        relatedEndingIds: selectedEndingIds,
        tags: selectedTags
      });
      setAutoSaveStatus('saved');
      window.setTimeout(() => setAutoSaveStatus('idle'), 1200);
      autoSaveTimerRef.current = null;
    }, 400);
  };

  useEffect(() => {
    triggerAutoSave();
  }, [title, description, influences, selectedTags, selectedEndingIds]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, []);

  const fillFromDraft = (draft: InspirationDraft) => {
    setTitle(draft.title);
    setDescription(draft.description);
    setInfluences(draft.influences.length > 0 ? [...draft.influences] : []);
    setSelectedTags([...draft.tags]);
    setSelectedEndingIds([...draft.relatedEndingIds]);
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setInfluences([]);
    setSelectedTags([]);
    setSelectedEndingIds([]);
    setAutoSaveStatus('idle');
  };

  const askRestoreActiveDraft = (): boolean => {
    const existing = getActiveDraft();
    if (!existing) return false;
    const hasAnyContent =
      existing.title.trim() ||
      existing.description.trim() ||
      existing.influences.length > 0 ||
      existing.tags.length > 0 ||
      existing.relatedEndingIds.length > 0;
    return hasAnyContent;
  };

  const openCreate = () => {
    const shouldAskRestore = !editingId && askRestoreActiveDraft();
    if (shouldAskRestore) {
      Taro.showActionSheet({
        itemList: ['✏️ 继续上次未完成的草稿', '🌱 从空白开始', '🗑️  丢弃现有草稿重开'],
        success: (res) => {
          if (res.tapIndex === 0) {
            // 恢复草稿
            const active = getActiveDraft();
            if (active) {
              setEditingId(null);
              setIsDraftMode(true);
              loadDraft(active.id);
              fillFromDraft(active);
              setShowModal(true);
              setShowDraftRestoreHint(true);
              setTimeout(() => setShowDraftRestoreHint(false), 3000);
            }
          } else if (res.tapIndex === 1) {
            // 新建空白草稿
            startNewBlankDraft();
          } else if (res.tapIndex === 2) {
            // 丢弃 active 草稿，重开
            const active = getActiveDraft();
            if (active) deleteDraft(active.id);
            startNewBlankDraft();
          }
        }
      });
      return;
    }
    startNewBlankDraft();
  };

  const startNewBlankDraft = () => {
    setEditingId(null);
    setIsDraftMode(true);
    const id = newDraft();
    loadDraft(id);
    resetForm();
    setShowModal(true);
  };

  const openEdit = (item: Inspiration) => {
    setEditingId(item.id);
    setIsDraftMode(false);
    setTitle(item.title);
    setDescription(item.description);
    setInfluences([...item.influences]);
    setSelectedTags([...item.tags]);
    setSelectedEndingIds([...item.relatedEndingIds]);
    setAutoSaveStatus('idle');
    setShowModal(true);
  };

  const openDraftEdit = (draft: InspirationDraft) => {
    setEditingId(null);
    setIsDraftMode(true);
    loadDraft(draft.id);
    fillFromDraft(draft);
    setShowModal(true);
  };

  const handleDraftQuickCommit = (draft: InspirationDraft) => {
    if (!draft.title.trim()) {
      Taro.showModal({
        title: '提示',
        content: '该草稿还没写标题，建议先编辑补上后再收录为正式灵感',
        confirmText: '去编辑',
        success: (res) => {
          if (res.confirm) openDraftEdit(draft);
        }
      });
      return;
    }
    Taro.showModal({
      title: '转为正式灵感',
      content: `确定要将「${draft.title || '未命名草稿'}」转为正式灵感吗？之后会参与结局关联和因果追问`,
      confirmText: '转为正式',
      success: (res) => {
        if (res.confirm) {
          commitDraft(draft.id);
          Taro.showToast({ title: '已转为正式灵感 🕯️', icon: 'none' });
          setView('formal');
        }
      }
    });
  };

  const handleDraftDelete = (draftId: string) => {
    Taro.showModal({
      title: '删除草稿',
      content: '草稿删除后无法恢复，要继续吗？',
      confirmColor: '#E74C3C',
      success: (res) => {
        if (res.confirm) {
          if (getActiveDraft()?.id === draftId) {
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
          }
          deleteDraft(draftId);
          Taro.showToast({ title: '已删除草稿', icon: 'none' });
        }
      }
    });
  };

  const toggleEndingSelection = (endingId: string) => {
    if (selectedEndingIds.includes(endingId)) {
      setSelectedEndingIds(selectedEndingIds.filter((id) => id !== endingId));
    } else {
      setSelectedEndingIds([...selectedEndingIds, endingId]);
    }
  };

  const closeModal = () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    setShowModal(false);
    setAutoSaveStatus('idle');
  };

  const toggleDimension = (dim: InfluenceDimension) => {
    const exists = influences.find((i) => i.dimension === dim);
    if (exists) {
      setInfluences(influences.filter((i) => i.dimension !== dim));
    } else {
      setInfluences([
        ...influences,
        { dimension: dim, label: INFLUENCE_LABELS[dim], content: '', level: 3 }
      ]);
    }
  };

  const addCustomDimension = () => {
    setInfluences([
      ...influences,
      { dimension: 'custom', label: '自定义维度', content: '', level: 3 }
    ]);
  };

  const updateInfluence = (idx: number, patch: Partial<Influence>) => {
    const next = [...influences];
    next[idx] = { ...next[idx], ...patch };
    setInfluences(next);
  };

  const removeInfluence = (idx: number) => {
    setInfluences(influences.filter((_, i) => i !== idx));
  };

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSave = () => {
    if (!title.trim()) {
      Taro.showToast({ title: '请填写灵感标题', icon: 'none' });
      return;
    }
    const validInfluences = influences.filter((i) => i.content.trim());
    const payload = {
      title: title.trim(),
      description: description.trim(),
      influences: validInfluences,
      relatedEndingIds: selectedEndingIds,
      tags: selectedTags
    };

    if (isDraftMode) {
      // 草稿模式下保存 = commitDraft
      const currentDraft = getActiveDraft();
      if (currentDraft) {
        // 先把最后一次变更写进草稿
        saveDraft(payload);
        commitDraft(currentDraft.id);
        Taro.showToast({ title: '已转为正式灵感 🕯️', icon: 'none' });
      } else {
        // fallback：直接加正式灵感
        addInspiration(payload);
        Taro.showToast({ title: '灵感已收录 🕯️', icon: 'none' });
      }
    } else if (editingId) {
      updateInspiration(editingId, payload);
      Taro.showToast({ title: '已更新', icon: 'success' });
    } else {
      addInspiration(payload);
      Taro.showToast({ title: '灵感已收录 🕯️', icon: 'none' });
    }

    setShowModal(false);
  };

  const handleDelete = (id: string) => {
    Taro.showModal({
      title: '删除灵感',
      content: '确定要忘记这个点子吗？删除后无法恢复。',
      confirmColor: '#E74C3C',
      success: (res) => {
        if (res.confirm) {
          deleteInspiration(id);
          Taro.showToast({ title: '已删除', icon: 'none' });
          setShowModal(false);
        }
      }
    });
  };

  const getLevelBg = (dim: InfluenceDimension, level: number, target: number) => {
    if (target > level) return {};
    const colorMap: Record<string, string> = {
      ghost: 'linear-gradient(135deg, #E74C3C, #C0392B)',
      trust: 'linear-gradient(135deg, #2ECC71, #27AE60)',
      escape: 'linear-gradient(135deg, #3498DB, #2980B9)',
      custom: 'linear-gradient(135deg, #9B59B6, #8E44AD)'
    };
    return { background: colorMap[dim] || colorMap.custom };
  };

  const getDimLabelColor = (dim: InfluenceDimension) => {
    const map: Record<string, string> = {
      ghost: '#EC7063',
      trust: '#58D68D',
      escape: '#5DADE2',
      custom: '#AF7AC5'
    };
    return map[dim] || map.custom;
  };

  const draftCardPreview = (draft: InspirationDraft) => {
    const hasTitle = draft.title.trim().length > 0;
    const hasDesc = draft.description.trim().length > 0;
    const firstInf = draft.influences[0];
    let snippet = '（空白草稿，点进去填写内容吧）';
    if (hasDesc) {
      snippet = draft.description.slice(0, 40) + (draft.description.length > 40 ? '…' : '');
    } else if (firstInf && firstInf.content) {
      snippet = `${firstInf.label}: ${firstInf.content.slice(0, 30)}`;
    } else if (hasTitle) {
      snippet = '已填标题，点进去继续写';
    }
    return snippet;
  };

  const draftHasTitle = (draft: InspirationDraft) => draft.title.trim().length > 0;

  return (
    <View className={styles.container}>
      <View className={styles.pageHeader}>
        <Text className={styles.pageTitle}>
          <Text className={styles.pageTitleAccent}>灵感</Text>速记
        </Text>
        <Text className={styles.pageSubtitle}>
          随手记下那些让你后背发凉的点子 🕯️，不用一次写完，草稿会自动保存
        </Text>
      </View>

      {/* 主视图切换 */}
      <View className={styles.viewSwitchTabs}>
        <View
          className={classnames(styles.viewSwitchTab, view === 'formal' && styles.active)}
          onClick={() => setView('formal')}
        >
          <Text className={styles.viewSwitchIcon}>📝</Text>
          <Text className={styles.viewSwitchText}>正式灵感</Text>
          <View className={styles.viewSwitchCountBox}>
            <Text className={styles.viewSwitchCount}>{stats.total}</Text>
          </View>
        </View>
        <View
          className={classnames(styles.viewSwitchTab, view === 'draft' && styles.active)}
          onClick={() => setView('draft')}
        >
          <Text className={styles.viewSwitchIcon}>✏️</Text>
          <Text className={styles.viewSwitchText}>草稿箱</Text>
          {drafts.length > 0 && (
            <View className={styles.viewSwitchBadge}>
              <Text className={styles.viewSwitchBadgeText}>{drafts.length}</Text>
            </View>
          )}
        </View>
      </View>

      {/* ===== 正式灵感视图 ===== */}
      {view === 'formal' && (
        <>
          <View className={styles.statsRow}>
            <View className={styles.statCard}>
              <Text className={styles.statNumber}>{stats.total}</Text>
              <Text className={styles.statLabel}>灵感总数</Text>
            </View>
            <View className={styles.statCard}>
              <Text className={styles.statNumber} style={{ color: '#EC7063' }}>{stats.ghost}</Text>
              <Text className={styles.statLabel}>鬼影维度</Text>
            </View>
            <View className={styles.statCard}>
              <Text className={styles.statNumber} style={{ color: '#58D68D' }}>{stats.trust}</Text>
              <Text className={styles.statLabel}>信任维度</Text>
            </View>
          </View>

          <ScrollView scrollX className={styles.filterBar} enhanced showScrollbar={false}>
            {[
              { key: 'all' as const, label: '全部' },
              { key: 'ghost' as const, label: '👻 鬼影' },
              { key: 'trust' as const, label: '🤝 信任' },
              { key: 'escape' as const, label: '🚪 逃离' },
              { key: 'custom' as const, label: '✨ 自定义' }
            ].map((item) => (
              <View
                key={item.key}
                className={classnames(styles.filterItem, filter === item.key && styles.active)}
                onClick={() => setFilter(item.key)}
              >
                <Text className={styles.filterText}>{item.label}</Text>
              </View>
            ))}
          </ScrollView>

          <View className={styles.listArea}>
            {filteredInspirations.length === 0 ? (
              <View className={styles.emptyWrap}>
                <EmptyState
                  icon="💭"
                  title={filter === 'all' ? '还没有灵感记录' : '该维度暂无记录'}
                  description={filter === 'all' ? '点击右下角按钮，记录第一个让你心跳加速的恐怖点子吧，草稿会自动保存' : '换个维度筛选试试，或者添加一条新灵感'}
                  actionLabel={filter === 'all' ? '✍️ 记录灵感' : undefined}
                  onAction={filter === 'all' ? openCreate : undefined}
                />
              </View>
            ) : (
              filteredInspirations.map((item) => (
                <InspirationCard
                  key={item.id}
                  data={item}
                  onClick={() => openEdit(item)}
                />
              ))
            )}
          </View>
        </>
      )}

      {/* ===== 草稿箱视图 ===== */}
      {view === 'draft' && (
        <>
          <View className={styles.draftIntroCard}>
            <View className={styles.draftIntroTop}>
              <Text className={styles.draftIntroTitle}>✏️ 草稿箱</Text>
              <Text className={styles.draftIntroCount}>{drafts.length} 个草稿</Text>
            </View>
            <Text className={styles.draftIntroDesc}>
              写一半的灵感会自动存在这里，草稿不会参与结局关联和因果追问
            </Text>
          </View>

          <View className={styles.draftListArea}>
            {sortedDrafts.length === 0 ? (
              <View className={styles.emptyWrap}>
                <EmptyState
                  icon="📝"
                  title="草稿箱空空如也"
                  description="记录灵感时若中途退出，内容会自动存到这里。点击右下角按钮开始 →"
                  actionLabel="🌱 写一条新草稿"
                  onAction={openCreate}
                />
              </View>
            ) : (
              sortedDrafts.map((draft) => (
                <View key={draft.id} className={styles.draftCard}>
                  <View className={styles.draftCardHead}>
                    <Text className={styles.draftCardTitle}>
                      {draft.title.trim() ? draft.title : '💭 未命名草稿'}
                    </Text>
                    {!draftHasTitle(draft) && (
                      <View className={styles.draftCardWarnBadge}>
                        <Text className={styles.draftCardWarnText}>缺标题</Text>
                      </View>
                    )}
                  </View>
                  <Text className={styles.draftCardTime}>
                    ⏰ {formatTime(draft.updatedAt)}
                  </Text>
                  <Text className={styles.draftCardSnippet}>
                    {draftCardPreview(draft)}
                  </Text>
                  {draft.influences.length > 0 && (
                    <View className={styles.draftCardMeta}>
                      <Text className={styles.draftMetaLabel}>维度：</Text>
                      {draft.influences.map((inf) => (
                        <View
                          key={inf.dimension}
                          className={styles.draftMetaChip}
                          style={{
                            borderColor: getDimLabelColor(inf.dimension),
                            color: getDimLabelColor(inf.dimension)
                          }}
                        >
                          <Text className={styles.draftMetaChipText}>{inf.label}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {draft.tags.length > 0 && (
                    <View className={styles.draftCardMeta}>
                      <Text className={styles.draftMetaLabel}>标签：</Text>
                      {draft.tags.slice(0, 5).map((t) => (
                        <View key={t} className={styles.draftTagChip}>
                          <Text className={styles.draftTagChipText}>#{t}</Text>
                        </View>
                      ))}
                      {draft.tags.length > 5 && (
                        <Text className={styles.draftMoreTag}>+{draft.tags.length - 5}</Text>
                      )}
                    </View>
                  )}
                  <View className={styles.draftCardActions}>
                    <View className={styles.draftCardActionBtnSecondary} onClick={() => openDraftEdit(draft)}>
                      <Text className={styles.draftCardActionTextSecondary}>✏️ 继续编辑</Text>
                    </View>
                    <View
                      className={classnames(
                        styles.draftCardActionBtnDanger
                      )}
                      onClick={() => handleDraftDelete(draft.id)}
                    >
                      <Text className={styles.draftCardActionTextDanger}>🗑️ 删除</Text>
                    </View>
                    <View
                      className={classnames(
                        styles.draftCardActionBtnPrimary,
                        !draftHasTitle(draft) && 'disabled'
                      )}
                      onClick={() => handleDraftQuickCommit(draft)}
                    >
                      <Text className={styles.draftCardActionTextPrimary}>🕯️ 转为正式</Text>
                    </View>
                  </View>
                </View>
              ))
            )}
          </View>
        </>
      )}

      {/* 两个视图通用的 FAB */}
      <View className={styles.fabButton} onClick={openCreate}>
        <Text className={styles.fabIcon}>+</Text>
      </View>

      {showModal && (
        <View className={styles.modalMask} onClick={closeModal}>
          <ScrollView scrollY className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <View className={styles.modalDragBar} />

            <View className={styles.modalHeader}>
              <View>
                <Text className={styles.modalTitle}>
                  {editingId ? '编辑灵感' : isDraftMode ? '✏️ 草稿模式' : '✨ 新灵感'}
                </Text>
                {isDraftMode && (
                  <View className={styles.draftStatusRow}>
                    {autoSaveStatus === 'saving' && (
                      <Text className={styles.draftStatusSaving}>⏳ 自动保存中…</Text>
                    )}
                    {autoSaveStatus === 'saved' && (
                      <Text className={styles.draftStatusSaved}>✅ 已自动保存</Text>
                    )}
                    {autoSaveStatus === 'idle' && (
                      <Text className={styles.draftStatusIdle}>草稿会自动保存在本地</Text>
                    )}
                  </View>
                )}
              </View>
              <View className={styles.modalClose} onClick={closeModal}>
                <Text className={styles.modalCloseText}>×</Text>
              </View>
            </View>

            {showDraftRestoreHint && (
              <View className={styles.draftRestoreHint}>
                <Text className={styles.draftRestoreHintText}>
                  📝 已为你恢复上次未完成的草稿
                </Text>
              </View>
            )}

            <View className={styles.formSection}>
              <Text className={styles.formLabel}>灵感标题</Text>
              <Input
                className={styles.formInput}
                placeholder="如：玩家把镜子蒙上红布"
                placeholderClass={styles.formInput + '-placeholder'}
                value={title}
                onInput={(e) => setTitle(e.detail.value)}
                maxlength={30}
              />
            </View>

            <View className={styles.formSection}>
              <Text className={styles.formLabel}>场景描述</Text>
              <Textarea
                className={styles.formTextarea}
                placeholder="补充这个选择发生的背景、玩家心理、环境氛围..."
                value={description}
                onInput={(e) => setDescription(e.detail.value)}
                maxlength={300}
                autoHeight
              />
              <View className={styles.aiHintBox}>
                <Text className={styles.aiHintLabel}>🪄 AI 提示</Text>
                <Text className={styles.aiHintText}>{aiPromptText}</Text>
              </View>
            </View>

            <View className={styles.formSection}>
              <Text className={styles.formLabel}>影响维度</Text>
              <View className={styles.dimSelector}>
                {(['ghost', 'trust', 'escape'] as InfluenceDimension[]).map((dim) => {
                  const active = influences.some((i) => i.dimension === dim);
                  const suggested = suggestedDims.includes(dim);
                  return (
                    <TagChip
                      key={dim}
                      label={(suggested ? '💡 ' : '') + INFLUENCE_LABELS[dim]}
                      active={active}
                      color={dim}
                      onClick={() => toggleDimension(dim)}
                    />
                  );
                })}
                <TagChip
                  label="+ 自定义维度"
                  active={influences.some((i) => i.dimension === 'custom')}
                  color="custom"
                  onClick={addCustomDimension}
                />
              </View>

              <View className={styles.influenceList}>
                {influences.map((inf, idx) => (
                  <View key={idx} className={styles.influenceCard}>
                    <View className={styles.influenceHeader}>
                      <Text
                        className={styles.influenceDimLabel}
                        style={{ color: getDimLabelColor(inf.dimension) }}
                      >
                        {inf.label}
                      </Text>
                      <View
                        className={styles.removeInfluenceBtn}
                        onClick={() => removeInfluence(idx)}
                      >
                        <Text className={styles.removeInfluenceText}>×</Text>
                      </View>
                    </View>

                    <View className={styles.levelSelector}>
                      {[1, 2, 3, 4, 5].map((lv) => (
                        <View
                          key={lv}
                          className={classnames(styles.levelOption, lv <= inf.level && styles.active)}
                          style={getLevelBg(inf.dimension, inf.level, lv)}
                          onClick={() => updateInfluence(idx, { level: lv as 1 | 2 | 3 | 4 | 5 })}
                        >
                          <Text className={styles.levelOptionText}>
                            {['', '微', '轻', '中', '强', '极'][lv]}
                          </Text>
                        </View>
                      ))}
                    </View>

                    <Textarea
                      className={styles.formInput}
                      placeholder={generateInfluencePrompt(inf.dimension, title || '这个选择')}
                      value={inf.content}
                      onInput={(e) => updateInfluence(idx, { content: e.detail.value })}
                      maxlength={200}
                      autoHeight
                    />
                  </View>
                ))}
              </View>
            </View>

            <View className={styles.formSection}>
              <Text className={styles.formLabel}>标签</Text>

              {selectedTags.length > 0 && (
                <View className={styles.selectedTags}>
                  {selectedTags.map((tag) => (
                    <TagChip
                      key={tag}
                      label={'#' + tag}
                      active
                      color="custom"
                      onRemove={() => toggleTag(tag)}
                    />
                  ))}
                </View>
              )}

              {suggestedTags.length > 0 && (
                <View className={styles.tagSuggestions}>
                  {suggestedTags
                    .filter((t) => !selectedTags.includes(t))
                    .map((tag) => (
                      <TagChip
                        key={tag}
                        label={'💡 ' + tag}
                        color="default"
                        onClick={() => toggleTag(tag)}
                      />
                    ))}
                </View>
              )}
            </View>

            <View className={styles.formSection}>
              <Text className={styles.formLabel}>🎯 通向的结局</Text>
              <Text className={styles.formSubHint}>
                勾选这个选择点会通向哪些结局，保存为正式灵感后会参与因果追问
              </Text>

              {endings.length === 0 ? (
                <View className={styles.noEndingHint}>
                  <Text>还没有结局，先去「结局卡册」添加一些吧 →</Text>
                </View>
              ) : (
                <View className={styles.endingCheckList}>
                  {endings.map((ending) => {
                    const checked = selectedEndingIds.includes(ending.id);
                    const colors = getEndingTypeColor(ending.type);
                    return (
                      <View
                        key={ending.id}
                        className={classnames(styles.endingCheckItem, checked && styles.endingCheckItemActive)}
                        style={checked ? { borderColor: colors.border, background: colors.bg } : {}}
                        onClick={() => toggleEndingSelection(ending.id)}
                      >
                        <View className={styles.checkbox}>
                          {checked && <Text className={styles.checkboxTick}>✓</Text>}
                        </View>
                        <View className={styles.endingCheckContent}>
                          <View className={styles.endingCheckHeader}>
                            <Text
                              className={styles.endingCheckType}
                              style={{ background: colors.bg, color: colors.text }}
                            >
                              {ENDING_TYPE_LABELS[ending.type]}
                            </Text>
                            <Text className={styles.endingCheckTitle}>{ending.title}</Text>
                          </View>
                          <Text className={styles.endingCheckHint}>🔑 {ending.triggerHint}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            <View className={styles.footerActions}>
              {editingId && (
                <Button
                  className={styles.cancelBtn}
                  style={{ flex: 1, color: '#EC7063', borderColor: 'rgba(231,76,60,0.3)', background: 'rgba(231,76,60,0.08)' }}
                  onClick={() => handleDelete(editingId)}
                >
                  删除
                </Button>
              )}
              <Button className={styles.cancelBtn} onClick={closeModal}>
                {isDraftMode ? '关闭草稿' : '取消'}
              </Button>
              <Button
                className={styles.saveBtn}
                onClick={handleSave}
                disabled={!title.trim()}
              >
                {isDraftMode
                  ? '🕯️ 存为正式灵感'
                  : editingId ? '保存修改' : '🕯️ 收录灵感'}
              </Button>
            </View>
          </ScrollView>
        </View>
      )}
    </View>
  );
};

export default InspirationPage;
