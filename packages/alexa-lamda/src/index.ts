const { ENDPOINT } = process.env;

export const handler = async (request, context) => {
  log("DEBUG:", "Request", request.directive.header.name);

  if (
    request.directive.header.namespace === "Alexa.Discovery" &&
    request.directive.header.name === "Discover"
  ) {
    log("DEBUG:", "Discover request", JSON.stringify(request));
    handleDiscovery(request, context);
  } else if (
    request.directive.header.namespace === "Alexa.RTCSessionController"
  ) {
    if (
      (request as InitiateSessionWithOffer).directive.header.name ===
      "InitiateSessionWithOffer"
    ) {
      log(
        "DEBUG:",
        "InitiateSessionWithOffer request",
        JSON.stringify(request),
      );
      await handleInitiateSessionWithOffer(request, context);
    }
    if (
      (request as SessionConnected).directive.header.name === "SessionConnected"
    ) {
      log("DEBUG:", "SessionConnected request", JSON.stringify(request));
      handleSessionConnected(request, context);
    }
  } else if (
    request.directive.header.namespace === "Alexa.Authorization" &&
    request.directive.header.name === "AcceptGrant"
  ) {
    log("DEBUG:", "AcceptGrant request", JSON.stringify(request));
    handleAuthorization(request, context);
  } else {
    log("DEBUG:", "Unknown request", JSON.stringify(request));
  }

  function handleAuthorization(request, context) {
    // AcceptGrant応答を送信します
    var payload = {};
    var header = request.directive.header;
    header.name = "AcceptGrant.Response";
    log(
      "DEBUG",
      "AcceptGrant Response: ",
      JSON.stringify({ header: header, payload: payload }),
    );
    context.succeed({ event: { header: header, payload: payload } });
  }

  function handleDiscovery(request, context) {
    // 検出応答を送信します
    var payload = {
      endpoints: [
        {
          endpointId: "sample-chatgpt02",
          manufacturerName: "エージェント",
          friendlyName: "エージェント",
          description: "ChatGPT",
          displayCategories: ["DOORBELL"],
          capabilities: [
            {
              type: "AlexaInterface",
              interface: "Alexa.RTCSessionController",
              version: "3",
              configuration: {
                isFullDuplexAudioSupported: true,
              },
            },
          ],
        },
      ],
    };
    var header = request.directive.header;
    header.name = "Discover.Response";
    log(
      "DEBUG",
      "Discovery Response: ",
      JSON.stringify({ header: header, payload: payload }),
    );
    context.succeed({ event: { header, payload } });
  }

  async function handleInitiateSessionWithOffer(
    request: InitiateSessionWithOffer,
    context,
  ) {
    const offer = request.directive.payload.offer;

    const sdpResponse = await fetch(`${ENDPOINT}/offer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sdp: offer.value,
        sessionId: request.directive.payload.sessionId,
      }),
    });

    const sdp = await sdpResponse.text();
    log("DEBUG", "SDP Response: ", sdp);

    const event: AnswerGeneratedForSession = {
      event: {
        header: {
          ...request.directive.header,
          name: "AnswerGeneratedForSession",
        },
        endpoint: request.directive.endpoint,
        payload: {
          answer: {
            format: "SDP",
            value: sdp,
          },
        },
      },
    };
    context.succeed(event);
  }

  function handleSessionConnected(request: SessionConnected, context) {
    const event: SessionConnectedEvent = {
      event: {
        header: {
          ...request.directive.header,
          name: "SessionConnected",
        },
        endpoint: request.directive.endpoint,
        payload: {
          sessionId: request.directive.payload.sessionId,
        },
      },
    };
    context.succeed(event);
  }
};

function log(message, message1, message2) {
  console.log(message + message1 + message2);
}

interface InitiateSessionWithOffer {
  directive: {
    header: {
      namespace: string;
      name: string;
      messageId: string; // 一意のバージョン4 UUID
      correlationToken: string; // opaque相関トークン
      payloadVersion: string; // "3"
    };
    endpoint: {
      scope: {
        type: string; // "BearerToken"
        token: string; // OAuth2.0ベアラートークン
      };
      endpointId: string; // エンドポイントID
      cookie: Record<string, unknown>;
    };
    payload: {
      sessionId: string; // セッション識別子
      offer: {
        format: string; // "SDP"
        value: string; // SDPオファー値
      };
    };
  };
}

interface AnswerGeneratedForSession {
  event: {
    header: {
      namespace: string; // "Alexa.RTCSessionController"
      name: string; // "AnswerGeneratedForSession"
      messageId: string; // 一意の識別子、バージョン4 UUIDが望ましい
      correlationToken: string; // リクエストに一致するopaque相関トークン
      payloadVersion: string; // "3"
    };
    endpoint: {
      scope: {
        type: string; // "BearerToken"
        token: string; // OAuth2.0ベアラートークン
      };
      endpointId: string; // エンドポイントID
    };
    payload: {
      answer: {
        format: string; // "SDP"
        value: string; // SDPアンサー値
      };
    };
  };
}

interface SessionConnected {
  directive: {
    header: {
      namespace: string; // "Alexa.RTCSessionController"
      name: string; // "SessionConnected"
      messageId: string; // 一意のバージョン4 UUID
      correlationToken: string; // opaque相関トークン
      payloadVersion: string; // "3"
    };
    endpoint: {
      scope: {
        type: string; // "BearerToken"
        token: string; // OAuth2.0ベアラートークン
      };
      endpointId: string; // エンドポイントID
      cookie: Record<string, unknown>;
    };
    payload: {
      sessionId: string; // セッション識別子
    };
  };
}

interface SessionConnectedEvent {
  event: {
    header: {
      namespace: string; // "Alexa.RTCSessionController"
      name: string; // "SessionConnected"
      messageId: string; // 一意の識別子、バージョン4 UUIDが望ましい
      correlationToken: string; // リクエストに一致するopaque相関トークン
      payloadVersion: string; // "3"
    };
    endpoint: {
      scope: {
        type: string; // "BearerToken"
        token: string; // OAuth2.0ベアラートークン
      };
      endpointId: string; // エンドポイントID
    };
    payload: {
      sessionId: string; // セッション識別子
    };
  };
}
