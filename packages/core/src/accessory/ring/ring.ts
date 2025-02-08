import { RingApi, type RingCamera } from "ring-client-api";
import type { RtpPacket } from "werift";
import { AccessoryDevice } from "../base.js";
import { WeriftPeerConnection } from "./peer.js";

export interface RingCredentials {
  refreshToken: string;
}

export const setupRing = async (cred: RingCredentials) => {
  const ringApi = new RingApi({
    refreshToken: cred.refreshToken,
    debug: true,
  });
  const cameras = await ringApi.getCameras();

  return Promise.all(cameras.map((camera) => Ring.create(camera)));
};

export class Ring extends AccessoryDevice {
  name: string;
  readonly videoCodec = "h264";
  static async create(...args: ConstructorParameters<typeof Ring>) {
    const ring = new Ring(...args);
    await ring.init();
    return ring;
  }

  constructor(private camera: RingCamera) {
    super();
    this.name = "ring-" + camera.name;
  }

  private async init() {
    const pc = new WeriftPeerConnection();
    pc.pc.connectionStateChange.subscribe((state) => {
      console.log(this.name, "connectionStateChange", state);
    });
    pc.onVideoRtp.subscribe((rtp) => {
      this.onVideo.execute(rtp);
    });
    await this.camera.startLiveCall({
      createPeerConnection: () => pc as any,
    });
  }

  sendAudio(rtp: RtpPacket): void {}

  sendVideo(rtp: RtpPacket): void {}
}
