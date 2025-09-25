<?php

namespace App\Notifications;

use App\Contracts\WebPushNotification;
use App\Notifications\Channels\WebPushChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\DatabaseMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\Log;

class WebRTCSendSDPNotification extends Notification implements ShouldQueue, WebPushNotification
{
    use Queueable;

    private int $sessionId;
    private int $callerId;
    private string $callerName;
    private string $callType;

    /**
     * Create a new notification instance.
     *
     * @param int $sessionId The WebRTC session ID containing SDP data
     * @param int $callerId The user making the call
     * @param string $callerName The name of the caller
     * @param string $callType Type of call (video, audio, data)
     */
    public function __construct(int $sessionId, int $callerId, string $callerName, string $callType = 'video')
    {
        $this->sessionId = $sessionId;
        $this->callerId = $callerId;
        $this->callerName = $callerName;
        $this->callType = $callType;
    }

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return [WebPushChannel::class, 'database'];
    }

    /**
     * Get the WebPush representation of the notification.
     *
     * @return array<string, mixed>
     */
    public function toWebPush(object $notifiable): array
    {
        $callTypeDisplay = ucfirst($this->callType);
        
        return [
            'title' => "Incoming {$callTypeDisplay} Call 📹",
            'body' => "{$this->callerName} is calling you via WebRTC",
            'icon' => '/favicon.ico',
            'badge' => '/favicon.ico',
            'tag' => 'webrtc-call-' . $this->callerId,
            'requireInteraction' => true, // Keep notification visible until user interacts
            'actions' => [
                [
                    'action' => 'accept_call',
                    'title' => 'Accept',
                    'icon' => '/icons/accept-call.png'
                ],
                [
                    'action' => 'reject_call', 
                    'title' => 'Decline',
                    'icon' => '/icons/reject-call.png'
                ]
            ],
            'data' => [
                'type' => 'webrtc_send_sdp',
                'call_type' => $this->callType,
                'caller_id' => $this->callerId,
                'caller_name' => $this->callerName,
                'target_user_id' => $notifiable->id,
                'session_id' => $this->sessionId, // Send session ID instead of SDP data
                'timestamp' => now()->timestamp,
                'url' => '/call/incoming/' . $notifiable->id,
                'badge' => $notifiable->getBadgeCount(),
            ]
        ];
    }

    /**
     * Get the database representation of the notification.
     *
     * @return DatabaseMessage
     */
    public function toDatabase(object $notifiable): DatabaseMessage
    {
        return new DatabaseMessage([
            'title' => 'Incoming WebRTC Call',
            'message' => "You have an incoming {$this->callType} call from {$this->callerName}",
            'type' => 'webrtc_send_sdp',
            'call_type' => $this->callType,
            'caller_id' => $this->callerId,
            'caller_name' => $this->callerName,
            'target_user_id' => $notifiable->id,
            'session_id' => $this->sessionId, // Store session ID instead of SDP data
            'timestamp' => now()->timestamp,
        ]);
    }

    /**
     * Get the array representation of the notification.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return $this->toDatabase($notifiable)->data;
    }
}