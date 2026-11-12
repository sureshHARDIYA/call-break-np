type Listener = (channel: string, message: string) => void;

export interface PubSubBus {
  publish(channel: string, payload: unknown): Promise<void>;
  subscribe(channel: string, listener: Listener): () => void;
}

/**
 * In-process Pub/Sub coordinator matching Redis Pub/Sub semantics.
 * Drop-in replaceable with a Redis RESP client when scaling horizontally across nodes.
 */
class InMemoryPubSub implements PubSubBus {
  private channels = new Map<string, Set<Listener>>();

  async publish(channel: string, payload: unknown): Promise<void> {
    const listeners = this.channels.get(channel);
    if (!listeners || listeners.size === 0) return;
    const serialized = JSON.stringify(payload);
    for (const listener of listeners) {
      listener(channel, serialized);
    }
  }

  subscribe(channel: string, listener: Listener): () => void {
    let set = this.channels.get(channel);
    if (!set) {
      set = new Set();
      this.channels.set(channel, set);
    }
    set.add(listener);
    return () => {
      set?.delete(listener);
      if (set && set.size === 0) {
        this.channels.delete(channel);
      }
    };
  }
}

export const pubSubBus: PubSubBus = new InMemoryPubSub();
