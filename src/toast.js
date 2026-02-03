// ============================================================================
// ToastManager - Toast Notifications
// ============================================================================

class ToastManager {
    constructor() {
        this.container = document.getElementById('toastContainer');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toastContainer';
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
    }

    show(message, type = 'info', duration = 3000, title = null) {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        const icon = icons[type] || icons.info;
        
        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <div class="toast-content">
                ${title ? `<div class="toast-title">${this.escapeHtml(title)}</div>` : ''}
                <div class="toast-message">${this.escapeHtml(message)}</div>
            </div>
            <button class="toast-close" aria-label="Close">×</button>
        `;

        this.container.appendChild(toast);

        // Auto remove after duration
        const autoRemove = setTimeout(() => {
            this.remove(toast);
        }, duration);

        // Manual close
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => {
            clearTimeout(autoRemove);
            this.remove(toast);
        });

        // Trigger animation
        requestAnimationFrame(() => {
            toast.style.animation = 'toastSlideIn 0.3s ease-out';
        });

        return toast;
    }

    remove(toast) {
        toast.classList.add('slide-out');
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }

    success(message, title = null, duration = 3000) {
        return this.show(message, 'success', duration, title);
    }

    error(message, title = null, duration = 4000) {
        return this.show(message, 'error', duration, title);
    }

    warning(message, title = null, duration = 3500) {
        return this.show(message, 'warning', duration, title);
    }

    info(message, title = null, duration = 3000) {
        return this.show(message, 'info', duration, title);
    }

    /**
     * Show a toast that stays until close() is called. Use for countdowns.
     * @param {string} message - Initial message
     * @param {string|null} [title=null] - Optional title
     * @returns {{ update: (msg: string) => void, close: () => void }}
     */
    showPersistent(message, title = null) {
        const toast = document.createElement('div');
        toast.className = 'toast info';
        const iconSpan = document.createElement('span');
        iconSpan.className = 'toast-icon';
        iconSpan.textContent = '⏳';
        const content = document.createElement('div');
        content.className = 'toast-content';
        if (title) {
            const titleEl = document.createElement('div');
            titleEl.className = 'toast-title';
            titleEl.textContent = title;
            content.appendChild(titleEl);
        }
        const msgEl = document.createElement('div');
        msgEl.className = 'toast-message';
        msgEl.textContent = message;
        content.appendChild(msgEl);
        const closeBtn = document.createElement('button');
        closeBtn.className = 'toast-close';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.textContent = '×';
        const container = this.container;
        const remove = this.remove.bind(this);
        closeBtn.addEventListener('click', () => remove(toast));
        toast.appendChild(iconSpan);
        toast.appendChild(content);
        toast.appendChild(closeBtn);
        container.appendChild(toast);
        requestAnimationFrame(() => { toast.style.animation = 'toastSlideIn 0.3s ease-out'; });
        return {
            update(msg) {
                msgEl.textContent = msg;
            },
            close() {
                remove(toast);
            }
        };
    }

    escapeHtml(str = '') {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}

export { ToastManager };

