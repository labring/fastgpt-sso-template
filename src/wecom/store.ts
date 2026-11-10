import { randomBytes } from "node:crypto";
import { HttpError } from "./config";
export class ExpiringStore<T> {
  private items = new Map<string, { value: T; expires: number }>();
  constructor(
    private ttl = 300_000,
    private limit = 10_000,
    private now = Date.now,
  ) {}
  private clean() {
    for (const [key, item] of this.items)
      if (item.expires <= this.now()) this.items.delete(key);
  }
  put(value: T) {
    this.clean();
    if (this.items.size >= this.limit)
      throw new HttpError(503, "Login capacity reached; please retry later");
    const key = randomBytes(32).toString("hex");
    this.items.set(key, { value, expires: this.now() + this.ttl });
    return key;
  }
  get(key: string) {
    this.clean();
    return this.items.get(key)?.value;
  }
  take(key: string) {
    const value = this.get(key);
    this.items.delete(key);
    return value;
  }
}
