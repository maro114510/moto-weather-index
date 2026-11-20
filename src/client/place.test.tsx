import {
  afterEach,
  beforeEach,
  describe,
  expect,
  setSystemTime,
  test,
} from "bun:test";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { DEFAULT_PLACE, PlaceProvider, usePlace } from "./place";

const sapporo = { name: "札幌", latitude: 43.0618, longitude: 141.3545 };
const NOW = new Date("2026-11-20T03:00:00Z");

type Outcome =
  | { position: { latitude: number; longitude: number } }
  | { code: number };

let outcome: Outcome;
let geolocationCalls = 0;

function wrapper({ children }: { children: ReactNode }) {
  return <PlaceProvider>{children}</PlaceProvider>;
}

function mount() {
  return renderHook(() => usePlace(), { wrapper });
}

beforeEach(() => {
  setSystemTime(NOW);
  geolocationCalls = 0;
  outcome = { position: { latitude: 34.6937, longitude: 135.5023 } };
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition(
        ok: (p: { coords: object }) => void,
        fail: (e: { code: number }) => void,
      ) {
        geolocationCalls += 1;
        if ("position" in outcome) ok({ coords: outcome.position });
        else fail({ code: outcome.code });
      },
    },
  });
});

afterEach(() => {
  setSystemTime();
});

describe("the place before any choice", () => {
  test("is Tokyo with consent unset and no request for the position", () => {
    const { result } = mount();

    expect(result.current.place).toEqual(DEFAULT_PLACE);
    expect(result.current.consent).toBe("unset");
    expect(geolocationCalls).toBe(0);
  });
});

describe("choosing a place", () => {
  test("becomes the place and is restored by the next visit", () => {
    const first = mount();
    act(() => first.result.current.choosePlace(sapporo));
    first.unmount();

    const second = mount();

    expect(second.result.current.place).toEqual(sapporo);
  });
});

describe("enabling the current location", () => {
  test("asks the device once, records consent, and uses the position as the place", async () => {
    const { result } = mount();

    await act(() => result.current.enableCurrentLocation());

    expect(geolocationCalls).toBe(1);
    expect(result.current.consent).toBe("granted");
    expect(result.current.place).toEqual({
      name: "現在地",
      latitude: 34.6937,
      longitude: 135.5023,
    });
    expect(result.current.locationError).toBeNull();
  });

  test("replaces a place chosen earlier", async () => {
    const { result } = mount();
    act(() => result.current.choosePlace(sapporo));

    await act(() => result.current.enableCurrentLocation());

    expect(result.current.place.name).toBe("現在地");
  });

  test("keeps the stored position for the next visit within 24 hours", async () => {
    const first = mount();
    await act(() => first.result.current.enableCurrentLocation());
    first.unmount();

    setSystemTime(new Date(NOW.getTime() + 23 * 60 * 60 * 1000));
    const second = mount();

    expect(second.result.current.place.name).toBe("現在地");
    expect(second.result.current.consent).toBe("granted");
    expect(geolocationCalls).toBe(1);
  });

  test("drops the stored position after 24 hours and falls back to Tokyo", async () => {
    const first = mount();
    await act(() => first.result.current.enableCurrentLocation());
    first.unmount();

    setSystemTime(new Date(NOW.getTime() + 25 * 60 * 60 * 1000));
    const second = mount();

    expect(second.result.current.place).toEqual(DEFAULT_PLACE);
    expect(second.result.current.consent).toBe("granted");
  });

  test("reports a denied permission, keeps the place, and records no consent", async () => {
    outcome = { code: 1 };
    const { result } = mount();

    await act(() => result.current.enableCurrentLocation());

    expect(result.current.locationError).toBe(
      "位置情報の利用が許可されませんでした。ブラウザの設定を確認してください。",
    );
    expect(result.current.consent).toBe("unset");
    expect(result.current.place).toEqual(DEFAULT_PLACE);
    expect(result.current.isLocating).toBe(false);
  });

  test("reports a device that cannot determine the position", async () => {
    outcome = { code: 2 };
    const { result } = mount();

    await act(() => result.current.enableCurrentLocation());

    expect(result.current.locationError).toBe("現在地を取得できませんでした。");
  });

  test("reports a browser without geolocation", async () => {
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: undefined,
    });
    const { result } = mount();

    await act(() => result.current.enableCurrentLocation());

    expect(result.current.locationError).toBe(
      "このブラウザは位置情報に対応していません。",
    );
  });
});

describe("declining the current location", () => {
  test("records the refusal without asking the device and survives a reload", () => {
    const first = mount();
    act(() => first.result.current.declineCurrentLocation());
    first.unmount();

    const second = mount();

    expect(second.result.current.consent).toBe("declined");
    expect(geolocationCalls).toBe(0);
  });
});

describe("deleting the stored location", () => {
  test("removes the position but keeps the consent", async () => {
    const first = mount();
    await act(() => first.result.current.enableCurrentLocation());

    act(() => first.result.current.deleteStoredLocation());

    expect(first.result.current.place).toEqual(DEFAULT_PLACE);
    expect(first.result.current.consent).toBe("granted");
    first.unmount();
    expect(mount().result.current.place).toEqual(DEFAULT_PLACE);
  });
});

describe("withdrawing consent", () => {
  test("removes the position and returns the consent to unset", async () => {
    const first = mount();
    await act(() => first.result.current.enableCurrentLocation());
    expect(first.result.current.consent).toBe("granted");

    act(() => first.result.current.withdrawConsent());

    expect(first.result.current.consent).toBe("unset");
    expect(first.result.current.place).toEqual(DEFAULT_PLACE);
    first.unmount();
    expect(window.localStorage.length).toBe(0);
  });
});
