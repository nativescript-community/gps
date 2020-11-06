import { AndroidActivityResultEventData, AndroidApplication, android as andApp } from '@nativescript/core/application';
import { ad } from '@nativescript/core/utils/utils';
import { Accuracy } from '@nativescript/core/ui/enums';
import { Trace } from '@nativescript/core';
import * as common from './gps.common';
import { LocationMonitor as LocationMonitorDef, Options, errorCallbackType, successCallbackType } from './location-monitor';
import { request } from '@nativescript-community/perms';
import lazy from '@nativescript/core/utils/lazy';
import { DefaultLatLonKeys } from './location';

export * from './gps.common';

let ANDROID_SDK = -1;
function getAndroidSDK() {
    if (ANDROID_SDK === -1) {
        ANDROID_SDK = android.os.Build.VERSION.SDK_INT;
    }
    return ANDROID_SDK;
}

const NOUGAT = 24;
const OREO = 26;

const locationListeners: { [k: number]: LocationListener<any> } = {};
let watchId = 0;
let androidLocationManager: android.location.LocationManager;
const minTimeUpdate = 1 * 60 * 1000; // 1 minute
const minRangeUpdate = 0; // 0 meters

function getAndroidLocationManager(): android.location.LocationManager {
    if (!androidLocationManager) {
        androidLocationManager = ad.getApplicationContext().getSystemService(android.content.Context.LOCATION_SERVICE) as android.location.LocationManager;
    }
    return androidLocationManager;
}

interface LocationListener<T = DefaultLatLonKeys> extends android.location.LocationListener {
    _onLocation: successCallbackType<T>;
    _nmeaListener: NmeaListener<T> | OnNmeaListener<T>;
    mLastMslAltitude?: number;
    mLastMslAltitudeTimestamp?: number;
    id: number;
}
interface NmeaListener<T = DefaultLatLonKeys> extends android.location.GpsStatus.NmeaListener {
    locationListener: WeakRef<LocationListener<T>>;
}
interface OnNmeaListener<T = DefaultLatLonKeys> extends android.location.OnNmeaMessageListener {
    locationListener: WeakRef<LocationListener<T>>;
}

function createLocationListener<T = DefaultLatLonKeys>(successCallback: successCallbackType<T>, options: Options) {
    const locationListener = new android.location.LocationListener({
        onLocationChanged(location: android.location.Location) {
            common.CLog(common.CLogTypes.debug, 'onLocationChanged', location);
            const that = this as LocationListener<T>;
            const locationCallback = that._onLocation;
            if (locationCallback) {
                const loc = locationFromAndroidLocation<T>(location);
                const updateTime = options && typeof options.minimumUpdateTime === 'number' ? options.minimumUpdateTime : minTimeUpdate;
                if (that.mLastMslAltitudeTimestamp) {
                    // common.CLog(common.CLogTypes.debug, 'onLocationChanged test', loc.timestamp, that.mLastMslAltitudeTimestamp, loc['altitude'], that.mLastMslAltitude);
                    if (loc.timestamp - that.mLastMslAltitudeTimestamp <= updateTime) {
                        loc.mslAltitude = that.mLastMslAltitude;
                    }
                }
                locationCallback(loc);
            }
        },

        onProviderDisabled(provider) {
            common.CLog(common.CLogTypes.debug, 'onProviderEnabled', provider);
            //
        },

        onProviderEnabled(provider) {
            common.CLog(common.CLogTypes.debug, 'onProviderEnabled', provider);
            //
        },

        onStatusChanged(arg1, arg2, arg3) {
            common.CLog(common.CLogTypes.debug, 'onStatusChanged', arg1, arg2, arg3);
            //
        },
    }) as LocationListener<T>;
    watchId++;
    locationListener._onLocation = successCallback;
    locationListener.id = watchId;
    locationListeners[watchId] = locationListener;

    if (options.nmeaAltitude === true) {
        if ( getAndroidSDK() >= NOUGAT ) {
            locationListener._nmeaListener = new android.location.OnNmeaMessageListener({
                onNmeaMessage(nmea: string, timestamp: number) {
                    const locationListener = (this as NmeaListener<T>).locationListener && (this as NmeaListener<T>).locationListener.get();
                    if (locationListener && nmea[0] === '$') {
                        const tokens = nmea.split(',');
                        const type = tokens[0];
                        const alt = tokens[9];

                        // Parse altitude above sea level, Detailed description of NMEA string here http://aprs.gids.nl/nmea/#gga
                        if (type.endsWith('GGA')) {
                            if (alt && alt.length > 0) {
                                locationListener.mLastMslAltitudeTimestamp = timestamp;
                                locationListener.mLastMslAltitude = parseFloat(alt);
                                common.CLog(common.CLogTypes.debug, 'onNmeaMessage', timestamp, tokens, locationListener.mLastMslAltitude);
                            }
                        }
                    }
                },
            }) as OnNmeaListener<T>;
        } else {
            // TODO: bring back when https://github.com/NativeScript/android-runtime/issues/1645 is fixed
            // locationListener._nmeaListener = new android.location.GpsStatus.NmeaListener({
            //     onNmeaReceived(timestamp: number, nmea: string) {
            //         const locationListener = (this as NmeaListener<T>).locationListener && (this as NmeaListener<T>).locationListener.get();
            //         if (locationListener && nmea[0] === '$') {
            //             const tokens = nmea.split(',');
            //             const type = tokens[0];
            //             const alt = tokens[9];

            //             // Parse altitude above sea level, Detailed description of NMEA string here http://aprs.gids.nl/nmea/#gga
            //             if (type.endsWith('GGA')) {
            //                 if (alt && alt.length > 0) {
            //                     locationListener.mLastMslAltitudeTimestamp = timestamp;
            //                     locationListener.mLastMslAltitude = parseFloat(alt);
            //                     common.CLog(common.CLogTypes.debug, 'onNmeaReceived', timestamp, tokens, locationListener.mLastMslAltitude);
            //                 }
            //             }
            //         }
            //     },
            // }) as NmeaListener<T>;
        }
        locationListener._nmeaListener.locationListener = new WeakRef(locationListener);
    }
    return locationListener;
}

function locationFromAndroidLocation<T = DefaultLatLonKeys>(androidLocation: android.location.Location): common.GenericGeoLocation<T> {
    const location = {} as common.GenericGeoLocation<T>;

    location.provider = androidLocation.getProvider();
    location[common.LatitudeKey] = androidLocation.getLatitude();
    location[common.LongitudeKey] = androidLocation.getLongitude();
    if (androidLocation.hasAltitude()) {
        location[common.AltitudeKey] = androidLocation.getAltitude();
    }
    location.horizontalAccuracy = androidLocation.getAccuracy();
    if (androidLocation.hasSpeed()) {
        location.speed = androidLocation.getSpeed();
    }
    if (androidLocation.hasBearing()) {
        location.bearing = androidLocation.getBearing();
    }

    if (getAndroidSDK() >= OREO && androidLocation.hasVerticalAccuracy()) {
        location.verticalAccuracy = androidLocation.getVerticalAccuracyMeters();
    } else {
        location.verticalAccuracy = androidLocation.getAccuracy();
    }
    // if (androidLocation.hasBearingAccuracy()) {
    //     location.bearing = androidLocation.getBearing();
    // }
    const bootTime = java.lang.System.currentTimeMillis() - android.os.SystemClock.elapsedRealtime();

    // we use elapseRealtime because getTime() is wrong on some devices
    const sinceBoot = Math.round(androidLocation.getElapsedRealtimeNanos() / 1000000);
    location.timestamp = bootTime + sinceBoot;
    location.age = Math.max(Date.now() - location.timestamp);
    location.elapsedBoot = sinceBoot;
    location.android = androidLocation;
    return location;
}

function androidLocationFromLocation<T = DefaultLatLonKeys>(location: common.GenericGeoLocation<T>): android.location.Location {
    const androidLocation = new android.location.Location('custom');
    androidLocation.setLatitude(location[common.LatitudeKey]);
    androidLocation.setLongitude(location[common.LongitudeKey]);
    if (location[common.AltitudeKey] !== undefined) {
        androidLocation.setAltitude(location[common.AltitudeKey]);
    }
    if (location.speed >= 0) {
        androidLocation.setSpeed(float(location.speed));
    }
    if (location.bearing >= 0) {
        androidLocation.setBearing(float(location.bearing));
    }
    if (location.timestamp) {
        try {
            androidLocation.setTime(long(location.timestamp));
        } catch (e) {
            console.error('invalid location timestamp');
        }
    }
    return androidLocation;
}

function criteriaFromOptions(options: Options): android.location.Criteria {
    const criteria = new android.location.Criteria();
    if (options && options.desiredAccuracy <= Accuracy.high) {
        criteria.setAccuracy(android.location.Criteria.ACCURACY_FINE);
    } else {
        criteria.setAccuracy(android.location.Criteria.ACCURACY_COARSE);
    }
    return criteria;
}

// function watchLocationCore(options: Options, locListener: android.location.LocationListener): void {
//     const criteria = criteriaFromOptions(options);
//     common.CLog(common.CLogTypes.debug, 'watchLocationCore', criteria, options, locListener);
//     try {
//         const updateTime = options && typeof options.minimumUpdateTime === 'number' ? options.minimumUpdateTime : minTimeUpdate;
//         const updateDistance = options && typeof options.updateDistance === 'number' ? options.updateDistance : minRangeUpdate;
//         if (options.provider) {
//             getAndroidLocationManager().requestLocationUpdates(options.provider, updateTime, updateDistance, locListener, null);
//         } else {
//             getAndroidLocationManager().requestLocationUpdates(updateTime, updateDistance, criteria, locListener, null);
//         }
//     } catch (e) {
//         common.CLog(common.CLogTypes.debug, 'watchLocationCore error', e);
//         LocationMonitor.stopLocationMonitoring((locListener as any).id);
//         throw e;
//     }
// }
export class GPS extends common.GPSCommon {
    enabled = false;
    constructor() {
        super();
        this.enabled = this.isEnabled();
        andApp.registerBroadcastReceiver(android.location.LocationManager.PROVIDERS_CHANGED_ACTION, this.onBroadcastReceiver);
    }
    onBroadcastReceiver = (context: android.content.Context, intent: android.content.Intent) => {
        if (intent.getAction() !== 'android.location.PROVIDERS_CHANGED') {
            return;
        }
        const oldValue = this.enabled;
        common.CLog(common.CLogTypes.debug, 'onBroadcastReceiver', oldValue);
        const newValue = this.isEnabled();
        if (oldValue !== newValue) {
            this.enabled = newValue;
            this.notify({
                eventName: common.GPSCommon.gps_status_event,
                object: this,
                data: {
                    enabled: newValue,
                },
            });
        }
    };
    prepareForRequest(options: Options) {
        common.CLog(common.CLogTypes.debug, 'prepareForRequest', options, this.isEnabled());
        return Promise.resolve()
            .then(() => {
                if (options.skipPermissionCheck === true) {
                    return undefined;
                }
                return this.isAuthorized().then((auth) => {
                    if (!auth) {
                        if (options.skipPermissionCheck !== true) {
                            return request('location');
                        } else {
                            return Promise.reject(new Error('location_service_not_granted'));
                        }
                    }
                    return undefined;
                });
            })
            .then(() => {
                if (!this.isEnabled()) {
                    if (options.dontOpenSettings !== true) {
                        return this.openGPSSettings();
                    } else {
                        return Promise.reject('location_service_not_enabled');
                    }
                }
                return undefined;
            });
    }
    openGPSSettings() {
        common.CLog(common.CLogTypes.debug, 'openGPSSettings', this.isEnabled());
        const activity = andApp.foregroundActivity || andApp.startActivity;
        return new Promise((resolve, reject) => {
            if (!this.isEnabled()) {
                const onActivityResultHandler = (data: AndroidActivityResultEventData) => {
                    if (data.requestCode === 5340) {
                        andApp.off(AndroidApplication.activityResultEvent, onActivityResultHandler);
                        common.CLog(common.CLogTypes.debug, 'openGPSSettingsCore done', data.requestCode, this.isEnabled());

                        if (this.isEnabled()) {
                            resolve();
                        } else {
                            reject('location_service_not_enabled');
                        }
                    }
                };
                andApp.on(AndroidApplication.activityResultEvent, onActivityResultHandler);
                activity.startActivityForResult(new android.content.Intent(android.provider.Settings.ACTION_LOCATION_SOURCE_SETTINGS), 5340);
            } else {
                resolve();
            }
        });
    }

    watchLocation<T = DefaultLatLonKeys>(successCallback: successCallbackType<T>, errorCallback: errorCallbackType, options: Options) {
        common.CLog(common.CLogTypes.debug, 'watchLocation', options);
        return this.prepareForRequest(options).then(() => {
            const locListener = LocationMonitor.createListenerWithCallbackAndOptions<T>(successCallback, options);
            try {
                LocationMonitor.startLocationMonitoring(options, locListener);
            } catch (e) {
                common.CLog(common.CLogTypes.debug, 'watchLocationCore error', e);
                LocationMonitor.stopLocationMonitoring((locListener as any).id);
                throw e;
            }
            // watchLocationCore(options, locListener);
            return (locListener as any).id;
        });
    }

    hasGPS() {
        const currentContext = andApp.context as android.content.Context;
        if (!currentContext) {
            return false;
        }
        return currentContext.getPackageManager().hasSystemFeature(android.content.pm.PackageManager.FEATURE_LOCATION_GPS);
    }

    getCurrentLocation<T = DefaultLatLonKeys>(options: Options): Promise<common.GenericGeoLocation<T>> {
        options = options || {};
        common.CLog(common.CLogTypes.debug, 'getCurrentLocation', options);

        if (options.timeout === 0) {
            // we should take any cached location e.g. lastKnownLocation
            return new Promise(function (resolve, reject) {
                const lastLocation = LocationMonitor.getLastKnownLocation<T>();
                if (lastLocation) {
                    if (typeof options.maximumAge === 'number') {
                        if (lastLocation.timestamp.valueOf() + options.maximumAge > new Date().valueOf()) {
                            resolve(lastLocation);
                        } else {
                            reject(new Error('Last known location too old!'));
                        }
                    } else {
                        resolve(lastLocation);
                    }
                } else {
                    reject(new Error('There is no last known location!'));
                }
            });
        }

        return this.prepareForRequest(options).then(() => new Promise<common.GenericGeoLocation<T>>(function (resolve, reject) {
            let timerId;
            const stopTimerAndMonitor = function (locListenerId: number) {
                if (timerId !== undefined) {
                    clearTimeout(timerId);
                }
                LocationMonitor.stopLocationMonitoring(locListenerId);
            };
            const successCallback = function (location: common.GenericGeoLocation<T>) {
                let readyToStop = false;
                if (options && typeof options.maximumAge === 'number') {
                    if (location.timestamp.valueOf() + options.maximumAge > new Date().valueOf()) {
                        resolve(location);
                        readyToStop = true;
                        // } else {
                        // reject(new Error('New location is older than requested maximum age!'));
                    }
                } else {
                    resolve(location);
                    readyToStop = true;
                }
                if (readyToStop) {
                    stopTimerAndMonitor((locListener as any).id);
                }
            };

            const locListener = LocationMonitor.createListenerWithCallbackAndOptions<T>(successCallback, options);
            try {
                LocationMonitor.startLocationMonitoring<T>(options, locListener);
            } catch (e) {
                stopTimerAndMonitor((locListener as any).id);
                reject(e);
            }

            if (options && typeof options.timeout === 'number') {
                timerId = setTimeout(function () {
                    LocationMonitor.stopLocationMonitoring((locListener as any).id);
                    resolve(null);
                }, options.timeout || common.defaultGetLocationTimeout);
            }
        }));
    }

    clearWatch(watchId: number): void {
        LocationMonitor.stopLocationMonitoring(watchId);
    }

    enable() {
        common.CLog(common.CLogTypes.debug, 'enable');
        return this.openGPSSettings();
    }

    isGPSEnabled(): boolean {
        const result = getAndroidLocationManager().isProviderEnabled(android.location.LocationManager.GPS_PROVIDER);
        common.CLog(common.CLogTypes.debug, 'isGPSEnabled', result);
        return result;
    }
    isEnabled(): boolean {
        // due to bug in android API getProviders() with criteria parameter overload should be called (so most loose accuracy is used).
        const enabledProviders = getAndroidLocationManager().getProviders(true);
        const nbProviders = enabledProviders.size();

        let acceptableProviders = 0;
        for (let index = 0; index < enabledProviders.size(); index++) {
            const provider = enabledProviders.get(index);
            common.CLog(common.CLogTypes.debug, 'enabled provider:', enabledProviders.get(index));
            if (provider !== 'local_database' && provider !== 'passive') {
                acceptableProviders++;
            }
        }
        common.CLog(common.CLogTypes.debug, 'isLocationServiceEnabled', enabledProviders.size(), nbProviders, acceptableProviders);
        return acceptableProviders > 0;
    }

    distance<T = DefaultLatLonKeys>(loc1: common.GenericGeoLocation<T>, loc2: common.GenericGeoLocation<T>): number {
        const andLoc1 = loc1.android || androidLocationFromLocation<T>(loc1);
        const andLoc2 = loc2.android || androidLocationFromLocation<T>(loc2);
        return andLoc1.distanceTo(andLoc2);
    }
}

export class LocationMonitor implements LocationMonitorDef {
    static getLastKnownLocation<T = DefaultLatLonKeys>(): common.GenericGeoLocation<T> {
        const criteria = new android.location.Criteria();
        criteria.setAccuracy(android.location.Criteria.ACCURACY_COARSE);
        try {
            const iterator = getAndroidLocationManager().getProviders(criteria, false).iterator();
            let androidLocation;
            while (iterator.hasNext()) {
                const provider = iterator.next() as string;
                const tempLocation = getAndroidLocationManager().getLastKnownLocation(provider);
                if (!androidLocation || tempLocation.getTime() > androidLocation.getTime()) {
                    androidLocation = tempLocation;
                }
            }
            if (androidLocation) {
                return locationFromAndroidLocation<T>(androidLocation);
            }
        } catch (e) {
            Trace.write('Error: ' + e.message, 'Error');
        }
        return null;
    }

    static startLocationMonitoring<T = DefaultLatLonKeys>(options: Options, listener: LocationListener<T>): void {
        const updateTime = options && typeof options.minimumUpdateTime === 'number' ? options.minimumUpdateTime : minTimeUpdate;
        const updateDistance = options && typeof options.updateDistance === 'number' ? options.updateDistance : minRangeUpdate;
        const manager = getAndroidLocationManager();
        if (options.provider) {
            manager.requestLocationUpdates(options.provider, updateTime, updateDistance, listener, null);
        } else {
            manager.requestLocationUpdates(updateTime, updateDistance, criteriaFromOptions(options), listener, null);
        }
        if (listener._nmeaListener) {
            manager.addNmeaListener(listener._nmeaListener as any);
        }
    }

    static createListenerWithCallbackAndOptions<T = DefaultLatLonKeys>(successCallback: successCallbackType<T>, options: Options) {
        return createLocationListener<T>(successCallback, options);
    }

    static stopLocationMonitoring(locListenerId: number): void {
        const listener = locationListeners[locListenerId];
        if (listener) {
            const manager = getAndroidLocationManager();
            manager.removeUpdates(listener);
            if (listener._nmeaListener) {
                manager.removeNmeaListener(listener._nmeaListener as any);
                listener._nmeaListener.locationListener = null;
                listener._nmeaListener = null;
            }
            delete locationListeners[locListenerId];
        }
    }
}
