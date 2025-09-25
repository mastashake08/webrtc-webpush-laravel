# WebRTC Push Notifications

This system provides Laravel notifications for WebRTC signaling (SDP offers/answers) via push notifications.

## Features

- **WebRTCSendSDPNotification**: Sends SDP offers to initiate WebRTC calls
- **WebRTCReceiveSDPNotification**: Sends SDP answers in response to calls
- **Custom WebPush Channel**: Handles push notification delivery
- **ICE Candidate Support**: Handles WebRTC connection establishment
- **Call Management**: Start, answer, and end calls with proper notifications

## API Endpoints

All endpoints require authentication (`auth:sanctum` middleware).

### Send Call Offer (SDP)

```http
POST /api/webrtc/send-offer
Content-Type: application/json

{
  "target_user_id": 123,
  "sdp": {
    "type": "offer",
    "sdp": "v=0\r\no=alice 2890844526 2890844527 IN IP4 host.atlanta.com\r\n..."
  },
  "call_type": "video"
}
```

### Send Call Answer (SDP)

```http
POST /api/webrtc/send-answer
Content-Type: application/json

{
  "caller_user_id": 456,
  "call_id": "call_unique_identifier",
  "sdp": {
    "type": "answer", 
    "sdp": "v=0\r\no=bob 2890844526 2890844527 IN IP4 host.biloxi.com\r\n..."
  },
  "call_type": "video"
}
```

### Send ICE Candidate

```http
POST /api/webrtc/send-ice-candidate
Content-Type: application/json

{
  "target_user_id": 123,
  "call_id": "call_unique_identifier",
  "ice_candidate": {
    "candidate": "candidate:1 1 UDP 2130706431 192.168.1.100 54400 typ host",
    "sdpMid": "0",
    "sdpMLineIndex": 0
  }
}
```

### End Call

```http
POST /api/webrtc/end-call
Content-Type: application/json

{
  "target_user_id": 123,
  "call_id": "call_unique_identifier",
  "reason": "ended"
}
```

## Push Notification Payloads

### Incoming Call (SDP Offer)

```json
{
  "title": "Incoming Video Call 📹",
  "body": "John Doe is calling you via WebRTC",
  "icon": "/favicon.ico",
  "badge": "/favicon.ico",
  "tag": "webrtc-call-123",
  "requireInteraction": true,
  "actions": [
    {
      "action": "accept_call",
      "title": "Accept",
      "icon": "/icons/accept-call.png"
    },
    {
      "action": "reject_call",
      "title": "Decline", 
      "icon": "/icons/reject-call.png"
    }
  ],
  "data": {
    "type": "webrtc_send_sdp",
    "call_type": "video",
    "caller_id": 456,
    "caller_name": "John Doe",
    "target_user_id": 123,
    "sdp": {
      "type": "offer",
      "sdp": "v=0\r\no=alice..."
    },
    "timestamp": 1632150000,
    "call_id": "call_614a1b2c3d4e5f",
    "url": "/call/incoming/123",
    "badge": 5
  }
}
```

### Call Response (SDP Answer)

```json
{
  "title": "Call Response 📞",
  "body": "Jane Smith responded to your Video call", 
  "data": {
    "type": "webrtc_receive_sdp",
    "call_type": "video",
    "call_id": "call_614a1b2c3d4e5f",
    "caller_user_id": 456,
    "responder_id": 123,
    "responder_name": "Jane Smith",
    "sdp": {
      "type": "answer",
      "sdp": "v=0\r\no=bob..."
    },
    "timestamp": 1632150030,
    "url": "/call/active/call_614a1b2c3d4e5f",
    "badge": 3
  }
}
```

## Usage Examples

### Basic Call Flow

```php
use App\Models\User;
use App\Notifications\WebRTCSendSDPNotification;

// User A wants to call User B
$userA = User::find(1);
$userB = User::find(2);

$sdpOffer = [
    'type' => 'offer',
    'sdp' => 'v=0\r\no=alice 2890844526 2890844527...'
];

// Send notification to User B about incoming call
$userB->notify(new WebRTCSendSDPNotification($sdpOffer, $userB->id, 'video'));
```

### Using the API Controller

```php
// In your frontend JavaScript
const response = await fetch('/api/webrtc/send-offer', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
        'X-CSRF-TOKEN': csrfToken
    },
    body: JSON.stringify({
        target_user_id: 123,
        sdp: {
            type: 'offer',
            sdp: localDescription.sdp
        },
        call_type: 'video'
    })
});
```

### Handling Push Notifications in Service Worker

```javascript
// In your service worker (sw.js)
self.addEventListener('push', (event) => {
    const data = event.data.json();
    
    if (data.data.type === 'webrtc_send_sdp') {
        // Incoming call - show interactive notification
        const options = {
            body: data.body,
            icon: data.icon,
            badge: data.badge,
            tag: data.tag,
            requireInteraction: true,
            actions: data.actions,
            data: data.data
        };
        
        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

self.addEventListener('notificationclick', (event) => {
    const data = event.notification.data;
    
    if (data.type === 'webrtc_send_sdp') {
        if (event.action === 'accept_call') {
            // Handle call acceptance
            event.waitUntil(
                clients.openWindow(`/call/incoming/${data.caller_id}?accept=true`)
            );
        } else if (event.action === 'reject_call') {
            // Handle call rejection
            event.waitUntil(
                fetch('/api/webrtc/end-call', {
                    method: 'POST',
                    body: JSON.stringify({
                        target_user_id: data.caller_id,
                        call_id: data.call_id,
                        reason: 'declined'
                    })
                })
            );
        }
    }
    
    event.notification.close();
});
```

## Configuration

Add these environment variables to your `.env`:

```env
# VAPID Keys (generate with: php artisan webpush:vapid)
VAPID_PUBLIC_KEY=your_vapid_public_key
VAPID_PRIVATE_KEY=your_vapid_private_key
VAPID_SUBJECT=https://yourapp.com

# WebRTC Settings
WEBRTC_CALL_TIMEOUT=60
WEBRTC_MAX_CALL_DURATION=3600
WEBRTC_AUTO_CLEANUP=true

# Push Notification Settings
WEBPUSH_TTL=2419200
WEBPUSH_URGENCY=normal
WEBPUSH_DEBUG_LOG=false
```

## Database Storage

Both notifications also store data in the `notifications` table for persistence and history tracking.

## Badge Management

The system automatically manages notification badge counts:
- Increments when sending notifications
- Accessible via `/api/user/badge-count`
- Clearable via `/api/notifications/clear-badge`

## Error Handling

- Failed push subscriptions are automatically cleaned up
- All actions are logged for debugging
- Proper HTTP status codes returned
- Validation errors clearly communicated

## Security

- All endpoints require authentication
- Users cannot call themselves
- Input validation on all parameters
- Proper error handling without information leakage