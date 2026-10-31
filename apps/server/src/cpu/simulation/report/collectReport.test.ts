import { describe, expect, it } from "vitest";
import { collectReport } from "./collectReport";
import { renderReport } from "./renderReport";

describe("collectReport", () => {
  it("1ゲーム目のリプレイと、読みの精度の集計を作る", async () => {
    const data = await collectReport(3);

    expect(data.replay.frames.length).toBeGreaterThan(0);
    expect(data.replay.result).not.toBe("");
    const frame = data.replay.frames[0];
    expect(frame.players).toHaveLength(4);
    expect(frame.reads).toHaveLength(3);
    expect(data.calibration.map((s) => s.key)).toEqual([
      "plain",
      "excluded",
      "bait",
    ]);
    expect(data.calibration[0].samples).toBeGreaterThan(0);
  });

  it("データを埋め込んだHTMLを作る", async () => {
    const html = renderReport(await collectReport(1));

    expect(html).toContain("<title>CPUの読みレポート</title>");
    expect(html).toContain('id="report-data"');
  });
});
