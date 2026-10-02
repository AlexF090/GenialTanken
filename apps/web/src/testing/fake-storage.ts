/** In-memory `Storage` for tests. */
export class FakeStorage implements Storage {
  private readonly entries = new Map<string, string>();

  constructor(initialEntries: Record<string, string> = {}) {
    for (const [key, value] of Object.entries(initialEntries)) {
      this.entries.set(key, value);
    }
  }

  get length(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.entries.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, value);
  }
}
