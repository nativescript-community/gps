import { DefaultLatLonKeys, GenericGeoLocation, GeoLocation } from './location';

/**
 * Provides options for location monitoring.
 */
export interface Options {
    /**
     * Specifies desired accuracy in meters. Defaults to DesiredAccuracy.HIGH
     */
    desiredAccuracy?: number;

    /**
     * Update distance filter in meters. Specifies how often to update. Default on iOS is no filter, on Android it is 0 meters
     */
    updateDistance?: number;

    /**
     * Minimum time interval between location updates, in milliseconds.
     */
    minimumUpdateTime?: number;

    /**
     * how old locations to receive in ms.
     */
    maximumAge?: number;

    /**
     * how long to wait for a location in ms.
     */
    timeout?: number;

    /**
     * monitor the location in the background.
     */
    skipPermissionCheck?: boolean;
    /**
     * monitor the location in the background.
     */
    dontOpenSettings?: boolean;

    /**
     * iOS only
     */
    allowsBackgroundLocationUpdates?: boolean;
    /**
     * iOS only
     */
    pausesLocationUpdatesAutomatically?: boolean;
    /**
     * iOS only
     */
    activityType?: any; // CLActivityType
    /**
     * iOS only
     */
    deferredLocationUpdates?: {
        traveled: number;
        timeout: number;
    };
    onDeferred?: deferredCallbackType;
    onLocationPaused?: () => void;

    /**
     * android only
     */
    provider?: 'gps' | 'network' | 'passive';


    nmeaAltitude?: boolean;
}

declare type successCallbackType<T> = (location: GenericGeoLocation<T>, manager?: any /*CLLocationManager*/) => void;
declare type errorCallbackType = (error: Error) => void;
declare type deferredCallbackType = (error?: Error) => void;

export function getCurrentLocation<T = DefaultLatLonKeys>(options: Options): Promise<GenericGeoLocation<T>>;
export function watchLocation<T = DefaultLatLonKeys>(successCallback: successCallbackType<T>, errorCallback: errorCallbackType, options: Options): Promise<number>;
export function clearWatch(watchId: number): void;
export declare function authorize(always?: boolean): Promise<void>;
export declare function enable(always?: boolean): Promise<void>;
export declare function isEnabled(): boolean;
export declare function isAuthorized(always?: boolean): Promise<boolean>;
export function distance<T = DefaultLatLonKeys>(loc1: GenericGeoLocation<T>, loc2: GenericGeoLocation<T>): number;

export class LocationMonitor {
    static getLastKnownLocation<T = DefaultLatLonKeys>(): GenericGeoLocation<T>;
    static startLocationMonitoring(options: Options, locListener: any): void;
    static createListenerWithCallbackAndOptions<T = DefaultLatLonKeys>(successCallback: successCallbackType<T>, options: Options): any;
    static stopLocationMonitoring(locListenerId: number): void;

    static getLocationMonitoring(locListenerId: number): any;
}
