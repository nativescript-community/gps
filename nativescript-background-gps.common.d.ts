import { Location as LocationDef } from "./location";
export declare class Location implements LocationDef {
    latitude: number;
    longitude: number;
    altitude: number;
    horizontalAccuracy: number;
    verticalAccuracy: number;
    speed: number;
    direction: number;
    timestamp: Date;
    android: android.location.Location;
    ios: CLLocation;
}
export declare var defaultGetLocationTimeout: number;
