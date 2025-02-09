// export * from "../../../../submodules/werift/packages/webrtc/src/index.js";
// export * from "../../../../submodules/werift/packages/webrtc/src/nonstandard/index.js";

import { createRequire } from "module";
import type * as types from "../../../../submodules/werift/packages/webrtc/src/index.js";
import type * as nonstandard from "../../../../submodules/werift/packages/webrtc/src/nonstandard/index.js";

const require = createRequire(import.meta.url);

const {
  MediaStreamTrack,
  RTCPeerConnection,
  useOPUS,
  useVP8,
  randomPort,
  IceCandidate,
  Event,
  RtpBuilder,
  EventDisposer,
  useH264,
  RTCRtpCodecParameters,
} =
  require("../../../../submodules/werift/packages/webrtc/src/index.js") as typeof types;
const { navigator, MediaRecorder } =
  require("../../../../submodules/werift/packages/webrtc/src/nonstandard/index.js") as typeof nonstandard;

export {
  MediaStreamTrack,
  EventDisposer,
  useH264,
  RTCPeerConnection,
  useOPUS,
  useVP8,
  RtpBuilder,
  randomPort,
  MediaRecorder,
  navigator,
  type types,
  IceCandidate,
  Event,
  RTCRtpCodecParameters,
};
