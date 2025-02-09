import { Event, type types } from "../imports/werift.js";

export abstract class FrontDevice {
  abstract readonly name: string;
  readonly onAudio = new Event<[types.RtpPacket]>();
  readonly onVideo = new Event<[types.RtpPacket]>();
  abstract handleAudio(rtp: types.RtpPacket): void;
  abstract handleVideo(rtp: types.RtpPacket): void;
  abstract handleOffer(sdp: string): Promise<any>;
  abstract handleIceCandidate(candidate: any): Promise<any>;
}
