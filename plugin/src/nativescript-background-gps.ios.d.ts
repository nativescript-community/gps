import { GeoLocation as LocationDef } from './location';
import { LocationMonitor as LocationMonitorDef, Options, successCallbackType, errorCallbackType, deferredCallbackType } from './location-monitor';
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
export declare function getCurrentLocation(options: Options): Promise<LocationDef>;
export declare function watchLocation(successCallback: successCallbackType, errorCallback: errorCallbackType, options: Options): number;
export declare function clearWatch(watchId: number): void;
export declare function enableLocationServiceRequest(): Promise<void>;
export declare function enableLocationRequest(always?: boolean): Promise<void>;
export declare function authorizeLocationRequest(always?: boolean): Promise<void>;
export declare function isLocationServiceEnabled(): boolean;
export declare function isLocationServiceAuthorized(): boolean;
export declare function isEnabled(): boolean;
export declare function distance(loc1: LocationDef, loc2: LocationDef): number;
export declare class LocationMonitor implements LocationMonitorDef {
    static getLastKnownLocation(): LocationDef;
    static startLocationMonitoring(options: Options, locListener: LocationListenerImpl): void;
    static stopLocationMonitoring(iosLocManagerId: number): void;
    static createiOSLocationManager(locListener: LocationListenerImpl, options: Options): CLLocationManager;
}
