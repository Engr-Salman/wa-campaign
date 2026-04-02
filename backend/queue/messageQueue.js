/**
 * Simple in-memory message queue manager.
 * Works in conjunction with the sender and rate limiter.
 */

class MessageQueue {
  constructor() {
    this.queue = [];
    this.processing = false;
  }

  enqueue(items) {
    this.queue.push(...items);
  }

  dequeue() {
    return this.queue.shift();
  }

  size() {
    return this.queue.length;
  }

  clear() {
    this.queue = [];
    this.processing = false;
  }

  isEmpty() {
    return this.queue.length === 0;
  }
}

module.exports = new MessageQueue();
