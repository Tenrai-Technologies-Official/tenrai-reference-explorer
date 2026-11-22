/** Reuse one upstream request within the cache window. */
export function shared<T>(millis: number, load: () => Promise<T>): () => Promise<T> {
  let answer: Promise<T> | undefined;
  let fresh = 0;
  return () => {
    if (answer === undefined || Date.now() >= fresh) {
      const loading = load();
      answer = loading;
      fresh = Date.now() + millis;
      loading.catch(() => {
        if (answer === loading) {
          answer = undefined;
        }
      });
    }
    return answer;
  };
}

/** Cache detail requests by key with a bounded capacity. */
export function sharedBy<Key, Value>(millis: number, capacity: number, load: (key: Key) => Promise<Value>): (key: Key) => Promise<Value> {
  const entries = new Map<Key, () => Promise<Value>>();
  return (key) => {
    let read = entries.get(key);
    if (read !== undefined) {
      entries.delete(key);
      entries.set(key, read);
      return read();
    }
    if (entries.size >= capacity) {
      const oldest = entries.keys().next().value as Key | undefined;
      if (oldest !== undefined) {
        entries.delete(oldest);
      }
    }
    read = shared(millis, () => load(key));
    entries.set(key, read);
    return read();
  };
}
