// 统一的餐类常量，避免各组件重复定义
export const MEAL_TYPES = {
  breakfast: { key: 'breakfast', label: '早餐', emoji: '🥐' },
  lunch: { key: 'lunch', label: '午餐', emoji: '🍱' },
  dinner: { key: 'dinner', label: '晚餐', emoji: '🍲' },
  supper: { key: 'supper', label: '夜宵', emoji: '🌙' },
};

export const MEAL_TYPE_LIST = Object.values(MEAL_TYPES);

export function getMealType(key) {
  return MEAL_TYPES[key] || { key, label: key, emoji: '🍽️' };
}
