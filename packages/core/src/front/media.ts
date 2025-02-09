import type { types } from "../imports/werift.js";
import { FrontDevice } from "./base.js";
import { createMicOpusRTP } from "./local/mic.js";
import { createOpusSpeaker } from "./local/speaker.js";

export class LocalMediaFrontDevice extends FrontDevice {
  readonly name = "localMedia";
  private speaker = createOpusSpeaker();

  constructor() {
    super();

    const mic = createMicOpusRTP((rtp) => {
      this.onAudio.execute(rtp as types.RtpPacket);
    });
    mic.start();
  }

  handleAudio(rtp: types.RtpPacket) {
    this.speaker.write(rtp.payload);
  }

  handleVideo(rtp: types.RtpPacket) {}

  async handleOffer(sdp: string) {
    // dummy
    return sdp;
  }

  async handleIceCandidate(candidate: any): Promise<any> {}
}
