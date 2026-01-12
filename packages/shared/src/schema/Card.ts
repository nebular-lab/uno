import { Schema, type } from "@colyseus/schema";

export class Card extends Schema {
  @type("string") id: string = ""; // カードID (例: "r5", "b-skip", "wild-1")
  @type("string") color: string = ""; // red/blue/green/yellow/wild
  @type("string") value: string = ""; // 0-9/skip/reverse/draw2/wild/draw4/force-change
  @type("number") points: number = 0; // 点数

  constructor(
    id: string = "",
    color: string = "",
    value: string = "",
    points: number = 0,
  ) {
    super();
    this.id = id;
    this.color = color;
    this.value = value;
    this.points = points;
  }
}
