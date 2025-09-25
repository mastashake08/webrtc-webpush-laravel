<?php

use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\WebRTCController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// Debug endpoint to check authentication and tokens
Route::get('/debug-auth', function (Request $request) {
    $user = $request->user();
    
    // Get XSRF token from cookie for Sanctum
    $xsrfToken = $request->cookie('XSRF-TOKEN');
    
    return response()->json([
        'authenticated' => $user !== null,
        'user_id' => $user?->id,
        'auth_guard' => config('auth.defaults.guard'),
        'session_token' => session()->token(),
        'csrf_token' => csrf_token(),
        'xsrf_cookie' => $xsrfToken ? 'Present' : 'Missing',
        'sanctum_stateful' => config('sanctum.stateful'),
        'current_domain' => $request->getHost(),
        'headers' => [
            'X-CSRF-TOKEN' => $request->header('X-CSRF-TOKEN'),
            'X-XSRF-TOKEN' => $request->header('X-XSRF-TOKEN'),
            'X-Requested-With' => $request->header('X-Requested-With'),
            'Accept' => $request->header('Accept'),
            'Content-Type' => $request->header('Content-Type'),
            'Authorization' => $request->header('Authorization') ? 'Bearer token present' : 'No bearer token',
        ]
    ]);
})->middleware('auth');

// Public test endpoint (no auth required)
Route::get('/test-public', function (Request $request) {
    return response()->json([
        'message' => 'Public API endpoint working',
        'timestamp' => now()->toISOString(),
    ]);
});

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth');

// Test endpoint to verify authentication
Route::get('/auth-test', function (Request $request) {
    $user = $request->user();
    return response()->json([
        'authenticated' => $user !== null,
        'user_id' => $user?->id,
        'user_email' => $user?->email,
        'message' => 'API authentication is working'
    ]);
})->middleware('auth');

Route::middleware(['auth'])->group(function () {
    // Notification endpoints
    Route::get('/notifications/vapid-key', [NotificationController::class, 'getVapidPublicKey']);
    Route::get('/notifications', [NotificationController::class, 'getNotifications']);
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
        Route::get('/get-sdp-data', [WebRTCController::class, 'getSdpData']); // New endpoint to retrieve SDP data
    });
    
    // User badge count
    Route::get('/user/badge-count', function (Request $request) {
        return response()->json([
            'badge_count' => $request->user()->getBadgeCount() ?? 0
        ]);
    });
    
    // Get all users (for user selection in WebRTC calls)
    Route::get('/users', function (Request $request) {
        $users = \App\Models\User::select('id', 'name', 'email')->get();
        return response()->json([
            'users' => $users
        ]);
    });
});