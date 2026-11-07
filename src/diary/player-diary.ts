import { DurableObject } from "cloudflare:workers";
import type { Env } from "../env";
import { sandwichCase } from "./cases";
import { type CompletedTurn, type DiaryView, checkAnswer, initialLineIds, matchTriggers, toDiaryView } from "./rules";

export type FillOutcome =
  | { kind: "unavailable" }
  | { kind: "checked"; correct: boolean; diary?: DiaryView };

type Row = { id: string; word: string | null };

export class PlayerDiary extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec("CREATE TABLE IF NOT EXISTS open_lines (id TEXT PRIMARY KEY, word TEXT)");
    this.openLines(initialLineIds(sandwichCase.lines));
  }

  private openLines(ids: readonly string[]) {
    ids.forEach((id) => this.ctx.storage.sql.exec("INSERT OR IGNORE INTO open_lines (id) VALUES (?)", id));
  }

  private readProgress() {
    const rows = this.ctx.storage.sql.exec<Row>("SELECT id, word FROM open_lines").toArray();
    return new Map(rows.map(({ id, word }) => [id, word]));
  }

  private readView() {
    return toDiaryView(sandwichCase, this.readProgress());
  }

  async view(): Promise<DiaryView> {
    return this.readView();
  }

  async recordTurn(turn: CompletedTurn): Promise<DiaryView | undefined> {
    const progress = this.readProgress();
    const opened = matchTriggers(sandwichCase.lines, turn).filter((id) => !progress.has(id));
    if (opened.length === 0) return undefined;
    this.ctx.storage.transactionSync(() => this.openLines(opened));
    return this.readView();
  }

  async fill(lineId: string, word: string): Promise<FillOutcome> {
    const line = sandwichCase.lines.find(({ id }) => id === lineId);
    const progress = this.readProgress();
    if (!line?.accepted || !progress.has(lineId)) return { kind: "unavailable" };
    if (!checkAnswer(line, word)) return { kind: "checked", correct: false };
    if (progress.get(lineId) !== null) return { kind: "checked", correct: true };
    this.ctx.storage.sql.exec("UPDATE open_lines SET word = ? WHERE id = ?", line.accepted[0] ?? word, lineId);
    return { kind: "checked", correct: true, diary: this.readView() };
  }
}
