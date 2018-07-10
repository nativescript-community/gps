import {GeoLocation as LocationDef} from "./location";
export class GeoLocation implements LocationDef {
  public latitude: number;
  public longitude: number;

  public altitude: number;

  public horizontalAccuracy: number;
  public verticalAccuracy: number;

  public speed: number; // in m/s ?

  public direction: number; // in degrees

  public timestamp: Date;

  public android?: any;  // android Location
  public ios?: any;      // iOS native location
}

export var defaultGetLocationTimeout = 5 * 60 * 1000; // 5 minutes