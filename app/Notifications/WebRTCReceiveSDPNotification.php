<?php

namespace App\Notifications;

use App\Contracts\WebPushNotification;
use App\Notifications\Channels\WebPushChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\DatabaseMessage;
use Illuminate\Notifications\Notification;

class WebRTCReceiveSDPNotification extends Notification implements ShouldQueue, WebPushNotification
{
    use Queueable;

    private array $sdpData;
    private int $callerUserId;
    private string $callType;
    private string $callId;

    /**
     * Create a new notification instance.
     *
     * @param array $sdpData The SDP answer/response data
     * @param int $callerUserId The user who initiated the call
     * @param string $callType Type of call (video, audio, data)
     * @param string $callId Unique identifier for the call session
     */
    public function __construct(array $sdpData, int $callerUserId, string $callType = 'video', string $callId = null)
    {
        $this->sdpData = $sdpData;
        $this->callerUserId = $callerUserId;
        $this->callType = $callType;
        $this->callId = $callId ?? uniqid('call_', true);
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
        $responderName = $notifiable->name ?? 'Someone';
        $callTypeDisplay = ucfirst($this->callType);
        
        return [
            'title' => "Call Response 📞",
            'body' => "{$responderName} responded to your {$callTypeDisplay} call",
            'icon' => '/favicon.ico',
            'badge' => '/favicon.ico',
            'tag' => 'webrtc-response-' . $this->callId,
            'requireInteraction' => false,
            'silent' => false,
            'data' => [
                'type' => 'webrtc_receive_sdp',
                'call_type' => $this->callType,
                'call_id' => $this->callId,
                'caller_user_id' => $this->callerUserId,
                'responder_id' => $notifiable->id,
                'responder_name' => $responderName,
                'sdp' => $this->sdpData,
                'timestamp' => now()->timestamp,
                'url' => '/call/active/' . $this->callId,
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
            'title' => 'Call Response Received',
            'message' => "{$notifiable->name} responded to your {$this->callType} call",
            'type' => 'webrtc_receive_sdp',
            'call_type' => $this->callType,
            'call_id' => $this->callId,
            'caller_user_id' => $this->callerUserId,
            'responder_id' => $notifiable->id,
            'responder_name' => $notifiable->name,
            'sdp_data' => $this->sdpData,
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