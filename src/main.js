// Bootstraps the app and registers the service worker

document.addEventListener('DOMContentLoaded', () => {
    window.appController = new AppController();
});

// Register service worker for PWA with update checking
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Support both root (/) and GitHub Pages subpath (/Fc25-score-keeper/)
        const basePath = window.location.pathname.includes('/Fc25-score-keeper/') ? '/Fc25-score-keeper/' : '/';
        navigator.serviceWorker.register(`${basePath}service-worker.js`, {
            scope: basePath,
            updateViaCache: 'none' // Always check for updates
        })
            .then(reg => {
                console.log('Service Worker registered');
                
                // Check for updates immediately
                reg.update();
                
                // Check for updates periodically (every hour)
                setInterval(() => {
                    reg.update();
                }, 3600000);
                
                // Listen for updates
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    if (newWorker) {
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                // New service worker available
                                console.log('New service worker available');
                                // Show update notification
                                if (confirm('A new version is available! Reload to update?')) {
                                    window.location.reload();
                                }
                            }
                        });
                    }
                });
            })
            .catch(err => console.log('Service Worker registration failed:', err));
        
        // Listen for controller change (service worker updated)
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (!refreshing) {
                refreshing = true;
                console.log('Service worker updated, reloading page...');
                window.location.reload();
            }
        });
    });
}

