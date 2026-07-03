"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueManager = void 0;
class QueueManager {
    /**
     * Runs an array of tasks with limited concurrency.
     * Avoids external library compilation issues.
     */
    static async runConcurrent(items, concurrencyLimit, taskFn) {
        const results = new Array(items.length);
        let index = 0;
        // Worker promise loop
        const runWorker = async () => {
            while (index < items.length) {
                const currentIndex = index++;
                const item = items[currentIndex];
                try {
                    results[currentIndex] = await taskFn(item);
                }
                catch (err) {
                    // Fallback if execution throws
                    results[currentIndex] = {
                        status: "OFFLINE",
                        latency: null,
                        errorMsg: err.message
                    };
                }
            }
        };
        // Spawn workers
        const workerCount = Math.min(concurrencyLimit, items.length);
        const workers = [];
        for (let i = 0; i < workerCount; i++) {
            workers.push(runWorker());
        }
        await Promise.all(workers);
        return results;
    }
}
exports.QueueManager = QueueManager;
