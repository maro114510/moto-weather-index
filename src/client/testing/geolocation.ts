/** Replaces the browser's geolocation with one that answers as the test says. */
export function stubGeolocation(
  answer: { latitude: number; longitude: number } | { code: number },
) {
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition(
        ok: (p: { coords: object }) => void,
        fail: (e: { code: number }) => void,
      ) {
        if ("code" in answer) fail({ code: answer.code });
        else ok({ coords: answer });
      },
    },
  });
}
