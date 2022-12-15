import { DefaultLatLonKeys, GenericGeoLocation, GeoLocation } from './location';
import { check, request } from '@nativescript-community/perms';
import Observable from '@nativescript-community/observable';

export type LatitudeKeys = 'latitude' | 'lat';
export type LongitudeKeys = 'longitude' | 'lon' | 'lng';
export type AltitudeKeys = 'altitude' | 'alt' | 'ele';

export { DefaultLatLonKeys, GenericGeoLocation, GeoLocation };

export const defaultGetLocationTimeout = 5 * 60 * 1000; // 5 minutes

// let debug = false;
// export function setGPSDebug(value: boolean) {
// debug = value;
// setDebug(debug);
// }

let mockEnabled = false;
export function setMockEnabled(value: boolean) {
    mockEnabled = value;
}
export function isMockEnabled() {
    return mockEnabled;
}
import { Trace } from '@nativescript/core';
export const GPSTraceCategory = 'N-GPS';

export enum CLogTypes {
    debug = Trace.messageType.log,
    log = Trace.messageType.log,
    info = Trace.messageType.info,
    warning = Trace.messageType.warn,
    error = Trace.messageType.error
}

export const CLog = (type: CLogTypes, ...args) => {
    Trace.write(args.map((a) => (a && typeof a === 'object' ? JSON.stringify(a) : a)).join(' '), GPSTraceCategory, type);
};

export abstract class GPSCommon extends Observable {
    /*
     * String value for hooking into the gps_status_event. This event fires when the gps state changes.
     */
    public static gps_status_event = 'gps_status_event';

    authorize(always?: boolean) {
        if (Trace.isEnabled()) {
            CLog(CLogTypes.debug, 'authorize', always);
        }
        return request('location', { type: always ? 'always' : undefined }).then((s) => s[0] === 'authorized');
    }

    isAuthorized(always?: boolean) {
        if (Trace.isEnabled()) {
            CLog(CLogTypes.debug, 'isAuthorized');
        }
        return check('location').then((s) => {
            if (Trace.isEnabled()) {
                CLog(CLogTypes.debug, 'isAuthorized result', s);
            }
            if (always !== undefined) {
                return s[0] === 'authorized' && s[1] === always;
            }
            return s[0] === 'authorized';
        });
    }
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
