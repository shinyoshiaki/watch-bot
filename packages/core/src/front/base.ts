import { Event, type RtpPacket } from "werift";

export abstract class FrontDevice {
  abstract readonly name: string;
  readonly onAudio = new Event<[RtpPacket]>();
  readonly onVideo = new Event<[RtpPacket]>();
  abstract handleAudio(rtp: RtpPacket): void;
  abstract handleVideo(rtp: RtpPacket): void;
  abstract handleOffer(sdp: string): Promise<any>;
  abstract handleIceCandidate(candidate: any): Promise<any>;
}
