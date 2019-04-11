import * as common from './nativescript-gps.common';
import { errorCallbackType, LocationMonitor as LocationMonitorDef, Options, successCallbackType } from './location-monitor';
export * from './nativescript-gps.common';
export declare function openGPSSettings(): Promise<{}>;
export declare function watchLocation(successCallback: successCallbackType, errorCallback: errorCallbackType, options: Options): Promise<any>;
export declare function hasGPS(): boolean;
export declare function getCurrentLocation(options: Options): Promise<common.GeoLocation>;
export declare function clearWatch(watchId: number): void;
export declare function enable(): Promise<{}>;
export declare function authorize(always?: boolean): Promise<boolean>;
export declare function isAuthorized(): Promise<boolean>;
export declare function isGPSEnabled(): boolean;
export declare function isEnabled(): boolean;
export declare function distance(loc1: common.GeoLocation, loc2: common.GeoLocation): number;
export declare class LocationMonitor implements LocationMonitorDef {
    static getLastKnownLocation(): common.GeoLocation;
    static startLocationMonitoring(options: Options, listener: any): void;
    static createListenerWithCallbackAndOptions(successCallback: successCallbackType, options: Options): globalAndroid.location.LocationListener;
    static stopLocationMonitoring(locListenerId: number): void;
}
