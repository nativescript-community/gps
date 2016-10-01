import common = require("./nativescript-background-gps.common");
import { LocationMonitor as LocationMonitorDef, Options, successCallbackType, errorCallbackType } from "./location-monitor";
export declare function watchLocation(successCallback: successCallbackType, errorCallback: errorCallbackType, options: Options): number;
export declare function getCurrentLocation(options: Options): Promise<common.Location>;
export declare function clearWatch(watchId: number): void;
export declare function enableLocationRequest(always?: boolean): Promise<void>;
export declare function isEnabled(): boolean;
export declare function distance(loc1: common.Location, loc2: common.Location): number;
export declare class LocationMonitor implements LocationMonitorDef {
    static getLastKnownLocation(): common.Location;
    static startLocationMonitoring(options: Options, listener: any): void;
    static createListenerWithCallbackAndOptions(successCallback: successCallbackType, options: Options): android.location.LocationListener;
    static stopLocationMonitoring(locListenerId: number): void;
}
