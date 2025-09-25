<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PushSubscription;
use App\Services\WebPushService;
use Faker\Generator as Faker;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class NotificationController extends Controller
{
    public function __construct(private WebPushService $webPushService)
    {
    }

    public function getVapidPublicKey(): JsonResponse
    {
        $publicKey = config('webpush.vapid.public_key');
        Log::info('Serving VAPID public key to frontend: ' . $publicKey);
        
        return response()->json([
            'public_key' => $publicKey
        ]);
    }

    public function subscribe(Request $request): JsonResponse
    {
        try {
            $request->validate([
                'endpoint' => 'required|url',
                'keys.p256dh' => 'required|string',
                'keys.auth' => 'required|string',
            ]);

            $user = Auth::user();
            
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not authenticated',
                ], 401);
            }
            
            $subscription = PushSubscription::updateOrCreate(
                [
                    'user_id' => $user->id,
                    'endpoint' => $request->endpoint,
                ],
                [
                    'p256dh' => $request->input('keys.p256dh'),
                    'auth' => $request->input('keys.auth'),
                    'user_agent' => $request->userAgent(),
                    'content_encoding' => 'aesgcm',
                ]
            );

            return response()->json([
                'success' => true,
                'message' => 'Push notification subscription saved successfully',
                'subscription_id' => $subscription->id,
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid subscription data',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            Log::error('Failed to save push subscription: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Failed to save subscription: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function unsubscribe(Request $request): JsonResponse
    {
        $request->validate([
            'endpoint' => 'required|url',
        ]);

        $user = Auth::user();
        
        $deleted = PushSubscription::where('user_id', $user->id)
            ->where('endpoint', $request->endpoint)
            ->delete();

        return response()->json([
            'success' => true,
            'message' => $deleted ? 'Subscription removed successfully' : 'Subscription not found',
        ]);
    }

    public function testNotification(Request $request): JsonResponse
    {
        $user = Auth::user();

        // Increment badge count before sending notification
        $user->incrementBadgeCount();

        // Use Faker to generate random username and dollar amount
        // $faker = app(Faker::class);
        $randomUsername ="$"."test";
        $randomAmount = random_int(5, 500); // Whole numbers between $5 and $500
        
        $payload = [
            'title' => 'Money Received 💰',
            'body' => "$randomUsername sent $" . number_format($randomAmount, 2),
            'icon' => 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Square_Cash_app_logo.svg/1200px-Square_Cash_app_logo.svg.png',
            'badge' => 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c5/Square_Cash_app_logo.svg/1200px-Square_Cash_app_logo.svg.png',
            'data' => [
                'type' => 'payment_received',
                'amount' => $randomAmount,
                'from' => $randomUsername,
                'url' => '/dashboard',
                'badge' => $user->getBadgeCount() // Include current badge count
            ]
        ];

        $success = $this->webPushService->sendNotification($user, $payload);

        return response()->json([
            'success' => $success,
            'message' => $success ? 'Test notification sent successfully' : 'Failed to send test notification',
            'badge_count' => $user->getBadgeCount(),
        ]);
    }

    public function clearBadge(Request $request)
    {
        $user = Auth::user();
        $user->clearBadgeCount();

        return response()->json([
            'success' => true,
            'message' => 'Badge count cleared',
            'badge_count' => 0,
        ]);
    }
}