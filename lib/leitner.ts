export const BOX_INTERVALS: Record<number, number> = {
  1: 0,
  2: 1,
  3: 2,
  4: 4,
  5: 7,
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function isDue(box: number, lastReview: string | null): boolean {
  if (lastReview === null) return true;
  const then = new Date(lastReview).getTime();
  if (Number.isNaN(then)) return true;
  const ageDays = (Date.now() - then) / DAY_MS;
  const threshold = BOX_INTERVALS[box] ?? 0;
  return ageDays >= threshold;
}

export function dueCount<
  T extends { box: number; last_review: string | null },
>(items: readonly T[]): number {
  let count = 0;
  for (const item of items) {
    if (isDue(item.box, item.last_review)) count++;
  }
  return count;
}
