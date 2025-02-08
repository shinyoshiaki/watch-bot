import * as google from "googleapis";
import {
  RTCPeerConnection,
  RTCRtpCodecParameters,
  type RtpPacket,
} from "werift";
import { AccessoryDevice } from "./base.js";

export interface GoogleNestCredentials {
  clientId: string;
  clientSecret: string;
  projectId: string;
  refreshToken: string;
}

export const setupGoogleNest = async ({
  clientId,
  clientSecret,
  projectId,
  refreshToken,
}: GoogleNestCredentials) => {
  const oauth2Client = new google.Auth.OAuth2Client(clientId, clientSecret);

  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });
  const smartdevicemanagement =
    new google.smartdevicemanagement_v1.Smartdevicemanagement({
      auth: oauth2Client,
    });

  const response = await smartdevicemanagement.enterprises.devices.list({
    parent: `enterprises/${projectId}`,
  });

  return Promise.all(
    (response.data.devices ?? []).map(async (device) => {
      return await GoogleNest.create({ device, smartdevicemanagement });
    }),
  ).catch((e) => {
    throw e;
  });
};

export class GoogleNest extends AccessoryDevice {
  readonly name: string;
  readonly videoCodec: "vp8" | "h264" = "h264";

  private readonly pc = new RTCPeerConnection({
    bundlePolicy: "max-bundle",
    codecs: {
      audio: [
        new RTCRtpCodecParameters({
          mimeType: "audio/opus",
          clockRate: 48000,
          channels: 2,
        }),
      ],
      video: [
        new RTCRtpCodecParameters({
          mimeType: "video/H264",
          clockRate: 90000,
          rtcpFeedback: [
            { type: "transport-cc" },
            { type: "ccm", parameter: "fir" },
            { type: "nack" },
            { type: "nack", parameter: "pli" },
            { type: "goog-remb" },
          ],
          parameters:
            "level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f",
        }),
      ],
    },
  });

  static async create(...args: ConstructorParameters<typeof GoogleNest>) {
    const nest = new GoogleNest(...args);
    await nest.init();
    return nest;
  }

  constructor(
    private props: {
      device: google.smartdevicemanagement_v1.Schema$GoogleHomeEnterpriseSdmV1Device;
      smartdevicemanagement: google.smartdevicemanagement_v1.Smartdevicemanagement;
    },
  ) {
    super();

    this.name = "nest" + props.device.parentRelations?.[0].displayName;

    this.pc.connectionStateChange.subscribe((state) => {
      console.log(this.name, "connectionStateChange", state);
    });

    const audioTransceiver = this.pc.addTransceiver("audio", {
      direction: "recvonly",
    });
    audioTransceiver.onTrack.subscribe((track) => {
      track.onReceiveRtp.subscribe((rtp) => {
        this.onAudio.execute(rtp);
      });
    });

    const videoTransceiver = this.pc.addTransceiver("video", {
      direction: "recvonly",
    });
    videoTransceiver.onTrack.subscribe((track) => {
      track.onReceiveRtp.subscribe((rtp) => {
        this.onVideo.execute(rtp);
      });
      track.onReceiveRtp.once(() => {
        setInterval(
          () => videoTransceiver.receiver.sendRtcpPLI(track.ssrc!),
          1000,
        );
      });
    });

    this.pc.createDataChannel("dataSendChannel", { id: 1 });
  }

  private async init() {
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    const response =
      await this.props.smartdevicemanagement.enterprises.devices.executeCommand(
        {
          name: this.props.device.name!,
          requestBody: {
            command:
              "sdm.devices.commands.CameraLiveStream.GenerateWebRtcStream",
            params: {
              offerSdp: offer.sdp,
            },
          },
        },
      );

    const answerSdp = response.data.results!.answerSdp;

    await this.pc.setRemoteDescription({
      type: "answer",
      sdp: answerSdp,
    });
  }

  sendAudio(rtp: RtpPacket): void {}

  sendVideo(rtp: RtpPacket): void {}
}
