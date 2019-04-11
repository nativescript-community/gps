import { GeoLocation } from './location';
import { deferredCallbackType, errorCallbackType, LocationMonitor as LocationMonitorDef, Options, successCallbackType } from './location-monitor';
export * from './nativescript-gps.common';
export { Options, successCallbackType, errorCallbackType, deferredCallbackType };
export declare class LocationListenerImpl extends NSObject implements CLLocationManagerDelegate {
    static ObjCProtocols: {
        prototype: CLLocationManagerDelegate;
    }[];
    authorizeAlways: boolean;
    id: number;
    private _onLocation;
    private _onError;
    private _onDeferred;
    private _resolve;
    private _reject;
    static initWithLocationError(successCallback: successCallbackType, error?: errorCallbackType, options?: Options): LocationListenerImpl;
    static initWithPromiseCallbacks(resolve: () => void, reject: (error: Error) => void, authorizeAlways?: boolean): LocationListenerImpl;
    locationManagerDidUpdateLocations(manager: CLLocationManager, locations: NSArray<CLLocation>): void;
    locationManagerDidFinishDeferredUpdatesWithError(manager: CLLocationManager, error: NSError): void;
    locationManagerDidFailWithError(manager: CLLocationManager, error: NSError): void;
    locationManagerDidChangeAuthorizationStatus(manager: CLLocationManager, status: CLAuthorizationStatus): void;
}
export declare function getCurrentLocation(options: Options): Promise<GeoLocation>;
export declare function watchLocation(successCallback: successCallbackType, errorCallback: errorCallbackType, options: Options): Promise<number>;
export declare function clearWatch(watchId: number): void;
export declare function hasGPS(): boolean;
export declare function openGPSSettings(): Promise<void>;
export declare function enable(): Promise<void>;
export declare function authorize(always?: boolean): Promise<boolean>;
export declare function isEnabled(): boolean;
export declare function isAuthorized(): Promise<boolean>;
export declare function distance(loc1: GeoLocation, loc2: GeoLocation): number;
export declare class LocationMonitor implements LocationMonitorDef {
    static getLastKnownLocation(): GeoLocation;
    static startLocationMonitoring(options: Options, locListener: LocationListenerImpl): void;
    static stopLocationMonitoring(iosLocManagerId: number): void;
    static createiOSLocationManager(locListener: LocationListenerImpl, options: Options): CLLocationManager;
}
