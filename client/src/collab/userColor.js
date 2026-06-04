const PALETTE = [
  '#0075de',
  '#2a9d99',
  '#dd5b00',
  '#ff64c8',
  '#1aae39',
  '#523410',
  '#391c57',
];

/** 根据 user_id 生成稳定的协作光标颜色 */
export function colorFromUserId(userId) {
  if (!userId) return PALETTE[0];
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
