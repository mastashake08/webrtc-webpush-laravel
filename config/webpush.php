<?php

return [
    /*
    |--------------------------------------------------------------------------
    | VAPID Settings
    |--------------------------------------------------------------------------
    |
    | These VAPID keys are used to authenticate push notifications.
    | You should generate these keys and keep them secure.
    |
    */
    'vapid' => [
        'public_key' => env('VAPID_PUBLIC_KEY'),
        'private_key' => env('VAPID_PRIVATE_KEY'),
        'subject' => env('VAPID_SUBJECT', config('app.url')),
    ],

    /*
    |--------------------------------------------------------------------------
    | Push Notification Settings
    |--------------------------------------------------------------------------
    |
    | Configure default settings for push notifications
    |
    */
    'defaults' => [
        'ttl' => env('WEBPUSH_TTL', 2419200), // 4 weeks in seconds
        'urgency' => env('WEBPUSH_URGENCY', 'normal'), // very-low, low, normal, high
        'topic' => env('WEBPUSH_TOPIC', null),
        'batchSize' => env('WEBPUSH_BATCH_SIZE', 1000),
    ],

    /*
    |--------------------------------------------------------------------------
    | WebRTC Specific Settings
    |--------------------------------------------------------------------------
    |
    | Settings specific to WebRTC call notifications
    |
    */
    'webrtc' => [
        'call_timeout' => env('WEBRTC_CALL_TIMEOUT', 60), // seconds
        'max_call_duration' => env('WEBRTC_MAX_CALL_DURATION', 3600), // 1 hour in seconds
        'supported_call_types' => ['video', 'audio', 'data'],
        'auto_cleanup_failed_calls' => env('WEBRTC_AUTO_CLEANUP', true),
    ],

    /*
    |--------------------------------------------------------------------------
    | Notification Icons
    |--------------------------------------------------------------------------
    |
    | Default icons for different types of notifications
    |
    */
    'icons' => [
        'default' => '/favicon.ico',
        'call_incoming' => '/icons/call-incoming.png',
        'call_accepted' => '/icons/call-accepted.png',
        'call_rejected' => '/icons/call-rejected.png',
        'call_ended' => '/icons/call-ended.png',
    ],

    /*
    |--------------------------------------------------------------------------
    | Debug Settings
    |--------------------------------------------------------------------------
    |
    | Enable/disable debug features for push notifications
    |
    */
    'debug' => [
        'log_all_notifications' => env('WEBPUSH_DEBUG_LOG', false),
        'store_failed_notifications' => env('WEBPUSH_STORE_FAILED', true),
        'retry_failed_notifications' => env('WEBPUSH_RETRY_FAILED', true),
        'max_retries' => env('WEBPUSH_MAX_RETRIES', 3),
    ],
];