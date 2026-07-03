export class QueueManager {
  /**
   * Runs an array of tasks with limited concurrency.
   * Avoids external library compilation issues.
   */
  static async runConcurrent<T, R>(
    items: T[],
    concurrencyLimit: number,
    taskFn: (item: T) => Promise<R>
  ): Promise<R[]> {
    const results: R[] = new Array(items.length);
    let index = 0;

    // Worker promise loop
    const runWorker = async (): Promise<void> => {
      while (index < items.length) {
        const currentIndex = index++;
        const item = items[currentIndex];
        try {
          results[currentIndex] = await taskFn(item);
        } catch (err: any) {
          // Fallback if execution throws
          results[currentIndex] = {
            status: "OFFLINE",
            latency: null,
            errorMsg: err.message
          } as any;
        }
      }
    };

    // Spawn workers
    const workerCount = Math.min(concurrencyLimit, items.length);
    const workers: Promise<void>[] = [];
    for (let i = 0; i < workerCount; i++) {
      workers.push(runWorker());
    }

    await Promise.all(workers);
    return results;
  }
}
