import type { RtpPacket } from "werift";
import { AccessoryDevice, type VideoCodec } from "./base.js";

export class DebugAccessory extends AccessoryDevice {
  videoCodec: VideoCodec = "vp8";
  audioCodec: "opus";
  handleNegotiation(p: any): Promise<any> {
    return Promise.resolve({});
  }

  id: string;

  get negotiation(): any {
    return {};
  }

  constructor(readonly name: string) {
    super();
  }

  sendAudio(rtp: RtpPacket): void {}

  sendVideo(rtp: RtpPacket): void {}
}
