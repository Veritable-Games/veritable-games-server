// Simple toast notification system
// This is a stub implementation - replace with a proper toast library if needed

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastOptions {
  duration?: number;
  position?: 'top' | 'bottom' | 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
}

class ToastManager {
  private container: HTMLDivElement | null = null;

  private ensureContainer() {
    if (typeof window === 'undefined') return null;

    if (!this.container) {
      this.container = document.getElementById('toast-container') as HTMLDivElement;
      if (!this.container) {
        this.container = document.createElement('div');
        this.container.id = 'toast-container';
        this.container.className = 'fixed top-4 right-4 z-50 space-y-2';
        document.body.appendChild(this.container);
      }
    }
    return this.container;
  }

  private createToast(message: string, type: ToastType, options: ToastOptions = {}) {
    const container = this.ensureContainer();
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `
      animate-slide-in px-4 py-3 rounded-lg shadow-lg flex items-center gap-2
      ${type === 'success' ? 'bg-green-600 text-white' : ''}
      ${type === 'error' ? 'bg-red-600 text-white' : ''}
      ${type === 'warning' ? 'bg-yellow-600 text-white' : ''}
      ${type === 'info' ? 'bg-blue-600 text-white' : ''}
    `;

    // Add icon based on type
    const icon = document.createElement('span');
    icon.innerHTML =
      type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warning' ? '⚠' : 'ℹ';
    toast.appendChild(icon);

    // Add message
    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;
    toast.appendChild(messageSpan);

    // Add close button
    const closeButton = document.createElement('button');
    closeButton.className = 'ml-4 hover:opacity-75';
    closeButton.innerHTML = '✕';
    closeButton.onclick = () => toast.remove();
    toast.appendChild(closeButton);

    container.appendChild(toast);

    // Auto remove after duration
    const duration = options.duration || 5000;
    setTimeout(() => {
      toast.style.animation = 'slide-out 0.3s ease-out forwards';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  success(message: string, options?: ToastOptions) {
    this.createToast(message, 'success', options);
  }

  error(message: string, options?: ToastOptions) {
    this.createToast(message, 'error', options);
  }

  warning(message: string, options?: ToastOptions) {
    this.createToast(message, 'warning', options);
  }

  info(message: string, options?: ToastOptions) {
    this.createToast(message, 'info', options);
  }
}

// Export singleton instance
export const toast = new ToastManager();

// Also export as default for compatibility
export default {
  success: (message: string, options?: ToastOptions) => toast.success(message, options),
  error: (message: string, options?: ToastOptions) => toast.error(message, options),
  warning: (message: string, options?: ToastOptions) => toast.warning(message, options),
  info: (message: string, options?: ToastOptions) => toast.info(message, options),
};
