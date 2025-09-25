# WebRTC Push Notifications - Deployment Checklist

## ✅ Pre-Deployment Checklist

### Environment Setup
- [ ] PHP 8.2+ installed on server
- [ ] Node.js 18+ installed
- [ ] Database (MySQL/PostgreSQL) configured
- [ ] SSL certificate installed (HTTPS required for WebRTC)
- [ ] Domain name configured

### Laravel Configuration
- [ ] `.env` file configured for production
- [ ] `APP_ENV=production` set
- [ ] `APP_DEBUG=false` set
- [ ] Database credentials configured
- [ ] VAPID keys generated and configured
- [ ] Application key generated (`php artisan key:generate`)

### Build & Optimization
- [ ] Dependencies installed (`composer install --no-dev --optimize-autoloader`)
- [ ] Assets built (`npm run build`)
- [ ] Configuration cached (`php artisan config:cache`)
- [ ] Routes cached (`php artisan route:cache`)
- [ ] Views cached (`php artisan view:cache`)

### Database & Storage
- [ ] Migrations run (`php artisan migrate --force`)
- [ ] Storage directories writable
- [ ] Log directory writable
- [ ] Queue worker configured (if using queues)

### PWA & WebRTC
- [ ] Service worker accessible at `/sw.js`
- [ ] Manifest file accessible at `/manifest.json`  
- [ ] PWA icons uploaded to `/public/icons/`
- [ ] HTTPS working correctly
- [ ] WebRTC permissions testing completed

### Security
- [ ] VAPID keys secure and unique for production
- [ ] CSRF protection enabled
- [ ] Rate limiting configured
- [ ] Input validation implemented
- [ ] Authentication middleware applied

### Testing
- [ ] All automated tests passing
- [ ] Manual testing completed across browsers
- [ ] Push notifications working
- [ ] WebRTC calling functionality verified
- [ ] PWA install working on mobile devices

## 🚀 Deployment Steps

### 1. Server Setup
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install PHP 8.2+ with required extensions
sudo apt install php8.2 php8.2-fpm php8.2-mysql php8.2-xml php8.2-mbstring php8.2-curl php8.2-zip

# Install Composer
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

### 2. Application Deployment
```bash
# Clone repository
git clone <your-repo-url> /var/www/webrtc-push
cd /var/www/webrtc-push

# Install dependencies
composer install --no-dev --optimize-autoloader
npm install
npm run build

# Set permissions
sudo chown -R www-data:www-data storage bootstrap/cache
sudo chmod -R 775 storage bootstrap/cache

# Configure environment
cp .env.example .env
# Edit .env with production settings
php artisan key:generate
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

### 3. Web Server Configuration

#### Nginx Configuration
```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    root /var/www/webrtc-push/public;

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    
    # PWA headers
    add_header Service-Worker-Allowed "/";
    
    index index.php;

    charset utf-8;

    # SSL Configuration
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Service Worker
    location /sw.js {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
        add_header Service-Worker-Allowed "/";
    }

    # Manifest
    location /manifest.json {
        add_header Cache-Control "public, max-age=86400";
    }

    # Static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }

    error_page 404 /index.php;

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
```

### 4. SSL Certificate (Let's Encrypt)
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Generate certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

### 5. Process Management
```bash
# Install Supervisor for queue workers
sudo apt install supervisor

# Create supervisor configuration
sudo nano /etc/supervisor/conf.d/webrtc-push-worker.conf
```

Supervisor configuration:
```ini
[program:webrtc-push-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/webrtc-push/artisan queue:work --sleep=3 --tries=3
autostart=true
autorestart=true
user=www-data
numprocs=2
redirect_stderr=true
stdout_logfile=/var/www/webrtc-push/storage/logs/worker.log
```

```bash
# Start supervisor
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start webrtc-push-worker:*
```

## 🔍 Post-Deployment Testing

### 1. Basic Functionality
```bash
# Test homepage
curl -I https://yourdomain.com

# Test API endpoint
curl https://yourdomain.com/api/notifications/vapid-key

# Test service worker
curl -I https://yourdomain.com/sw.js

# Test manifest
curl -I https://yourdomain.com/manifest.json
```

### 2. WebRTC Testing
- [ ] Open dashboard in multiple browsers/devices
- [ ] Test cross-browser compatibility (Chrome, Firefox, Safari, Edge)
- [ ] Test mobile device compatibility (iOS Safari, Chrome Mobile)
- [ ] Verify camera/microphone permissions work
- [ ] Test call initiation and receiving
- [ ] Verify push notifications arrive on all devices

### 3. PWA Testing
- [ ] Install PWA on mobile device
- [ ] Test offline functionality
- [ ] Verify service worker registration
- [ ] Test notification badges
- [ ] Check app icon displays correctly

### 4. Performance Testing
```bash
# Test with Apache Bench
ab -n 100 -c 10 https://yourdomain.com/

# Monitor server resources
htop
iotop
```

## 🚨 Monitoring & Maintenance

### Log Monitoring
```bash
# Laravel application logs
tail -f /var/www/webrtc-push/storage/logs/laravel.log

# Nginx access logs
tail -f /var/log/nginx/access.log

# Nginx error logs
tail -f /var/log/nginx/error.log

# System logs
journalctl -f
```

### Automated Backups
```bash
# Create backup script
nano /home/backup/webrtc-backup.sh
```

Backup script:
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/backup"
APP_DIR="/var/www/webrtc-push"

# Database backup
mysqldump -u username -ppassword webrtc_push > $BACKUP_DIR/database_$DATE.sql

# Application backup
tar -czf $BACKUP_DIR/app_$DATE.tar.gz -C /var/www webrtc-push

# Clean old backups (keep last 7 days)
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
```

```bash
# Make executable and add to crontab
chmod +x /home/backup/webrtc-backup.sh
crontab -e
# Add: 0 2 * * * /home/backup/webrtc-backup.sh
```

### Health Monitoring
Create a health check endpoint and monitor it:
```bash
# Add to routes/web.php
Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'timestamp' => now(),
        'services' => [
            'database' => DB::connection()->getPdo() ? 'ok' : 'error',
            'queue' => 'ok', // Add queue health check
        ]
    ]);
});
```

## 🔧 Troubleshooting Common Issues

### SSL Issues
```bash
# Test SSL configuration
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com

# Verify certificate
curl -I https://yourdomain.com
```

### WebRTC Connection Issues
- Check firewall rules for UDP traffic
- Verify STUN/TURN server configuration
- Test from different networks
- Check browser console for errors

### Service Worker Issues
- Clear browser cache and service worker
- Check service worker registration in DevTools
- Verify service worker file is accessible
- Check HTTPS configuration

### Performance Issues
```bash
# Check disk space
df -h

# Check memory usage
free -m

# Check CPU usage
top

# Check database performance
mysql -e "SHOW PROCESSLIST;"
```

## 📞 Support & Maintenance

### Regular Maintenance Tasks
- [ ] Update SSL certificates (quarterly)
- [ ] Update dependencies (monthly)
- [ ] Review logs for errors (weekly)
- [ ] Database optimization (monthly)
- [ ] Security updates (as needed)
- [ ] Backup verification (weekly)

### Emergency Contacts
- System Administrator: [email/phone]
- Database Administrator: [email/phone]
- Developer Team: [email/phone]
- Hosting Provider: [email/phone]

### Documentation Links
- [Production Server Access](internal-link)
- [Database Credentials](secure-location)
- [VAPID Keys Location](secure-location)
- [Monitoring Dashboard](monitoring-url)

---

**Last Updated:** [Current Date]
**Deployed By:** [Your Name]
**Environment:** Production
**Version:** 1.0.0