<?php

use App\Http\Controllers\Api\NotificationController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');

Route::middleware(['auth:sanctum'])->group(function () {
    // Notification endpoints
    Route::get('/notifications/vapid-key', [NotificationController::class, 'getVapidPublicKey']);
    Route::post('/notifications/subscribe', [NotificationController::class, 'subscribe']);
    Route::post('/notifications/unsubscribe', [NotificationController::class, 'unsubscribe']);
    Route::post('/notifications/test', [NotificationController::class, 'testNotification']);
    Route::post('/notifications/clear-badge', [NotificationController::class, 'clearBadge']);
    
    // User badge count
    Route::get('/user/badge-count', function (Request $request) {
        return response()->json([
            'badge_count' => $request->user()->getBadgeCount() ?? 0
        ]);
    });
});