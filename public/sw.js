// Service Worker for PWA and Push Notifications
// Enhanced with caching strategies and offline support

const CACHE_NAME = 'webrtc-webpush-v5.7';
const DATA_CACHE_NAME = 'webrtc-webpush-data-v5.7';

// Files to cache for offline functionality
const FILES_TO_CACHE = [
    //'/manifest.json',
    '/favicon.ico',
    '/favicon.svg',
     '/icons/icon-192x192.png',
     '/icons/icon-512x512.png',
     '/apple-touch-icon.png',
     '/icons/accept-call.png',
     '/icons/reject-call.png'
];

// Send message to all active clients
async function sendMessageToClients(message) {
    const clientList = await clients.matchAll({ 
        includeUncontrolled: true,
        type: 'window'
    });
    
    console.log('📞 SW: Sending message to', clientList.length, 'clients:', message);
    
    clientList.forEach(client => {
        client.postMessage(message);
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
    console.log('📨 SW: Push notification received:', event);
    
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
            console.log('📨 SW: Parsed push data:', data);
            notificationData = {
                ...notificationData,
                ...data,
                // Ensure we have iOS-compatible options
                icon: data.icon || '/favicon.ico',
                badge: data.badge || '/favicon.ico',
                tag: data.tag || 'webrtc-notification',
                data: data.data || {}
            };
            console.log('📨 SW: Final notification data:', notificationData);
        } catch (error) {
            console.error('❌ SW: Error parsing push data:', error);
            notificationData.body = event.data.text();
        }
    }

    // Handle different WebRTC notification types
    if (notificationData.data && notificationData.data.type) {
        console.log('📞 SW: Handling WebRTC notification type:', notificationData.data.type);
        switch (notificationData.data.type) {
            case 'webrtc_send_sdp':
                console.log('📞 SW: Processing incoming call with session ID:', notificationData.data.session_id);
                
                // Validate required data for incoming calls
                if (!notificationData.data.session_id) {
                    console.error('❌ SW: Missing session_id for incoming call!');
                    return;
                }
                
                // Send normal incoming call message to clients with validated data
                console.log('📞 SW: Sending incoming call data to clients:', notificationData.data);
                sendMessageToClients({
                    type: 'WEBRTC_INCOMING_CALL',
                    data: {
                        session_id: notificationData.data.session_id,
                        caller_id: notificationData.data.caller_id,
                        caller_name: notificationData.data.caller_name || 'Unknown Caller',
                        call_type: notificationData.data.call_type || 'video',
                        call_id: notificationData.data.call_id
                    }
                });
                
                // Show incoming call notification with action buttons
                notificationData.title = '📞 Incoming Call';
                notificationData.body = `${notificationData.data.caller_name || 'Unknown'} is calling you`;
                notificationData.requireInteraction = true;
                notificationData.silent = false;
                notificationData.actions = [
                    {
                        action: 'accept_call',
                        title: '✅ Accept',
                        icon: '/icons/accept-call.png'
                    },
                    {
                        action: 'reject_call',
                        title: '❌ Decline',
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
                // Incoming call notification clicked
                console.log('📞 SW: Incoming call notification clicked, action:', event.action);
                console.log('📞 SW: Notification data:', notificationData);
                
                if (event.action === 'accept_call') {
                    console.log('📞 SW: User clicked ACCEPT on notification');
                    
                    // Send message to dashboard to accept the call
                    sendMessageToClients({
                        type: 'NOTIFICATION_ACCEPT_CALL',
                        data: {
                            session_id: notificationData.session_id,
                            caller_id: notificationData.caller_id,
                            caller_name: notificationData.caller_name,
                            call_id: notificationData.call_id,
                            call_type: notificationData.call_type
                        }
                    });
                    
                    // Open dashboard to show the call interface
                    urlToOpen = '/dashboard';
                    
                } else if (event.action === 'reject_call') {
                    console.log('📞 SW: User clicked DECLINE on notification');
                    
                    // Send API request to decline call
                    fetch('/api/webrtc/end-call', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            target_user_id: notificationData.caller_id,
                            call_id: notificationData.call_id || notificationData.session_id,
                            reason: 'declined'
                        })
                    }).catch(err => console.error('Failed to decline call:', err));
                    
                    // Send message to clients to clear call UI
                    sendMessageToClients({
                        type: 'NOTIFICATION_DECLINE_CALL',
                        data: {
                            session_id: notificationData.session_id,
                            call_id: notificationData.call_id
                        }
                    });
                    
                    clearServerBadgeCount();
                    return; // Don't open any window
                } else {
                    // Default click (not on action buttons) - open dashboard
                    console.log('📞 SW: Notification clicked without specific action, opening dashboard');
                    urlToOpen = '/dashboard';
                }
                break;
                
            case 'webrtc_receive_sdp':
                urlToOpen = `/call/active/${notificationData.session_id}`;
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
