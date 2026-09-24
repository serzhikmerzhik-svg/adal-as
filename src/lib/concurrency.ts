/** items бойынша fn-ді бір уақытта ең көбі limit данадан орындайды (ДБ байланыс пулын толтырмау үшін). */
export async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<unknown>) {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      await fn(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}
