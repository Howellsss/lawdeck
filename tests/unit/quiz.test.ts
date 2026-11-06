import { describe, expect, it } from "vitest";
import { parseQuizState, place } from "@/lib/quiz";
import { musicFor } from "@/lib/quizSound";

const live = {
  id: "00000000-0000-4000-8000-000000000901",
  status: "live",
  topic: "Originating processes",
  host: "Ada Wombat",
  isHost: false,
  joined: true,
  players: 3,
  total: 5,
  current: 0,
  seconds: 20,
  secondsLeft: 12.4,
  answered: 1,
  question: { prompt: "Which process suits facts not in dispute?", choices: ["Writ", "Originating summons", "Petition"] },
  closed: false,
  correctChoice: null,
  explanation: null,
  myChoice: null,
  myCorrect: null,
  myPoints: null,
  leaderboard: [{ name: "Ada Wombat", points: 0, correct: 0, me: false }],
};

describe("group quiz", () => {
  it("accepts the state the database sends", () => {
    expect(parseQuizState(live)?.question?.choices).toHaveLength(3);
  });
  it("refuses anything else, so the screen never shows made-up data", () => {
    expect(parseQuizState(null)).toBeNull();
    expect(parseQuizState({ ...live, status: "paused" })).toBeNull();
    expect(parseQuizState({ ...live, leaderboard: [{ name: "x" }] })).toBeNull();
  });
  it("writes places as 1st, 2nd, 3rd, 4th, 11th, 21st", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(place)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd"]);
  });

  it("fills in the extras when an older reply lacks them", () => {
    const state = parseQuizState(live);
    expect(state?.readyIn).toBe(0);
    expect(state?.counts).toBeNull();
    expect(state?.leaderboard[0].streak).toBe(0);
  });
  it("plays lobby music, question music that hurries near the end, and silence for the countdown and reveal", () => {
    expect(musicFor("lobby", 0, false, 0)).toBe("lobby");
    expect(musicFor("live", 2, false, 20)).toBeNull();
    expect(musicFor("live", 0, false, 12)).toBe("question");
    expect(musicFor("live", 0, false, 4)).toBe("hurry");
    expect(musicFor("live", 0, true, 0)).toBeNull();
    expect(musicFor("done", 0, true, 0)).toBeNull();
  });
});
