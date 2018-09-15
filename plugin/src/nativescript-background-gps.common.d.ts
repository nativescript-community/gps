import { GeoLocation as LocationDef } from "./location";
export declare class GeoLocation implements LocationDef {
    latitude: number;
    longitude: number;
    altitude: number;
    horizontalAccuracy: number;
    verticalAccuracy: number;
    speed: number;
    bearing: number;
    timestamp: Date;
    android?: any;
    ios?: any;
}
export declare var defaultGetLocationTimeout: number;
export declare function setGPSDebug(value: boolean): void;
export declare enum CLogTypes {
    debug = 0,
    info = 1,
    warning = 2,
    error = 3,
}
export declare const CLog: (type?: CLogTypes, ...args: any[]) => void;
