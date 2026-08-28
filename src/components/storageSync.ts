// src/utils/storageSync.ts

export const getSyncedItem = <T>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (e) {
    return fallback;
  }
};

export const setSyncedItem = <T>(key: string, value: T): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    // إطلاق حدث مخصص لضمان المزامنة الفورية داخل نفس المتصفح وبين التبويبات
    window.dispatchEvent(new Event('moldatk_storage_updated'));
  } catch (e) {
    console.error('Storage sync error:', e);
  }
};