const pageSize = 10;

export function paginateEntries<T>(entries: T[], base: string) {
  const total = Math.max(1, Math.ceil(entries.length / pageSize));
  const maxRows = Math.min(entries.length, pageSize);
  const href = (page: number) => (page === 1 ? base : `${base}page/${page}/`);

  return Array.from({ length: total }, (_, index) => {
    const current = index + 1;
    return {
      path: href(current),
      entries: entries.slice(index * pageSize, current * pageSize),
      current,
      total,
      maxRows,
      newer: current > 1 ? href(current - 1) : undefined,
      older: current < total ? href(current + 1) : undefined,
    };
  });
}

export type EntryPage<T> = ReturnType<typeof paginateEntries<T>>[number];
