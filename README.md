# WebRTC Push Notifications System

A comprehensive WebRTC calling system with push notifications built on Laravel, Vue.js, and Inertia.js.

## 🚀 Features

### WebRTC Functionality
- **Peer-to-peer video/audio calls** with WebRTC API
- **Real-time signaling** through Laravel backend
- **ICE candidate exchange** for optimal connectivity
- **Call management** (start, answer, decline, end)
- **Media controls** (mute/unmute audio/video)

### Push Notifications
- **Web Push API** integration with VAPID keys
- **Service Worker** for background notifications
- **PWA support** with manifest and offline capabilities
- **Badge counting** with server-side synchronization
- **Interactive notifications** (Accept/Decline call actions)

### User Interface
- **Vue 3 Composition API** with TypeScript
- **Responsive design** with Tailwind CSS
- **Real-time user selection** for initiating calls
- **Dashboard integration** with notification management
- **Toast notifications** for system feedback

## 📋 System Requirements

- **PHP 8.2+** with Laravel 11+
- **Node.js 18+** with npm/yarn
- **MySQL/PostgreSQL/SQLite** database
- **HTTPS** (required for WebRTC and Push API)
- **Modern browser** with WebRTC support

## 🛠 Installation & Setup

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone https://github.com/mastashake08/webrtc-webpush-laravel.git
cd webrtc-webpush-laravel

# Install PHP dependencies
composer install

# Install JavaScript dependencies
npm install
```

### 2. Environment Configuration

```bash
# Copy environment file
cp .env.example .env

# Generate application key
php artisan key:generate
```

### 3. Database Setup

```bash
# Run migrations
php artisan migrate

# (Optional) Seed test data
php artisan db:seed
```

### 4. VAPID Keys for Push Notifications

Generate VAPID keys for web push notifications:

```bash
# Generate VAPID keys (you can use web-push library)
npx web-push generate-vapid-keys
```

Add to your `.env` file:

```env
WEBPUSH_VAPID_PUBLIC_KEY=your_public_key_here
WEBPUSH_VAPID_PRIVATE_KEY=your_private_key_here
WEBPUSH_VAPID_SUBJECT=mailto:your-email@example.com
```

### 5. Start Development Servers

```bash
# Terminal 1: Laravel server
php artisan serve

# Terminal 2: Vite dev server
npm run dev
```

Visit `http://localhost:8000/dashboard` to access the application.

## 🏗 Architecture Overview

### Backend Components

#### 1. WebRTC Controller (`app/Http/Controllers/Api/WebRTCController.php`)
Handles WebRTC signaling:
- `sendOffer()` - Send call offers with SDP
- `sendAnswer()` - Send call answers with SDP  
- `sendIceCandidate()` - Exchange ICE candidates
- `endCall()` - Terminate active calls

#### 2. Notification System
- **WebRTCSendSDPNotification** - Incoming call notifications
- **WebRTCReceiveSDPNotification** - Call answer confirmations
- **WebPushService** - Core push notification service
- **WebPushChannel** - Custom notification channel

#### 3. Models
- **User** - Extended with badge count methods
- **PushSubscription** - Web push subscription storage

### Frontend Components

#### 1. Vue Components (`resources/js/components/`)
- **WebRTCCall.vue** - Main calling interface
- **WebRTCDashboard.vue** - Dashboard integration
- **PushNotificationManager.vue** - Subscription management
- **UserSelector.vue** - User selection for calls

#### 2. Service Worker (`public/sw.js`)
- Push notification handling
- WebRTC-specific notification actions
- PWA caching strategies
- Background sync capabilities

#### 3. PWA Configuration
- **Manifest** (`public/manifest.json`) - PWA metadata
- **Icons** (`public/icons/`) - App icons for different sizes
- **Service Worker** registration in app layout

## 🔧 API Endpoints

### WebRTC Signaling
```
POST /api/webrtc/send-offer
POST /api/webrtc/send-answer  
POST /api/webrtc/send-ice-candidate
POST /api/webrtc/end-call
```

### Push Notifications
```
GET  /api/notifications/vapid-key
POST /api/notifications/subscribe
POST /api/notifications/unsubscribe
POST /api/notifications/test
POST /api/notifications/clear-badge
```

### User Management
```
GET /api/user
GET /api/user/badge-count
```

## 🧪 Testing

### Run Test Suite
```bash
# Run all tests
php artisan test

# Run specific test file
php artisan test tests/Feature/WebRTCNotificationTest.php

# Run with coverage
php artisan test --coverage
```

### Manual Testing Workflow

1. **Setup Two Users**
   ```bash
   # Create test users
   php artisan tinker
   User::factory()->create(['email' => 'user1@example.com']);
   User::factory()->create(['email' => 'user2@example.com']);
   ```

2. **Test Push Notifications**
   - Register service worker in browser
   - Subscribe to push notifications
   - Send test notification
   - Verify badge count updates

3. **Test WebRTC Calling**
   - Open dashboard in two browser tabs
   - Login as different users
   - Initiate call from one tab
   - Accept/decline from notification
   - Test audio/video controls

### Browser Testing Checklist

- [ ] Service worker registers successfully
- [ ] Push notifications permission granted
- [ ] WebRTC permissions (camera/microphone) granted
- [ ] Peer connection establishes
- [ ] Audio/video streams working
- [ ] Call controls functional
- [ ] Notification actions work (Accept/Decline)
- [ ] Badge count updates correctly
- [ ] PWA install prompt appears

## 🔐 Security Considerations

### HTTPS Requirements
```nginx
# Nginx configuration example
server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### VAPID Key Security
- Store VAPID keys securely in environment variables
- Use different keys for development/production
- Rotate keys periodically for security

### WebRTC Security
- Implement proper user authentication
- Validate all signaling messages
- Use TURN servers for NAT traversal in production
- Implement call recording permissions

## 🚀 Production Deployment

### 1. Build Assets
```bash
npm run build
```

### 2. Optimize Laravel
```bash
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

### 3. SSL Certificate
Ensure HTTPS is configured for:
- WebRTC functionality
- Service Worker registration
- Push API access

### 4. Environment Variables
```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://yourdomain.com

# Database
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=webrtc_push
DB_USERNAME=username
DB_PASSWORD=password

# VAPID Keys
WEBPUSH_VAPID_PUBLIC_KEY=your_production_public_key
WEBPUSH_VAPID_PRIVATE_KEY=your_production_private_key
WEBPUSH_VAPID_SUBJECT=mailto:admin@yourdomain.com
```

### 5. Queue Configuration
For production, use a proper queue driver:

```env
QUEUE_CONNECTION=redis
```

```bash
# Start queue worker
php artisan queue:work --daemon
```

## 🔧 Troubleshooting

### Common Issues

#### 1. Service Worker Not Registering
- Verify HTTPS is enabled
- Check browser console for errors
- Ensure `/sw.js` is accessible

#### 2. Push Notifications Not Working
- Verify VAPID keys are correct
- Check browser permissions
- Ensure subscription endpoint is valid

#### 3. WebRTC Connection Fails
- Check browser permissions for camera/microphone
- Verify STUN/TURN server configuration
- Test with different network configurations

#### 4. TypeScript Errors
```bash
# Fix Vue component types
npm run type-check

# Rebuild with type checking
npm run build -- --mode development
```

### Debug Commands

```bash
# Check Laravel logs
tail -f storage/logs/laravel.log

# Test push notification service
php artisan tinker
$user = User::first();
$service = new App\Services\WebPushService();
$service->sendNotification($user, ['title' => 'Test', 'body' => 'Testing']);

# Clear all caches
php artisan optimize:clear
```

## 📚 Resources

### Documentation
- [WebRTC API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Web Push Protocol](https://developers.google.com/web/fundamentals/push-notifications)
- [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Laravel Broadcasting](https://laravel.com/docs/broadcasting)

### Tools
- [web-push library](https://github.com/web-push-libs/web-push) - Generate VAPID keys
- [WebRTC samples](https://webrtc.github.io/samples/) - Test WebRTC functionality
- [Chrome DevTools](https://developers.google.com/web/tools/chrome-devtools) - Debug service workers

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

## 🙏 Acknowledgments

- Laravel team for the amazing framework
- Vue.js team for the reactive framework
- WebRTC community for excellent documentation
- Inertia.js for seamless SPA experience