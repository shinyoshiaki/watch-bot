import { type Static, Type } from "@sinclair/typebox";
import {
  type SensorAddResponse,
  frontDeviceName,
  googleNestCredentials,
  ringCredentials,
  whipSensorCredential,
} from "./import/core.js";

const sensors = Type.Object({
  nest: googleNestCredentials,
  ring: ringCredentials,
  whip: Type.Array(whipSensorCredential),
});

const functionFrontCall = Type.Object({
  userId: Type.String(),
  name: Type.Optional(Type.String()),
  email: Type.Optional(Type.String()),
  offer: Type.String(),
  sensors: Type.Partial(sensors),
  frontDevice: frontDeviceName,
  token: Type.Optional(Type.String()),
});

export type FunctionFrontCall = Static<typeof functionFrontCall>;

export const functionFrontCallResponseWhip = Type.String({
  description: "SDP Answer",
});

export type FunctionFrontCallResponseWhip = Static<
  typeof functionFrontCallResponseWhip
>;

const functionFrontNegotiation = Type.Object({
  userId: Type.String(),
  payload: Type.Any(),
  token: Type.Optional(Type.String()),
});
export type FunctionFrontNegotiation = Static<typeof functionFrontNegotiation>;

const functionFrontNegotiationPayloadWhip = Type.Object({
  candidate: Type.Optional(Type.String()),
  sdpMLineIndex: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  sdpMid: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  usernameFragment: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});
export type FunctionFrontNegotiationPayloadWhip = Static<
  typeof functionFrontNegotiationPayloadWhip
>;

const functionSensorAdd = Type.Object({
  userId: Type.String(),
  sensor: Type.Partial(sensors),
});
export type FunctionSensorAdd = Static<typeof functionSensorAdd>;
export type FunctionSensorAddResponse = SensorAddResponse[];

const functionSensorNegotiation = Type.Object({
  userId: Type.String(),
  sensorId: Type.String(),
  payload: Type.Any(),
});
export type FunctionSensorNegotiation = Static<
  typeof functionSensorNegotiation
>;
