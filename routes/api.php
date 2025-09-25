<?php

use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\WebRTCController;
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
    
    // WebRTC signaling endpoints
    Route::prefix('webrtc')->group(function () {
        Route::post('/send-offer', [WebRTCController::class, 'sendOffer']);
        Route::post('/send-answer', [WebRTCController::class, 'sendAnswer']);
        Route::post('/send-ice-candidate', [WebRTCController::class, 'sendIceCandidate']);
        Route::post('/end-call', [WebRTCController::class, 'endCall']);
    });
    
    // User badge count
    Route::get('/user/badge-count', function (Request $request) {
        return response()->json([
            'badge_count' => $request->user()->getBadgeCount() ?? 0
        ]);
    });
});