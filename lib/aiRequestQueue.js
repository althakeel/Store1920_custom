const DEFAULT_MIN_INTERVAL_MS = Number(process.env.PRODUCT_AI_QUEUE_INTERVAL_MS || 1500);
const DEFAULT_MAX_CONCURRENT = Number(process.env.PRODUCT_AI_QUEUE_MAX_CONCURRENT || 1);

class AiRequestQueue {
  constructor({ minIntervalMs = DEFAULT_MIN_INTERVAL_MS, maxConcurrent = DEFAULT_MAX_CONCURRENT } = {}) {
    this.minIntervalMs = Math.max(250, minIntervalMs);
    this.maxConcurrent = Math.max(1, maxConcurrent);
    this.queue = [];
    this.running = 0;
    this.lastStartedAt = 0;
  }

  enqueue(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.pump();
    });
  }

  async pump() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const waitMs = Math.max(0, this.minIntervalMs - (Date.now() - this.lastStartedAt));
    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    const job = this.queue.shift();
    if (!job) return;

    this.running += 1;
    this.lastStartedAt = Date.now();

    try {
      const result = await job.fn();
      job.resolve(result);
    } catch (error) {
      job.reject(error);
    } finally {
      this.running -= 1;
      this.pump();
    }
  }
}

const productAiQueue = new AiRequestQueue();

export function runInProductAiQueue(fn) {
  return productAiQueue.enqueue(fn);
}

export function getProductAiQueueStats() {
  return {
    pending: productAiQueue.queue.length,
    running: productAiQueue.running,
  };
}

export function getProductAiQueueIntervalMs() {
  return productAiQueue.minIntervalMs;
}
