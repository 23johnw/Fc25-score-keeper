// ============================================================================
// TouchSwipeHandler - Mobile Swipe Gesture Detection
// ============================================================================

class TouchSwipeHandler {
    constructor() {
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchEndX = 0;
        this.touchEndY = 0;
        this.minSwipeDistance = 50; // Minimum distance for a swipe
        this.maxVerticalDistance = 100; // Maximum vertical movement for horizontal swipe
        this.swipeThreshold = 30; // Minimum horizontal movement to trigger swipe
    }

    /**
     * Initialize swipe detection on an element
     * @param {HTMLElement} element - Element to attach swipe detection to
     * @param {Object} callbacks - Object with onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown callbacks
     */
    attach(element, callbacks = {}) {
        if (!element) return;

        element.addEventListener('touchstart', (e) => {
            this.touchStartX = e.changedTouches[0].screenX;
            this.touchStartY = e.changedTouches[0].screenY;
        }, { passive: true });

        element.addEventListener('touchend', (e) => {
            this.touchEndX = e.changedTouches[0].screenX;
            this.touchEndY = e.changedTouches[0].screenY;
            this.handleSwipe(callbacks);
        }, { passive: true });
    }

    handleSwipe(callbacks) {
        const deltaX = this.touchEndX - this.touchStartX;
        const deltaY = this.touchEndY - this.touchStartY;
        const absDeltaX = Math.abs(deltaX);
        const absDeltaY = Math.abs(deltaY);

        // Check if it's a valid swipe (horizontal movement is dominant)
        if (absDeltaX < this.minSwipeDistance || absDeltaY > this.maxVerticalDistance) {
            return;
        }

        // Determine swipe direction
        if (absDeltaX > absDeltaY) {
            // Horizontal swipe
            if (deltaX > this.swipeThreshold && callbacks.onSwipeRight) {
                callbacks.onSwipeRight();
            } else if (deltaX < -this.swipeThreshold && callbacks.onSwipeLeft) {
                callbacks.onSwipeLeft();
            }
        } else {
            // Vertical swipe
            if (deltaY > this.swipeThreshold && callbacks.onSwipeDown) {
                callbacks.onSwipeDown();
            } else if (deltaY < -this.swipeThreshold && callbacks.onSwipeUp) {
                callbacks.onSwipeUp();
            }
        }
    }

    /**
     * Attach swipe-to-delete functionality to match history items
     * @param {HTMLElement} item - Match history item element
     * @param {Function} deleteCallback - Function to call when delete is confirmed
     */
    attachSwipeToDelete(item, deleteCallback) {
        if (!item || !deleteCallback) return;

        let startX = 0;
        let startY = 0;
        let currentX = 0;
        let currentY = 0;
        let isSwipeActive = false;
        const deleteThreshold = 140; // Distance to swipe before showing delete option
        const maxVerticalDrift = 70;

        item.style.position = 'relative';
        item.style.transition = 'transform 0.3s ease-out';
        item.style.overflow = 'hidden';

        const deleteButton = document.createElement('button');
        deleteButton.className = 'swipe-delete-btn';
        deleteButton.textContent = 'Delete';
        deleteButton.style.cssText = `
            position: absolute;
            right: 0;
            top: 0;
            bottom: 0;
            background-color: #f44336;
            color: white;
            border: none;
            padding: 0 1.5rem;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            min-width: 100px;
            min-height: 44px;
            opacity: 0;
            transform: translateX(100%);
            transition: opacity 0.3s, transform 0.3s;
            z-index: 10;
        `;

        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Delete this match? This cannot be undone.')) {
                deleteCallback();
            }
            resetPosition();
        });

        item.appendChild(deleteButton);

        const resetPosition = () => {
            item.style.transform = 'translateX(0)';
            deleteButton.style.opacity = '0';
            deleteButton.style.transform = 'translateX(100%)';
            isSwipeActive = false;
            startX = 0;
            currentX = 0;
        };

        item.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            isSwipeActive = true;
        }, { passive: true });

        item.addEventListener('touchmove', (e) => {
            if (!isSwipeActive) return;
            currentX = e.touches[0].clientX;
            currentY = e.touches[0].clientY;
            const deltaX = currentX - startX;
            const deltaY = currentY - startY;

            if (Math.abs(deltaY) > maxVerticalDrift) {
                resetPosition();
                return;
            }

            // Only allow swiping left (negative deltaX)
            if (deltaX < 0) {
                const swipeDistance = Math.abs(deltaX);
                item.style.transform = `translateX(${deltaX}px)`;
                
                if (swipeDistance >= deleteThreshold) {
                    deleteButton.style.opacity = '1';
                    deleteButton.style.transform = 'translateX(0)';
                } else {
                    deleteButton.style.opacity = '0';
                    deleteButton.style.transform = 'translateX(100%)';
                }
            }
        }, { passive: true });

        item.addEventListener('touchend', () => {
            if (!isSwipeActive) return;
            const deltaX = Math.abs(currentX - startX);
            const deltaY = Math.abs(currentY - startY);

            if (deltaX < deleteThreshold || deltaY > maxVerticalDrift) {
                resetPosition();
            } else {
                // Lock in the delete button position
                item.style.transform = `translateX(-${deleteThreshold}px)`;
                deleteButton.style.opacity = '1';
                deleteButton.style.transform = 'translateX(0)';
            }
            isSwipeActive = false;
        }, { passive: true });

        // Reset on click outside
        document.addEventListener('click', (e) => {
            if (!item.contains(e.target) && !deleteButton.contains(e.target)) {
                resetPosition();
            }
        });
    }

    /**
     * Attach pull-to-refresh functionality to an element
     * @param {HTMLElement} element - Element to attach pull-to-refresh to
     * @param {Function} refreshCallback - Function to call when refresh is triggered
     */
    attachPullToRefresh(element, refreshCallback) {
        if (!element || !refreshCallback) return;

        let startY = 0;
        let currentY = 0;
        let isPullActive = false;
        let pullDistance = 0;
        const minPullDistance = 40; // Minimum distance before showing indicator
        const pullThreshold = 120; // Increased threshold - distance to pull before triggering refresh
        const maxPullDistance = 150; // Maximum pull distance
        let lastScrollTop = 0;

        // Create refresh indicator
        const refreshIndicator = document.createElement('div');
        refreshIndicator.className = 'pull-to-refresh-indicator';
        refreshIndicator.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 60px;
            display: flex;
            align-items: center;
            justify-content: center;
            background-color: var(--primary-color, #2196F3);
            color: white;
            font-size: 0.9rem;
            transform: translateY(-100%);
            transition: transform 0.3s ease;
            z-index: 1000;
            pointer-events: none;
        `;
        refreshIndicator.innerHTML = '<span>⬇️ Pull to refresh</span>';

        // Ensure element has relative positioning
        const originalPosition = window.getComputedStyle(element).position;
        if (originalPosition === 'static') {
            element.style.position = 'relative';
        }

        element.insertBefore(refreshIndicator, element.firstChild);

        const resetPull = () => {
            element.style.transform = '';
            refreshIndicator.style.transform = 'translateY(-100%)';
            refreshIndicator.innerHTML = '<span>⬇️ Pull to refresh</span>';
            refreshIndicator.style.backgroundColor = 'var(--primary-color, #2196F3)';
            pullDistance = 0;
            isPullActive = false;
            startY = 0;
            currentY = 0;
        };

        element.addEventListener('touchstart', (e) => {
            // Store the scroll position to check later
            lastScrollTop = element.scrollTop || 0;
            // Only allow pull-to-refresh if at the very top (within 5px tolerance)
            if (lastScrollTop <= 5) {
                startY = e.touches[0].clientY;
                isPullActive = false; // Don't activate until minimum pull distance
            } else {
                isPullActive = false;
            }
        }, { passive: true });

        element.addEventListener('touchmove', (e) => {
            // Check if we're still at the top
            const currentScrollTop = element.scrollTop || 0;
            
            // If scrolled down, cancel pull
            if (currentScrollTop > 5) {
                resetPull();
                return;
            }

            if (!startY) return; // No touch start recorded

            currentY = e.touches[0].clientY;
            const deltaY = currentY - startY;

            // Only allow pulling down (positive deltaY) and only if at the top
            if (deltaY > 0 && currentScrollTop <= 5) {
                // Require minimum pull before activating
                if (deltaY < minPullDistance) {
                    return; // Don't show anything until minimum pull
                }

                // Activate pull mode once minimum distance reached
                if (!isPullActive && deltaY >= minPullDistance) {
                    isPullActive = true;
                }

                if (isPullActive) {
                    // Apply resistance - make it harder to pull (elastic effect)
                    const resistance = 0.6; // Resistance factor
                    pullDistance = Math.min(deltaY * resistance, maxPullDistance);
                    
                    // Apply pull effect
                    element.style.transform = `translateY(${pullDistance}px)`;
                    refreshIndicator.style.transform = `translateY(${-60 + pullDistance}px)`;

                    // Update indicator text
                    if (pullDistance >= pullThreshold) {
                        refreshIndicator.innerHTML = '<span>⬆️ Release to refresh</span>';
                        refreshIndicator.style.backgroundColor = 'var(--success-color, #4CAF50)';
                    } else {
                        refreshIndicator.innerHTML = '<span>⬇️ Pull to refresh</span>';
                        refreshIndicator.style.backgroundColor = 'var(--primary-color, #2196F3)';
                    }

                    // Prevent default scrolling while pulling past minimum
                    e.preventDefault();
                }
            } else if (deltaY < 0 && isPullActive) {
                // User is scrolling back up - cancel pull
                resetPull();
            }
        }, { passive: false });

        element.addEventListener('touchend', () => {
            if (!isPullActive) {
                // Reset if we didn't activate
                startY = 0;
                currentY = 0;
                return;
            }

            // Only trigger if we exceeded threshold
            if (pullDistance >= pullThreshold) {
                // Trigger refresh
                refreshIndicator.innerHTML = '<span>🔄 Refreshing...</span>';
                refreshIndicator.style.backgroundColor = 'var(--primary-color, #2196F3)';
                
                // Call refresh callback
                refreshCallback(() => {
                    // Callback when refresh is done
                    setTimeout(() => {
                        resetPull();
                    }, 300);
                });
            } else {
                resetPull();
            }

            isPullActive = false;
            startY = 0;
            currentY = 0;
        }, { passive: true });
    }
}

export { TouchSwipeHandler };

