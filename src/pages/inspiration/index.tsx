import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, Input, Textarea, Button } from '@tarojs/components';
import classnames from 'classnames';
import Taro from '@tarojs/taro';
import styles from './index.module.scss';
import { useGameStore } from '@/store/gameStore';
import InspirationCard from '@/components/InspirationCard';
import TagChip from '@/components/TagChip';
import EmptyState from '@/components/EmptyState';
import type { Influence, InfluenceDimension, Inspiration, EndingType } from '@/types';
import { INFLUENCE_LABELS, ENDING_TYPE_LABELS } from '@/types';
import { suggestDimensions, generateInfluencePrompt, suggestTags, getEndingTypeColor } from '@/utils/aiPrompt';

type FilterType = 'all' | InfluenceDimension;

const InspirationPage: React.FC = () => {
  const { inspirations, endings, addInspiration, updateInspiration, deleteInspiration } = useGameStore();
  const [filter, setFilter] = useState<FilterType>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [influences, setInfluences] = useState<Influence[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedEndingIds, setSelectedEndingIds] = useState<string[]>([]);

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

  const openCreate = () => {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setInfluences([]);
    setSelectedTags([]);
    setSelectedEndingIds([]);
    setShowModal(true);
  };

  const openEdit = (item: Inspiration) => {
    setEditingId(item.id);
    setTitle(item.title);
    setDescription(item.description);
    setInfluences([...item.influences]);
    setSelectedTags([...item.tags]);
    setSelectedEndingIds([...item.relatedEndingIds]);
    setShowModal(true);
  };

  const toggleEndingSelection = (endingId: string) => {
    if (selectedEndingIds.includes(endingId)) {
      setSelectedEndingIds(selectedEndingIds.filter((id) => id !== endingId));
    } else {
      setSelectedEndingIds([...selectedEndingIds, endingId]);
    }
  };

  const closeModal = () => {
    setShowModal(false);
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

    if (editingId) {
      updateInspiration(editingId, payload);
      Taro.showToast({ title: '已更新', icon: 'success' });
    } else {
      addInspiration(payload);
      Taro.showToast({ title: '灵感已收录 🕯️', icon: 'none' });
    }

    setShowModal(false);
    console.log('[InspirationPage] 保存灵感:', title);
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

  return (
    <View className={styles.container}>
      <View className={styles.pageHeader}>
        <Text className={styles.pageTitle}>
          <Text className={styles.pageTitleAccent}>灵感</Text>速记
        </Text>
        <Text className={styles.pageSubtitle}>
          随手记下那些让你后背发凉的点子 🕯️，不用一次写完
        </Text>
      </View>

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
              description={filter === 'all' ? '点击右下角按钮，记录第一个让你心跳加速的恐怖点子吧' : '换个维度筛选试试，或者添加一条新灵感'}
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

      <View className={styles.fabButton} onClick={openCreate}>
        <Text className={styles.fabIcon}>+</Text>
      </View>

      {showModal && (
        <View className={styles.modalMask} onClick={closeModal}>
          <View className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <View className={styles.modalDragBar} />

            <View className={styles.modalHeader}>
              <Text className={styles.modalTitle}>
                {editingId ? '编辑灵感' : '✨ 新灵感'}
              </Text>
              <View className={styles.modalClose} onClick={closeModal}>
                <Text className={styles.modalCloseText}>×</Text>
              </View>
            </View>

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
                勾选这个选择点会通向哪些结局，保存后会在因果检查页围绕它生成追问
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
                取消
              </Button>
              <Button className={styles.saveBtn} onClick={handleSave} disabled={!title.trim()}>
                {editingId ? '保存修改' : '🕯️ 收录灵感'}
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default InspirationPage;
