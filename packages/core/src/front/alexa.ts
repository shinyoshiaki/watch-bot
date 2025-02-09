import { randomUUID } from "crypto";
import {
  MediaStreamTrack,
  RTCPeerConnection,
  type types,
} from "../imports/werift.js";
import { FrontDevice } from "./base.js";

export class AlexaFrontDevice extends FrontDevice {
  static readonly deviceName = "alexa";
  readonly name = randomUUID();
  private readonly track = new MediaStreamTrack({ kind: "audio" });
  private pc!: types.RTCPeerConnection;

  constructor() {
    super();
  }

  private createPc() {
    if (this.pc) {
      this.pc.close();
    }

    this.pc = new RTCPeerConnection({ iceUseLinkLocalAddress: true });
    const transceiver = this.pc.addTransceiver(this.track, {
      direction: "sendrecv",
    });
    transceiver.onTrack.subscribe((track) => {
      track.onReceiveRtp.subscribe((rtp) => {
        rtp.header.marker = true;
        this.onAudio.execute(rtp);
      });
    });
    this.pc.onconnectionstatechange = () => {
      console.log("Alexa Connection state changed to", this.pc.connectionState);
    };
  }

  async handleOffer(sdp: string) {
    this.createPc();

    await this.pc.setRemoteDescription({
      type: "offer",
      sdp,
    });
    const answer = await this.pc.setLocalDescription(
      await this.pc.createAnswer(),
    );
    return { answer: answer.toSdp().sdp };
  }

  handleAudio(rtp: types.RtpPacket) {
    this.track.writeRtp(rtp);
  }

  handleVideo(rtp: types.RtpPacket): void {}

  async handleIceCandidate(candidate: any): Promise<any> {}
}
