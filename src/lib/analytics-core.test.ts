import { describe, expect, it } from "vitest";
import { posthogPayload } from "./analytics-core";

describe("posthogPayload", () => {
  it("event dengan id anonim & tanpa profil orang", () => {
    expect(posthogPayload("phc_x", "bill_shared", "m1", { group_id: "g1", channel: "whatsapp" })).toEqual({
      api_key: "phc_x",
      event: "bill_shared",
      distinct_id: "m1",
      properties: { group_id: "g1", channel: "whatsapp", $process_person_profile: false },
    });
  });
});
