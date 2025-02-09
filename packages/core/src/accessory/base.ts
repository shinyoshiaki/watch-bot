import {
  Event,
  EventDisposer,
  MediaRecorder,
  MediaStreamTrack,
  type types,
  useH264,
  useOPUS,
  useVP8,
} from "../imports/werift.js";

export type VideoCodec = "vp8" | "h264";

export abstract class AccessoryDevice {
  abstract readonly id: string;
  abstract readonly name: string;
  abstract videoCodec: VideoCodec;
  readonly audioCodec: "opus";
  readonly onAudio = new Event<[types.RtpPacket]>();
  readonly onVideo = new Event<[types.RtpPacket]>();
  abstract sendAudio(rtp: types.RtpPacket): void;
  abstract sendVideo(rtp: types.RtpPacket): void;
  abstract get negotiation(): any;
  abstract handleNegotiation(p: any): Promise<any>;

  recording({
    duration,
    path,
  }: {
    /**ms */
    duration: number;
    path: string;
  }) {
    const disposer = new EventDisposer();
    const audio = new MediaStreamTrack({ kind: "audio", codec: useOPUS() });
    const video = new MediaStreamTrack({
      kind: "video",
      codec: this.videoCodec === "h264" ? useH264() : useVP8(),
    });

    this.onAudio
      .subscribe((rtp) => {
        audio.writeRtp(rtp);
      })
      .disposer(disposer);
    this.onVideo
      .subscribe((rtp) => {
        video.writeRtp(rtp);
      })
      .disposer(disposer);
    const recorder = new MediaRecorder({
      path,
      tracks: [audio, video],
      disableNtp: true,
      disableLipSync: true,
    });
    setTimeout(() => {
      disposer.dispose();
      recorder.stop().catch(console.error);
    }, duration);
  }
}
