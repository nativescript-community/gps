import {Observable} from "data/observable";
import {NativescriptBackgroundGps} from "nativescript-background-gps";

export class HelloWorldModel extends Observable {
  public message: string;
  private nativescriptBackgroundGps: NativescriptBackgroundGps;

  constructor() {
    super();

    this.nativescriptBackgroundGps = new NativescriptBackgroundGps();
    this.message = this.nativescriptBackgroundGps.message;
  }
}