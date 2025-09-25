<?php

namespace App\Notifications;

use App\Contracts\WebPushNotification;
use App\Notifications\Channels\WebPushChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\DatabaseMessage;
use Illuminate\Notifications\Notification;

class WebRTCSendSDPNotification extends Notification implements ShouldQueue, WebPushNotification
{
    use Queueable;

    private array $sdpData;
    private int $targetUserId;
    private string $callType;

    /**
     * Create a new notification instance.
     *
     * @param array $sdpData The SDP offer/answer data
     * @param int $targetUserId The user receiving the SDP
     * @param string $callType Type of call (video, audio, data)
     */
    public function __construct(array $sdpData, int $targetUserId, string $callType = 'video')
    {
        $this->sdpData = $sdpData;
        $this->targetUserId = $targetUserId;
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
        $callerName = $notifiable->name ?? 'Someone';
        $callTypeDisplay = ucfirst($this->callType);
        
        return [
            'title' => "Incoming {$callTypeDisplay} Call 📹",
            'body' => "{$callerName} is calling you via WebRTC",
            'icon' => '/favicon.ico',
            'badge' => '/favicon.ico',
            'tag' => 'webrtc-call-' . $this->targetUserId,
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
                'caller_id' => $notifiable->id,
                'caller_name' => $callerName,
                'target_user_id' => $this->targetUserId,
                'sdp' => $this->sdpData,
                'timestamp' => now()->timestamp,
                'call_id' => uniqid('call_', true),
                'url' => '/call/incoming/' . $this->targetUserId,
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
            'message' => "You have an incoming {$this->callType} call from {$notifiable->name}",
            'type' => 'webrtc_send_sdp',
            'call_type' => $this->callType,
            'caller_id' => $notifiable->id,
            'caller_name' => $notifiable->name,
            'target_user_id' => $this->targetUserId,
            'sdp_data' => $this->sdpData,
            'call_id' => uniqid('call_', true),
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