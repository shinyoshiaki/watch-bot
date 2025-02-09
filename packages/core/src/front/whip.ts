import {
  MediaStreamTrack,
  RTCPeerConnection,
  type types,
} from "../imports/werift.js";

import type { NegotiationPayloadWhip } from "../schema.js";
import { FrontDevice } from "./base.js";

// whip over websocket
export class WHIPFrontDevice extends FrontDevice {
  static readonly deviceName = "whip";
  readonly name = WHIPFrontDevice.deviceName;
  private track!: types.MediaStreamTrack;
  private pc!: types.RTCPeerConnection;

  constructor() {
    super();
  }

  private createSession() {
    this.pc = new RTCPeerConnection({ iceUseLinkLocalAddress: true });
    this.pc.ontrack = (e) => {
      if (e.track.kind === "audio") {
        e.track.onReceiveRtp.subscribe((rtp) => {
          this.onAudio.execute(rtp);
        });
      }
    };
    this.pc.connectionStateChange.subscribe((state) => {
      console.log(this.name, "connectionStateChange", state);
    });
    this.track = new MediaStreamTrack({ kind: "audio" });
    this.pc.addTrack(this.track);
  }

  handleAudio(rtp: types.RtpPacket) {
    this.track.writeRtp(rtp);
  }

  handleVideo(rtp: types.RtpPacket) {}

  async handleOffer(sdp: string) {
    this.createSession();
    await this.pc.setRemoteDescription({ type: "offer", sdp });
    const answer = await this.pc.setLocalDescription(
      await this.pc.createAnswer(),
    );
    return answer.toSdp().sdp;
  }

  async handleIceCandidate(candidate: NegotiationPayloadWhip): Promise<any> {
    await this.pc.addIceCandidate(candidate);
  }
}
