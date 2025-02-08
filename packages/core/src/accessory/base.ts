import {
  Event,
  EventDisposer,
  MediaStreamTrack,
  type RtpPacket,
  useH264,
  useOPUS,
  useVP8,
} from "werift";
import { MediaRecorder } from "werift/nonstandard";

export type VideoCodec = "vp8" | "h264";

export abstract class AccessoryDevice {
  abstract readonly name: string;
  abstract videoCodec: VideoCodec;
  readonly audioCodec: "opus";
  readonly onAudio = new Event<[RtpPacket]>();
  readonly onVideo = new Event<[RtpPacket]>();

  abstract sendAudio(rtp: RtpPacket): void;

  abstract sendVideo(rtp: RtpPacket): void;

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
