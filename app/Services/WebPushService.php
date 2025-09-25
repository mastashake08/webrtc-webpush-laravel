<?php

namespace App\Services;

use App\Models\PushSubscription;
use App\Models\User;
use Illuminate\Support\Facades\Log;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;

class WebPushService
{
    private WebPush $webPush;

    public function __construct()
    {
        $this->webPush = new WebPush([
            'VAPID' => [
                'subject' => config('app.url'),
                'publicKey' => config('webpush.vapid.public_key'),
                'privateKey' => config('webpush.vapid.private_key'),
            ],
        ]);
    }

    /**
     * Send a push notification to a user
     */
    public function sendNotification(User $user, array $payload): bool
    {
        Log::info("🔧 DEBUG: WebPushService::sendNotification called", [
            'user_id' => $user->id,
            'payload_type' => $payload['data']['type'] ?? 'unknown'
        ]);

        $subscriptions = $user->pushSubscriptions;
        
        Log::info("WebPushService: Attempting to send notification to user {$user->id}", [
            'subscriptions_count' => $subscriptions->count(),
            'payload_type' => $payload['data']['type'] ?? 'unknown'
        ]);

        if ($subscriptions->isEmpty()) {
            Log::warning("🚨 DEBUG: No push subscriptions found for user {$user->id}");
            Log::warning("🚨 DEBUG: User needs to subscribe to push notifications first!");
            return false;
        }

        $success = true;
        $payloadJson = json_encode($payload);
        $payloadSize = strlen($payloadJson);
        
        Log::info("WebPushService: Notification payload", [
            'payload_size_bytes' => $payloadSize,
            'payload_size_limit' => 4078,
            'within_limit' => $payloadSize <= 4078
        ]);
        
        if ($payloadSize > 4078) {
            Log::error("WebPushService: Payload too large", [
                'size' => $payloadSize,
                'limit' => 4078,
                'excess' => $payloadSize - 4078
            ]);
        }

        foreach ($subscriptions as $subscription) {
            try {
                $webPushSubscription = Subscription::create([
                    'endpoint' => $subscription->endpoint,
                    'keys' => [
                        'p256dh' => $subscription->p256dh,
                        'auth' => $subscription->auth,
                    ],
                    'contentEncoding' => $subscription->content_encoding,
                ]);

                $this->webPush->sendOneNotification(
                    $webPushSubscription,
                    $payloadJson
                );

                Log::info("Push notification sent successfully to subscription {$subscription->id}");

            } catch (\Exception $e) {
                Log::error("Failed to send push notification to subscription {$subscription->id}: " . $e->getMessage());
                $success = false;

                // Remove invalid subscriptions
                if (strpos($e->getMessage(), '410') !== false || strpos($e->getMessage(), '404') !== false) {
                    Log::info("Removing invalid subscription {$subscription->id}");
                    $subscription->delete();
                }
            }
        }

        return $success;
    }

    /**
     * Send a notification to multiple users
     */
    public function sendNotificationToUsers(array $userIds, array $payload): array
    {
        $results = [];
        
        foreach ($userIds as $userId) {
            $user = User::find($userId);
            if ($user) {
                $results[$userId] = $this->sendNotification($user, $payload);
            } else {
                $results[$userId] = false;
                Log::warning("User {$userId} not found");
            }
        }

        return $results;
    }

    /**
     * Send bulk notifications efficiently
     */
    public function sendBulkNotifications(array $notifications): array
    {
        $results = [];

        foreach ($notifications as $notification) {
            $subscriptions = collect($notification['subscriptions'] ?? []);
            $payload = json_encode($notification['payload'] ?? []);
            $notificationId = $notification['id'] ?? uniqid();

            foreach ($subscriptions as $subscriptionData) {
                try {
                    $subscription = Subscription::create($subscriptionData);
                    $this->webPush->sendOneNotification($subscription, $payload);
                    
                    $results[$notificationId][] = [
                        'subscription' => $subscriptionData['endpoint'],
                        'success' => true
                    ];
                } catch (\Exception $e) {
                    $results[$notificationId][] = [
                        'subscription' => $subscriptionData['endpoint'],
                        'success' => false,
                        'error' => $e->getMessage()
                    ];
                    
                    Log::error("Bulk notification failed for {$subscriptionData['endpoint']}: " . $e->getMessage());
                }
            }
        }

        return $results;
    }

    /**
     * Get the WebPush instance for advanced usage
     */
    public function getWebPush(): WebPush
    {
        return $this->webPush;
    }
}