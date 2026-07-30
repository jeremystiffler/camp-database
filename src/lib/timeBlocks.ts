export type TimeBlockLike = {
  label?: string | null;
  startTime: string;
  endTime: string;
};

/** A time block repeated across event days is one user-authored block, not N rows. */
export function timeBlockGroupKey(block: TimeBlockLike): string {
  return `${block.label ?? ""}|${block.startTime}|${block.endTime}`;
}

export function countTimeBlockGroups(blocks: TimeBlockLike[]): number {
  return new Set(blocks.map(timeBlockGroupKey)).size;
}
