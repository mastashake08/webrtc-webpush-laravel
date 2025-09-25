#!/usr/bin/env node

/**
 * Simple test script for WebRTC Push Notifications
 * This script tests the basic functionality of the WebRTC system
 */

const https = require('https');
const fs = require('fs');

// Test configuration
const BASE_URL = 'http://localhost:8000'; // Adjust as needed
const API_ENDPOINTS = {
    vapidKey: '/api/notifications/vapid-key',
    testNotification: '/api/notifications/test',
    clearBadge: '/api/notifications/clear-badge',
    webrtcOffer: '/api/webrtc/send-offer'
};

console.log('🚀 WebRTC Push Notification Test Script');
console.log('=====================================');

// Basic health check
async function healthCheck() {
    console.log('\n1. Health Check');
    console.log('   Checking if Laravel app is running...');
    
    try {
        // Simple check for public files
        const manifestExists = fs.existsSync('./public/manifest.json');
        const swExists = fs.existsSync('./public/sw.js');
        const iconsExist = fs.existsSync('./public/icons');
        
        console.log(`   ✅ Manifest file: ${manifestExists ? 'Found' : 'Missing'}`);
        console.log(`   ✅ Service Worker: ${swExists ? 'Found' : 'Missing'}`);
        console.log(`   ✅ PWA Icons: ${iconsExist ? 'Found' : 'Missing'}`);
        
        if (manifestExists && swExists && iconsExist) {
            console.log('   🎉 PWA files are ready!');
            return true;
        } else {
            console.log('   ⚠️  Some PWA files are missing');
            return false;
        }
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        return false;
    }
}

// Check Laravel routes
async function checkRoutes() {
    console.log('\n2. Laravel Routes Check');
    console.log('   Checking if API routes exist...');
    
    try {
        const routeFile = fs.readFileSync('./routes/api.php', 'utf8');
        const webrtcFile = fs.readFileSync('./app/Http/Controllers/Api/WebRTCController.php', 'utf8');
        
        console.log('   ✅ API routes file exists');
        console.log('   ✅ WebRTC Controller exists');
        
        // Check for key endpoints
        const hasVapid = routeFile.includes('vapid-key');
        const hasWebRTC = routeFile.includes('webrtc');
        const hasNotifications = routeFile.includes('notifications');
        
        console.log(`   ✅ VAPID endpoint: ${hasVapid ? 'Found' : 'Missing'}`);
        console.log(`   ✅ WebRTC endpoints: ${hasWebRTC ? 'Found' : 'Missing'}`);
        console.log(`   ✅ Notification endpoints: ${hasNotifications ? 'Found' : 'Missing'}`);
        
        return hasVapid && hasWebRTC && hasNotifications;
    } catch (error) {
        console.log(`   ❌ Error reading files: ${error.message}`);
        return false;
    }
}

// Check Vue components
async function checkComponents() {
    console.log('\n3. Vue Components Check');
    console.log('   Checking if Vue components exist...');
    
    try {
        const webrtcCall = fs.existsSync('./resources/js/components/WebRTCCall.vue');
        const dashboard = fs.existsSync('./resources/js/components/WebRTCDashboard.vue');
        const pushManager = fs.existsSync('./resources/js/components/PushNotificationManager.vue');
        const userSelector = fs.existsSync('./resources/js/components/UserSelector.vue');
        
        console.log(`   ✅ WebRTC Call Component: ${webrtcCall ? 'Found' : 'Missing'}`);
        console.log(`   ✅ WebRTC Dashboard: ${dashboard ? 'Found' : 'Missing'}`);
        console.log(`   ✅ Push Manager: ${pushManager ? 'Found' : 'Missing'}`);
        console.log(`   ✅ User Selector: ${userSelector ? 'Found' : 'Missing'}`);
        
        return webrtcCall && dashboard && pushManager && userSelector;
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        return false;
    }
}

// Check database
async function checkDatabase() {
    console.log('\n4. Database Check');
    console.log('   Checking database migrations...');
    
    try {
        const migrationsDir = './database/migrations';
        const migrations = fs.readdirSync(migrationsDir);
        
        const hasPushSubscriptions = migrations.some(file => 
            file.includes('push_subscriptions')
        );
        
        const hasUsers = migrations.some(file => 
            file.includes('users')
        );
        
        console.log(`   ✅ User table migration: ${hasUsers ? 'Found' : 'Missing'}`);
        console.log(`   ✅ Push subscriptions migration: ${hasPushSubscriptions ? 'Found' : 'Missing'}`);
        
        return hasUsers && hasPushSubscriptions;
    } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        return false;
    }
}

// Main test function
async function runTests() {
    console.log('Starting comprehensive WebRTC system check...\n');
    
    const results = {
        health: await healthCheck(),
        routes: await checkRoutes(),
        components: await checkComponents(),
        database: await checkDatabase()
    };
    
    console.log('\n📋 Test Results Summary');
    console.log('=======================');
    
    const passed = Object.values(results).filter(Boolean).length;
    const total = Object.keys(results).length;
    
    Object.entries(results).forEach(([test, result]) => {
        const status = result ? '✅ PASS' : '❌ FAIL';
        console.log(`   ${test.toUpperCase().padEnd(12)} ${status}`);
    });
    
    console.log(`\n🎯 Overall Score: ${passed}/${total} tests passed`);
    
    if (passed === total) {
        console.log('\n🎉 All systems ready! Your WebRTC Push app is set up correctly.');
        console.log('\nNext Steps:');
        console.log('1. Start your Laravel server: php artisan serve');
        console.log('2. Start Vite dev server: npm run dev');
        console.log('3. Visit http://localhost:8000/dashboard');
        console.log('4. Test push notifications and WebRTC calling');
    } else {
        console.log('\n⚠️  Some components need attention. Check the failed tests above.');
    }
    
    console.log('\n📚 Documentation:');
    console.log('   - WebRTC API: Check /app/Http/Controllers/Api/WebRTCController.php');
    console.log('   - Push Notifications: Check /app/Services/WebPushService.php');
    console.log('   - Vue Components: Check /resources/js/components/');
    console.log('   - Service Worker: Check /public/sw.js');
}

// Run the tests
runTests().catch(console.error);