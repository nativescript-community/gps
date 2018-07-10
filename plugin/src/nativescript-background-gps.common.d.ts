import { GeoLocation as LocationDef } from "./location";
export declare class GeoLocation implements LocationDef {
    latitude: number;
    longitude: number;
    altitude: number;
    horizontalAccuracy: number;
    verticalAccuracy: number;
    speed: number;
    direction: number;
    timestamp: Date;
    android?: any;
    ios?: any;
}
export declare var defaultGetLocationTimeout: number;
