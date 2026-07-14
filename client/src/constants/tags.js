// 预设标签库
export const TAG_LIBRARY = {
  taste: { label: '口味', tags: ['辣', '甜', '咸', '酸', '清淡', '香辣', '麻辣', '鲜'] },
  ingredient: { label: '食材', tags: ['含花生', '含海鲜', '含蛋', '含牛奶', '含坚果', '含麸质', '含豆制品'] },
  property: { label: '属性', tags: ['素食', '清真', '低卡', '高蛋白', '重口', '轻食', '家常'] },
  scene: { label: '场景', tags: ['解馋', '饱腹', '下饭', '夜宵搭子', '解辣', '开胃'] },
};

export const TAG_GROUPS = Object.entries(TAG_LIBRARY).map(([key, val]) => ({
  key,
  label: val.label,
  tags: val.tags,
}));

// 所有标签的扁平数组
export const ALL_TAGS = Object.values(TAG_LIBRARY).flatMap((g) => g.tags);

// 标签颜色映射
export const TAG_COLORS = {
  // 口味：橙红色系
  '辣': '#ef4444', '香辣': '#ef4444', '麻辣': '#dc2626',
  '甜': '#ec4899', '酸': '#f59e0b',
  '咸': '#6366f1', '鲜': '#14b8a6', '清淡': '#22c55e',
  // 食材：紫色系（过敏提示）
  '含花生': '#a855f7', '含海鲜': '#a855f7', '含蛋': '#a855f7',
  '含牛奶': '#a855f7', '含坚果': '#a855f7', '含麸质': '#a855f7', '含豆制品': '#a855f7',
  // 属性：绿色系
  '素食': '#22c55e', '清真': '#16a34a', '低卡': '#10b981',
  '高蛋白': '#059669', '轻食': '#22c55e', '家常': '#64748b', '重口': '#f97316',
  // 场景：蓝色系
  '解馋': '#3b82f6', '饱腹': '#3b82f6', '下饭': '#3b82f6',
  '夜宵搭子': '#6366f1', '解辣': '#3b82f6', '开胃': '#3b82f6',
};

export function getTagColor(tag) {
  return TAG_COLORS[tag] || '#6b7280';
}
