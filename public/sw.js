// Service Worker for PWA and Push Notifications
// Enhanced with caching strategies and offline support

const CACHE_NAME = 'webrtc-webpush-v1';
const DATA_CACHE_NAME = 'webrtc-webpush-data-v1';

// Files to cache for offline functionality
const FILES_TO_CACHE = [
    //'/manifest.json',
    '/favicon.ico',
    '/favicon.svg'
    // '/icons/icon-192x192.png',
    // '/icons/icon-512x512.png',
    // '/apple-touch-icon.png'
];

// Send message to all active clients
function sendMessageToClients(message) {
    return clients.matchAll({ includeUncontrolled: true }).then(clientList => {
        clientList.forEach(client => {
            client.postMessage(message);
        });
    });
}

// URLs that should be cached with network-first strategy
const DATA_URLS = [
    //  '/api/user',
    //  '/api/notifications',
    //  //'/notifications/subscribe',
    //  //'/notifications/unsubscribe',
    //  '/notifications/test',
    //  '/login',
    //  '/logout'
];

// Install event - cache app shell
self.addEventListener('install', (event) => {
    console.log('Service Worker installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Caching app shell');
                return cache.addAll(FILES_TO_CACHE);
            })
            .then(() => {
                // Skip waiting to activate immediately
                return self.skipWaiting();
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker activating...');
    
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && cacheName !== DATA_CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            return self.clients.claim();
        })
    );
});


// Push event handler - enhanced for iOS with badge support
self.addEventListener('push', (event) => {
    console.log('Push notification received:', event);
    
    let notificationData = {
        title: 'WebRTC Push',
        body: 'You have a new notification',
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: 'webrtc-notification',
        requireInteraction: false, // iOS prefers false
        silent: false,
        data: {}
    };

    // Parse the push data
    if (event.data) {
        try {
            const data = event.data.json();
            notificationData = {
                ...notificationData,
                ...data,
                // Ensure we have iOS-compatible options
                icon: data.icon || '/favicon.ico',
                badge: data.badge || '/favicon.ico',
                tag: data.tag || 'webrtc-notification',
                data: data.data || {}
            };
        } catch (error) {
            console.error('Error parsing push data:', error);
            notificationData.body = event.data.text();
        }
    }

    // Handle different WebRTC notification types
    if (notificationData.data && notificationData.data.type) {
        switch (notificationData.data.type) {
            case 'webrtc_send_sdp':
                // Incoming call - always show with interaction required
                notificationData.requireInteraction = true;
                notificationData.silent = false;
                notificationData.actions = notificationData.actions || [
                    {
                        action: 'accept_call',
                        title: 'Accept',
                        icon: '/icons/accept-call.png'
                    },
                    {
                        action: 'reject_call',
                        title: 'Decline',
                        icon: '/icons/reject-call.png'
                    }
                ];
                break;
                
            case 'webrtc_receive_sdp':
                // Call answered - normal notification
                notificationData.requireInteraction = false;
                notificationData.silent = false;
                break;
                
            case 'webrtc_ice_candidate':
                // ICE candidate - silent notification
                notificationData.silent = true;
                notificationData.requireInteraction = false;
                // Don't show visual notification for ICE candidates
                sendMessageToClients({
                    type: 'WEBRTC_ICE_CANDIDATE',
                    data: notificationData.data
                });
                return; // Exit early, don't show visual notification
                
            case 'webrtc_call_ended':
                // Call ended - brief notification
                notificationData.requireInteraction = false;
                notificationData.silent = false;
                break;
        }
    }

    // iOS-specific adjustments
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
        // iOS notifications work better with simpler options
        notificationData.requireInteraction = notificationData.data?.type === 'webrtc_send_sdp';
        notificationData.silent = notificationData.data?.type === 'webrtc_ice_candidate';
    }

    // Update PWA badge count if supported
    const badgeCount = notificationData.data.badge || 1;
    updateBadgeCount(badgeCount);

    // Send message to active clients (for foreground notifications)
    sendMessageToClients({
        type: 'PUSH_RECEIVED',
        payload: notificationData
    });

    const promiseChain = self.registration.showNotification(
        notificationData.title,
        {
            body: notificationData.body,
            icon: notificationData.icon,
            badge: notificationData.badge,
            tag: notificationData.tag,
            data: notificationData.data,
            requireInteraction: notificationData.requireInteraction,
            silent: notificationData.silent,
            actions: notificationData.actions || []
        }
    );

    event.waitUntil(promiseChain);
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    console.log('Notification clicked:', event);
    
    event.notification.close();

    // Clear the PWA badge when notification is clicked
    clearBadgeCount();

    // Handle different notification types
    const notificationData = event.notification.data || {};
    let urlToOpen = '/dashboard';

    // Handle WebRTC specific actions
    if (notificationData.type && notificationData.type.startsWith('webrtc_')) {
        switch (notificationData.type) {
            case 'webrtc_send_sdp':
                // Incoming call
                if (event.action === 'accept_call') {
                    urlToOpen = `/call/accept/${notificationData.call_id}`;
                } else if (event.action === 'reject_call') {
                    // Send API request to decline call
                    fetch('/api/webrtc/end-call', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            target_user_id: notificationData.caller_id,
                            call_id: notificationData.call_id,
                            reason: 'declined'
                        })
                    }).catch(err => console.error('Failed to decline call:', err));
                    
                    clearServerBadgeCount();
                    return; // Don't open any window
                } else {
                    urlToOpen = `/call/incoming/${notificationData.call_id}`;
                }
                break;
                
            case 'webrtc_receive_sdp':
                urlToOpen = `/call/active/${notificationData.call_id}`;
                break;
                
            case 'webrtc_call_ended':
                urlToOpen = '/dashboard';
                break;
                
            default:
                urlToOpen = notificationData.url || '/dashboard';
        }
    } else {
        // Handle legacy notification types
        if (notificationData.url) {
            urlToOpen = notificationData.url;
        } else if (notificationData.type === 'money_received') {
            urlToOpen = '/dashboard?tab=transactions';
        } else if (notificationData.type === 'money_request') {
            urlToOpen = '/dashboard?tab=requests';
        }
    }

    const promiseChain = clients.matchAll({
        type: 'window',
        includeUncontrolled: true
    }).then((clientList) => {
        // Check if there's already a window/tab open
        for (let client of clientList) {
            if (client.url.includes(self.location.origin)) {
                client.focus();
                client.navigate(urlToOpen);
                // Clear badge on server when app is opened
                clearServerBadgeCount();
                
                // Send message to client about the notification action
                client.postMessage({
                    type: 'NOTIFICATION_ACTION',
                    action: event.action,
                    data: notificationData
                });
                return;
            }
        }
        
        // If no window is open, open a new one
        return clients.openWindow(urlToOpen).then(() => {
            // Clear badge on server when app is opened
            clearServerBadgeCount();
        });
    });

    event.waitUntil(promiseChain);
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
    console.log('Notification closed:', event);
    // You can track notification dismissals here
});

// Background sync for offline functionality (optional)
self.addEventListener('sync', (event) => {
    if (event.tag === 'background-sync') {
        console.log('Background sync triggered');
        // Handle offline notification queue here if needed
    }
});

// Message handler for communication with main thread
self.addEventListener('message', (event) => {
    console.log('Service Worker received message:', event.data);
    
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

// Duplicate event listeners removed - handled above in WebRTC-specific handlers

// Handle background sync if needed
self.addEventListener('sync', function(event) {
    if (event.tag === 'background-sync') {
        event.waitUntil(doBackgroundSync());
    }
});

function doBackgroundSync() {
    // Implement background sync logic if needed
    return Promise.resolve();
}

// Badge management functions for PWA homescreen icon
function updateBadgeCount(count) {
    // Check if Badge API is supported (mainly for Android Chrome)
    if ('setAppBadge' in navigator) {
        navigator.setAppBadge(count).catch(err => {
            console.log('Error setting app badge:', err);
        });
    }
    
    // Store badge count for unsupported browsers
    try {
        self.caches.open('badge-cache').then(cache => {
            cache.put('/badge-count', new Response(count.toString()));
        });
    } catch (err) {
        console.log('Error caching badge count:', err);
    }
}

function clearBadgeCount() {
    // Clear badge on supported browsers
    if ('clearAppBadge' in navigator) {
        navigator.clearAppBadge().catch(err => {
            console.log('Error clearing app badge:', err);
        });
    }
    
    // Clear cached badge count
    try {
        self.caches.open('badge-cache').then(cache => {
            cache.delete('/badge-count');
        });
    } catch (err) {
        console.log('Error clearing cached badge count:', err);
    }
}

function clearServerBadgeCount() {
    // Clear badge count on the server
    fetch('/notifications/clear-badge', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        },
        credentials: 'same-origin'
    }).then(response => {
        if (response.ok) {
            console.log('Server badge count cleared');
        }
    }).catch(err => {
        console.log('Error clearing server badge count:', err);
    });
}
