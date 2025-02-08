import type { RtpPacket } from "werift";
import { FrontDevice } from "./base.js";
import { createMicOpusRTP } from "./local/mic.js";
import { createOpusSpeaker } from "./local/speaker.js";

export class LocalMediaFrontDevice extends FrontDevice {
  readonly name = "localMedia";
  private speaker = createOpusSpeaker();

  constructor() {
    super();

    const mic = createMicOpusRTP((rtp) => {
      this.onAudio.execute(rtp);
    });
    mic.start();
  }

  handleAudio(rtp: RtpPacket) {
    this.speaker.write(rtp.payload);
  }

  handleVideo(rtp: RtpPacket) {}

  async handleOffer(sdp: string) {
    // dummy
    return sdp;
  }

  async handleIceCandidate(candidate: any): Promise<any> {}
}
