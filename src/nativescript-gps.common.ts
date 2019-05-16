import { GeoLocation as LocationDef } from './location';
import * as perms from 'nativescript-perms';
import { Observable } from 'tns-core-modules/ui/page/page';

export class GeoLocation implements LocationDef {
    public latitude: number;
    public longitude: number;

    public altitude: number;

    public horizontalAccuracy: number;
    public verticalAccuracy: number;

    public speed: number; // in m/s ?

    public bearing: number; // in degrees

    public timestamp: Date;

    public android?: any; // android Location
    public ios?: any; // iOS native location
}

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
            console.log.apply(this, args);
        } else if (type === 1) {
            // Info
            console.log.apply(this, args);
        } else if (type === 2) {
            // Warning
            console.warn.apply(this, args);
        } else if (type === 3) {
            console.error.apply(this, args);
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
