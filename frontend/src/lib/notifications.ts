// Simple notification utility
// In a production app, you might want to use a toast library like sonner or react-hot-toast

let notificationCallback: ((type: 'success' | 'error', message: string) => void) | null = null;

export function setNotificationCallback(callback: (type: 'success' | 'error', message: string) => void) {
  notificationCallback = callback;
}

export function showNotification(type: 'success' | 'error', message: string) {
  if (notificationCallback) {
    notificationCallback(type, message);
  } else {
    // Fallback to console or alert
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
}

