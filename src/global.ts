export const globalStore = globalThis as typeof globalThis & {
  __tmpMap: Map<string, { value: any; expiresIn: Date }>;
};

const clearExpiredValues = () => {
  const now = new Date();
  for (const [key, { expiresIn }] of globalStore.__tmpMap) {
    if (expiresIn < now) {
      globalStore.__tmpMap.delete(key);
      console.log(`Key ${key} with value expired, removed`);
    }
  }
};

// 定时清理过期的全局变量
export const initGlobalStore = () => {
  globalStore.__tmpMap = new Map();
  setInterval(clearExpiredValues, 1000 * 60 * 5);
};

export const setTmpValue = (key: string, value: any, expiresMinutes: number = 5) => {
  globalStore.__tmpMap.set(key, {
    value,
    expiresIn: new Date(Date.now() + expiresMinutes * 60 * 1000)
  });
};

export const getTmpValue = <T = any>(key: string) => {
  const item = globalStore.__tmpMap.get(key);
  if (!item) {
    return;
  }
  if (item.expiresIn < new Date()) {
    globalStore.__tmpMap.delete(key);
    return;
  }
  return item.value as T;
};
