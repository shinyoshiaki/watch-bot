import { type Static, Type } from "@sinclair/typebox";

export const googleNestCredentials = Type.Object({
  clientId: Type.String(),
  clientSecret: Type.String(),
  refreshToken: Type.String(),
  projectId: Type.String(),
});

export const ringCredentials = Type.Object({
  refreshToken: Type.String(),
});

export const whipSensorCredential = Type.Object({
  id: Type.String(),
  offer: Type.String(),
});
export type WHIPSensorCredential = Static<typeof whipSensorCredential>;

export const frontDeviceName = Type.Union([
  Type.Literal("whip"),
  Type.Literal("alexa"),
]);
export type FrontDeviceName = Static<typeof frontDeviceName>;

const NegotiationPayloadWhip = Type.Object({
  candidate: Type.Optional(Type.String()),
  sdpMLineIndex: Type.Optional(Type.Union([Type.Number(), Type.Null()])),
  sdpMid: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  usernameFragment: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});
export type NegotiationPayloadWhip = Static<typeof NegotiationPayloadWhip>;

export const sensorAddResponse = Type.Object({
  sensorId: Type.String(),
  negotiation: Type.Any(),
});
export type SensorAddResponse = Static<typeof sensorAddResponse>;
