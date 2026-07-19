export function getLocalStorageItem(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setLocalStorageItem(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

export function removeLocalStorageItem(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {}
}
