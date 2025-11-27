// Toast notification utility using sonner
import { toast } from 'sonner';

// Legacy callback support (for backwards compatibility)
let notificationCallback: ((type: 'success' | 'error', message: string) => void) | null = null;

export function setNotificationCallback(callback: (type: 'success' | 'error', message: string) => void) {
  notificationCallback = callback;
}

export function showNotification(type: 'success' | 'error', message: string) {
  // Call legacy callback if set
  if (notificationCallback) {
    notificationCallback(type, message);
  }
  
  // Show toast
  if (type === 'success') {
    toast.success(message);
  } else {
    toast.error(message);
  }
}

