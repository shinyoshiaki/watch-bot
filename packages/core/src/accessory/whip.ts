import { RTCPeerConnection, type types } from "../imports/werift.js";

import type {
  NegotiationPayloadWhip,
  WHIPSensorCredential,
} from "../schema.js";
import { AccessoryDevice as SensorDevice } from "./base.js";

export const setupWHIPSensor = async ({ offer, id }: WHIPSensorCredential) => {
  const sensor = new WHIPSensor({ id, offer });
  await sensor.handleOffer(offer);
  return sensor;
};

export class WHIPSensor extends SensorDevice {
  readonly name: string;
  readonly videoCodec = "vp8";
  private pc!: types.RTCPeerConnection;
  readonly id: string;

  constructor({ id }: WHIPSensorCredential) {
    super();

    this.id = id;
    this.name = "WHIP_" + this.id;
  }

  private createSession() {
    this.pc = new RTCPeerConnection({ iceUseLinkLocalAddress: true });
    this.pc.ontrack = (e) => {
      if (e.track.kind === "audio") {
        e.track.onReceiveRtp.subscribe((rtp) => {
          this.onAudio.execute(rtp);
        });
      }
      if (e.track.kind === "video") {
        e.track.onReceiveRtp.subscribe((rtp) => {
          this.onVideo.execute(rtp);
        });
        e.track.onReceiveRtp.once(() => {
          setInterval(
            () => e.transceiver.receiver.sendRtcpPLI(e.track.ssrc!),
            1000,
          );
        });
      }
    };
    this.pc.connectionStateChange.subscribe((state) => {
      console.log(this.name, "connectionStateChange", state);
    });
  }

  sendAudio(rtp: types.RtpPacket): void {}

  sendVideo(rtp: types.RtpPacket): void {}

  async handleOffer(sdp: string) {
    this.createSession();
    await this.pc.setRemoteDescription({ type: "offer", sdp });
    const answer = await this.pc.setLocalDescription(
      await this.pc.createAnswer(),
    );
    return answer.toSdp().sdp;
  }

  get negotiation() {
    return this.pc.localDescription?.toSdp().sdp;
  }

  async handleNegotiation(candidate: NegotiationPayloadWhip): Promise<any> {
    await this.pc.addIceCandidate(candidate);
  }
}
