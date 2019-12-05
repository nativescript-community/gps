import { DefaultLatLonKeys, GenericGeoLocation, GeoLocation } from './location';
import * as perms from 'nativescript-perms';
import Observable from 'nativescript-observable';

export type LatitudeKeys = 'latitude' | 'lat';
export type LongitudeKeys = 'longitude' | 'lon' | 'lng';
export type AltitudeKeys = 'altitude' | 'alt' | 'ele';

export { DefaultLatLonKeys, GenericGeoLocation, GeoLocation };

// export class GeoLocation implements LocationDef {
//     public latitude: number;
//     public longitude: number;

//     public altitude: number;

//     public horizontalAccuracy: number;
//     public verticalAccuracy: number;

//     public speed: number; // in m/s ?

//     public bearing: number; // in degrees

//     public timestamp: Date;
//     public elapsedBoot?: number;

//     public android?: any; // android Location
//     public ios?: any; // iOS native location
// }

export let defaultGetLocationTimeout = 5 * 60 * 1000; // 5 minutes

let debug = false;
export function setGPSDebug(value: boolean) {
    debug = value;
    perms.setDebug(debug);
}

let mockEnabled = false;
export function setMockEnabled(value: boolean) {
    mockEnabled = value;
}
export function isMockEnabled() {
    return mockEnabled;
}
export enum CLogTypes {
    debug,
    info,
    warning,
    error
}

export const CLog = (type: CLogTypes = 0, ...args) => {
    if (debug) {
        if (type === 0) {
            // Debug
            console.log('[nativescript-gps]', ...args);
        } else if (type === 1) {
            // Info
            console.log('[nativescript-gps]', ...args);
        } else if (type === 2) {
            // Warning
            console.warn('[nativescript-gps]', ...args);
        } else if (type === 3) {
            console.error('[nativescript-gps]', ...args);
        }
    }
};

export abstract class GPSCommon extends Observable {
    public set debug(value: boolean) {
        setGPSDebug(value);
    }
    /*
     * String value for hooking into the gps_status_event. This event fires when the gps state changes.
     */
    public static gps_status_event = 'gps_status_event';
}

export let LatitudeKey: LatitudeKeys = 'latitude';
export let LongitudeKey: LongitudeKeys = 'longitude';
export let AltitudeKey: AltitudeKeys = 'altitude';

export function setGeoLocationKeys(latitude: LatitudeKeys, longitude: LongitudeKeys, altitude?: AltitudeKeys) {
    LatitudeKey = latitude;
    LongitudeKey = longitude;
    if (altitude) {
        AltitudeKey = altitude;
    }
}
