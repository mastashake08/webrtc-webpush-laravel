<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Notifications\WebRTCReceiveSDPNotification;
use App\Notifications\WebRTCSendSDPNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;

class WebRTCController extends Controller
{
    /**
     * Send an SDP offer to initiate a call
     */
    public function sendOffer(Request $request): JsonResponse
    {
        $request->validate([
            'target_user_id' => 'required|integer|exists:users,id',
            'sdp' => 'required|array',
            'sdp.type' => 'required|string|in:offer',
            'sdp.sdp' => 'required|string',
            'call_type' => 'sometimes|string|in:video,audio,data'
        ]);

        $caller = Auth::user();
        $targetUserId = $request->target_user_id;
        $sdpData = $request->sdp;
        $callType = $request->call_type ?? 'video';

        // Don't allow calling yourself
        if ($caller->id === $targetUserId) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot call yourself'
            ], 400);
        }

        $targetUser = User::find($targetUserId);
        
        if (!$targetUser) {
            return response()->json([
                'success' => false,
                'message' => 'Target user not found'
            ], 404);
        }

        try {
            // Increment badge count for the target user
            $targetUser->incrementBadgeCount();
            Log::info("Badge count incremented for user {$targetUserId}");

            // Send notification to the target user
            Log::info("Sending WebRTC call offer notification", [
                'caller_id' => $caller->id,
                'target_user_id' => $targetUserId,
                'call_type' => $callType,
                'caller_name' => $caller->name
            ]);

            $targetUser->notify(new WebRTCSendSDPNotification($sdpData, $targetUserId, $callType));
            Log::info("WebRTC notification queued successfully");

            Log::info("WebRTC call offer sent", [
                'caller_id' => $caller->id,
                'target_user_id' => $targetUserId,
                'call_type' => $callType
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Call offer sent successfully',
                'caller_name' => $caller->name,
                'target_user_id' => $targetUserId
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to send WebRTC call offer: ' . $e->getMessage(), [
                'caller_id' => $caller->id,
                'target_user_id' => $targetUserId,
                'error' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to send call offer'
            ], 500);
        }
    }

    /**
     * Send an SDP answer to respond to a call
     */
    public function sendAnswer(Request $request): JsonResponse
    {
        $request->validate([
            'caller_user_id' => 'required|integer|exists:users,id',
            'call_id' => 'required|string',
            'sdp' => 'required|array',
            'sdp.type' => 'required|string|in:answer',
            'sdp.sdp' => 'required|string',
            'call_type' => 'sometimes|string|in:video,audio,data'
        ]);

        $responder = Auth::user();
        $callerUserId = $request->caller_user_id;
        $callId = $request->call_id;
        $sdpData = $request->sdp;
        $callType = $request->call_type ?? 'video';

        $callerUser = User::find($callerUserId);
        
        if (!$callerUser) {
            return response()->json([
                'success' => false,
                'message' => 'Caller user not found'
            ], 404);
        }

        try {
            // Increment badge count for the caller
            $callerUser->incrementBadgeCount();

            // Send notification to the original caller
            $callerUser->notify(new WebRTCReceiveSDPNotification($sdpData, $callerUserId, $callType, $callId));

            Log::info("WebRTC call answer sent", [
                'responder_id' => $responder->id,
                'caller_user_id' => $callerUserId,
                'call_id' => $callId,
                'call_type' => $callType
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Call answer sent successfully',
                'responder_name' => $responder->name,
                'call_id' => $callId
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to send WebRTC call answer: ' . $e->getMessage(), [
                'responder_id' => $responder->id,
                'caller_user_id' => $callerUserId,
                'call_id' => $callId,
                'error' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to send call answer'
            ], 500);
        }
    }

    /**
     * Send ICE candidates for WebRTC connection
     */
    public function sendIceCandidate(Request $request): JsonResponse
    {
        $request->validate([
            'target_user_id' => 'required|integer|exists:users,id',
            'call_id' => 'required|string',
            'ice_candidate' => 'required|array',
            'ice_candidate.candidate' => 'required|string',
            'ice_candidate.sdpMid' => 'nullable|string',
            'ice_candidate.sdpMLineIndex' => 'nullable|integer'
        ]);

        $sender = Auth::user();
        $targetUserId = $request->target_user_id;
        $callId = $request->call_id;
        $iceCandidate = $request->ice_candidate;

        $targetUser = User::find($targetUserId);
        
        if (!$targetUser) {
            return response()->json([
                'success' => false,
                'message' => 'Target user not found'
            ], 404);
        }

        try {
            // Send ICE candidate as a simple push notification
            // We'll use the WebPush service directly for this lightweight notification
            $payload = [
                'title' => 'WebRTC Connection',
                'body' => 'Establishing connection...',
                'icon' => '/favicon.ico',
                'badge' => '/favicon.ico',
                'tag' => 'webrtc-ice-' . $callId,
                'silent' => true, // Silent notification for ICE candidates
                'data' => [
                    'type' => 'webrtc_ice_candidate',
                    'call_id' => $callId,
                    'sender_id' => $sender->id,
                    'target_user_id' => $targetUserId,
                    'ice_candidate' => $iceCandidate,
                    'timestamp' => now()->timestamp,
                ]
            ];

            app('App\Services\WebPushService')->sendNotification($targetUser, $payload);

            Log::info("ICE candidate sent", [
                'sender_id' => $sender->id,
                'target_user_id' => $targetUserId,
                'call_id' => $callId
            ]);

            return response()->json([
                'success' => true,
                'message' => 'ICE candidate sent successfully'
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to send ICE candidate: ' . $e->getMessage(), [
                'sender_id' => $sender->id,
                'target_user_id' => $targetUserId,
                'call_id' => $callId,
                'error' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to send ICE candidate'
            ], 500);
        }
    }

    /**
     * End a call and notify participants
     */
    public function endCall(Request $request): JsonResponse
    {
        $request->validate([
            'target_user_id' => 'required|integer|exists:users,id',
            'call_id' => 'required|string',
            'reason' => 'sometimes|string|in:ended,declined,timeout,error'
        ]);

        $user = Auth::user();
        $targetUserId = $request->target_user_id;
        $callId = $request->call_id;
        $reason = $request->reason ?? 'ended';

        $targetUser = User::find($targetUserId);
        
        if (!$targetUser) {
            return response()->json([
                'success' => false,
                'message' => 'Target user not found'
            ], 404);
        }

        try {
            // Send call end notification
            $payload = [
                'title' => 'Call Ended',
                'body' => $this->getEndCallMessage($reason, $user->name),
                'icon' => '/favicon.ico',
                'badge' => '/favicon.ico',
                'tag' => 'webrtc-end-' . $callId,
                'data' => [
                    'type' => 'webrtc_call_ended',
                    'call_id' => $callId,
                    'reason' => $reason,
                    'ended_by_user_id' => $user->id,
                    'ended_by_name' => $user->name,
                    'target_user_id' => $targetUserId,
                    'timestamp' => now()->timestamp,
                ]
            ];

            app('App\Services\WebPushService')->sendNotification($targetUser, $payload);

            Log::info("Call ended", [
                'ended_by_user_id' => $user->id,
                'target_user_id' => $targetUserId,
                'call_id' => $callId,
                'reason' => $reason
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Call ended successfully',
                'reason' => $reason
            ]);

        } catch (\Exception $e) {
            Log::error('Failed to end call: ' . $e->getMessage(), [
                'ended_by_user_id' => $user->id,
                'target_user_id' => $targetUserId,
                'call_id' => $callId,
                'error' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to end call'
            ], 500);
        }
    }

    /**
     * Get appropriate message for call end reason
     */
    private function getEndCallMessage(string $reason, string $userName): string
    {
        return match ($reason) {
            'declined' => "{$userName} declined the call",
            'timeout' => "Call with {$userName} timed out",
            'error' => "Call with {$userName} ended due to an error",
            default => "Call with {$userName} ended"
        };
    }
}