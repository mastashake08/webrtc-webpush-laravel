<?php

namespace Tests\Feature;

use App\Models\User;
use App\Notifications\WebRTCReceiveSDPNotification;
use App\Notifications\WebRTCSendSDPNotification;
use App\Services\WebPushService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class WebRTCNotificationTest extends TestCase
{
    use RefreshDatabase;

    public function test_can_send_webrtc_offer_notification()
    {
        Notification::fake();

        $caller = User::factory()->create(['name' => 'John Doe']);
        $target = User::factory()->create(['name' => 'Jane Smith']);

        $sdpData = [
            'type' => 'offer',
            'sdp' => 'v=0\r\no=alice 2890844526 2890844527 IN IP4 host.atlanta.com\r\n...'
        ];

        $target->notify(new WebRTCSendSDPNotification($sdpData, $target->id, 'video'));

        Notification::assertSentTo($target, WebRTCSendSDPNotification::class);
    }

    public function test_can_send_webrtc_answer_notification()
    {
        Notification::fake();

        $caller = User::factory()->create(['name' => 'John Doe']);
        $responder = User::factory()->create(['name' => 'Jane Smith']);

        $sdpData = [
            'type' => 'answer',
            'sdp' => 'v=0\r\no=bob 2890844526 2890844527 IN IP4 host.biloxi.com\r\n...'
        ];

        $callId = 'call_test_123';

        $caller->notify(new WebRTCReceiveSDPNotification($sdpData, $caller->id, 'video', $callId));

        Notification::assertSentTo($caller, WebRTCReceiveSDPNotification::class);
    }

    public function test_webrtc_send_offer_api_endpoint()
    {
        $caller = User::factory()->create();
        $target = User::factory()->create();

        $this->actingAs($caller, 'sanctum');

        $response = $this->postJson('/api/webrtc/send-offer', [
            'target_user_id' => $target->id,
            'sdp' => [
                'type' => 'offer',
                'sdp' => 'v=0\r\no=alice 2890844526 2890844527 IN IP4 host.atlanta.com\r\n...'
            ],
            'call_type' => 'video'
        ]);

        $response->assertStatus(200)
                 ->assertJson([
                     'success' => true,
                     'message' => 'Call offer sent successfully'
                 ]);
    }

    public function test_webrtc_send_answer_api_endpoint()
    {
        $caller = User::factory()->create();
        $responder = User::factory()->create();

        $this->actingAs($responder, 'sanctum');

        $response = $this->postJson('/api/webrtc/send-answer', [
            'caller_user_id' => $caller->id,
            'call_id' => 'call_test_123',
            'sdp' => [
                'type' => 'answer',
                'sdp' => 'v=0\r\no=bob 2890844526 2890844527 IN IP4 host.biloxi.com\r\n...'
            ],
            'call_type' => 'video'
        ]);

        $response->assertStatus(200)
                 ->assertJson([
                     'success' => true,
                     'message' => 'Call answer sent successfully'
                 ]);
    }

    public function test_cannot_call_yourself()
    {
        $user = User::factory()->create();

        $this->actingAs($user, 'sanctum');

        $response = $this->postJson('/api/webrtc/send-offer', [
            'target_user_id' => $user->id,
            'sdp' => [
                'type' => 'offer',
                'sdp' => 'v=0\r\no=alice 2890844526 2890844527 IN IP4 host.atlanta.com\r\n...'
            ],
            'call_type' => 'video'
        ]);

        $response->assertStatus(400)
                 ->assertJson([
                     'success' => false,
                     'message' => 'Cannot call yourself'
                 ]);
    }

    public function test_webrtc_send_ice_candidate_api_endpoint()
    {
        $sender = User::factory()->create();
        $target = User::factory()->create();

        $this->actingAs($sender, 'sanctum');

        $response = $this->postJson('/api/webrtc/send-ice-candidate', [
            'target_user_id' => $target->id,
            'call_id' => 'call_test_123',
            'ice_candidate' => [
                'candidate' => 'candidate:1 1 UDP 2130706431 192.168.1.100 54400 typ host',
                'sdpMid' => '0',
                'sdpMLineIndex' => 0
            ]
        ]);

        $response->assertStatus(200)
                 ->assertJson([
                     'success' => true,
                     'message' => 'ICE candidate sent successfully'
                 ]);
    }

    public function test_webrtc_end_call_api_endpoint()
    {
        $user = User::factory()->create();
        $target = User::factory()->create();

        $this->actingAs($user, 'sanctum');

        $response = $this->postJson('/api/webrtc/end-call', [
            'target_user_id' => $target->id,
            'call_id' => 'call_test_123',
            'reason' => 'ended'
        ]);

        $response->assertStatus(200)
                 ->assertJson([
                     'success' => true,
                     'message' => 'Call ended successfully'
                 ]);
    }

    public function test_webpush_service_can_be_resolved()
    {
        $service = app(WebPushService::class);
        
        $this->assertInstanceOf(WebPushService::class, $service);
    }

    public function test_notification_includes_correct_data_structure()
    {
        $caller = User::factory()->create(['name' => 'John Doe']);
        $target = User::factory()->create(['name' => 'Jane Smith']);

        $sdpData = [
            'type' => 'offer',
            'sdp' => 'test-sdp-string'
        ];

        $notification = new WebRTCSendSDPNotification($sdpData, $target->id, 'video');
        $webPushData = $notification->toWebPush($caller);

        $this->assertArrayHasKey('title', $webPushData);
        $this->assertArrayHasKey('body', $webPushData);
        $this->assertArrayHasKey('data', $webPushData);
        $this->assertEquals('webrtc_send_sdp', $webPushData['data']['type']);
        $this->assertEquals('video', $webPushData['data']['call_type']);
        $this->assertEquals($caller->id, $webPushData['data']['caller_id']);
        $this->assertEquals($target->id, $webPushData['data']['target_user_id']);
        $this->assertEquals($sdpData, $webPushData['data']['sdp']);
    }
}