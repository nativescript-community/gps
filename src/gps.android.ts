import { request } from '@nativescript-community/perms';
import { CoreTypes, Trace, Utils } from '@nativescript/core';
import { AndroidActivityResultEventData, AndroidApplication, android as andApp } from '@nativescript/core/application';
import { AltitudeKey, CLog, CLogTypes, GPSCommon, GenericGeoLocation, LatitudeKey, LongitudeKey, defaultGetLocationTimeout } from './gps.common';
import { DefaultLatLonKeys } from './location';
import { LocationMonitor as LocationMonitorDef, Options, errorCallbackType, successCallbackType } from './location-monitor';

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
        androidLocationManager = Utils.ad.getApplicationContext().getSystemService(android.content.Context.LOCATION_SERVICE) as android.location.LocationManager;
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
        onLocationChanged(location: android.location.Location | java.util.List<android.location.Location>) {
            if (!location) {
                return;
            }
            const locations: android.location.Location[] = [];
            if (typeof location['getProvider'] === 'function') {
                locations.push(location as android.location.Location);
            } else {
                // must be an List!
                for (let index = 0; index < (location as java.util.List<android.location.Location>).size(); index++) {
                    locations.push((location as java.util.List<android.location.Location>).get(index));

                }
            }
            if (Trace.isEnabled()) {
                CLog(CLogTypes.debug, 'onLocationChanged', locations.map(locationFromAndroidLocation));
            }
            const that = this as LocationListener<T>;
            const locationCallback = that._onLocation;
            if (locationCallback) {
                locations.forEach(location=>{
                    const loc = locationFromAndroidLocation<T>(location);
                    const updateTime = options && typeof options.minimumUpdateTime === 'number' ? options.minimumUpdateTime : minTimeUpdate;
                    if (that.mLastMslAltitudeTimestamp) {
                        if (loc.timestamp - that.mLastMslAltitudeTimestamp <= updateTime) {
                            loc.mslAltitude = that.mLastMslAltitude;
                        }
                    }
                    locationCallback(loc);
                });

            }
        },

        onProviderDisabled(provider) {
            if (Trace.isEnabled()) {
                CLog(CLogTypes.debug, 'onProviderEnabled', provider);
            }
        },

        onProviderEnabled(provider) {
            if (Trace.isEnabled()) {
                CLog(CLogTypes.debug, 'onProviderEnabled', provider);
            }
        },

        onStatusChanged(arg1, arg2, arg3) {
            if (Trace.isEnabled()) {
                CLog(CLogTypes.debug, 'onStatusChanged', arg1, arg2, arg3);
            }
        },
    }) as LocationListener<T>;
    watchId++;
    locationListener._onLocation = successCallback;
    locationListener.id = watchId;
    locationListeners[watchId] = locationListener;
    if (Trace.isEnabled()) {
        CLog(CLogTypes.debug, 'createLocationListener', options.nmeaAltitude, getAndroidSDK());
    }
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
                                if (Trace.isEnabled()) {
                                    CLog(CLogTypes.debug, 'onNmeaMessage', timestamp, tokens, locationListener.mLastMslAltitude);
                                }
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
            //                 }
            //             }
            //         }
            //     },
            // }) as NmeaListener<T>;
        }
        if (locationListener._nmeaListener) {
            locationListener._nmeaListener.locationListener = new WeakRef(locationListener);
        }
    }
    return locationListener;
}

function locationFromAndroidLocation<T = DefaultLatLonKeys>(androidLocation: android.location.Location): GenericGeoLocation<T> {
    const location = {} as GenericGeoLocation<T>;

    location.provider = androidLocation.getProvider();
    location[LatitudeKey] = androidLocation.getLatitude();
    location[LongitudeKey] = androidLocation.getLongitude();
    if (androidLocation.hasAltitude()) {
        location[AltitudeKey] = androidLocation.getAltitude();
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

    const bootTime = java.lang.System.currentTimeMillis() - android.os.SystemClock.elapsedRealtime();
    // we use elapseRealtime because getTime() is wrong on some devices
    let sinceBoot = androidLocation.getElapsedRealtimeNanos();
    if (Trace.isEnabled()) {
        CLog(CLogTypes.debug, 'locationFromAndroidLocation', {getTime:androidLocation.getTime(), elapsedRealtime:android.os.SystemClock.elapsedRealtime(), currentTimeMillis:java.lang.System.currentTimeMillis(), bootTime, sinceBoot, sinceBootValue:sinceBoot['value']});
    }
    // sinceBoot can be returned as a NativeScriptLongNumber for which we need to parse the string `value`
    if (sinceBoot['value']) {
        sinceBoot = parseInt(sinceBoot['value'], 10);
    }

    sinceBoot = Math.round(sinceBoot / 1000000);
    if (isNaN(sinceBoot)) {
        location.timestamp = androidLocation.getTime();
    } else {
        location.timestamp = bootTime + sinceBoot;
    }
    location.age = Math.max(Date.now() - location.timestamp, 0);
    location.elapsedBoot = sinceBoot;
    location.android = androidLocation;
    return location;
}

function androidLocationFromLocation<T = DefaultLatLonKeys>(location: GenericGeoLocation<T>): android.location.Location {
    const androidLocation = new android.location.Location('custom');
    androidLocation.setLatitude(location[LatitudeKey]);
    androidLocation.setLongitude(location[LongitudeKey]);
    if (location[AltitudeKey] !== undefined) {
        androidLocation.setAltitude(location[AltitudeKey]);
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
    if (options && options.desiredAccuracy <= CoreTypes.Accuracy.high) {
        criteria.setAccuracy(android.location.Criteria.ACCURACY_FINE);
    } else {
        criteria.setAccuracy(android.location.Criteria.ACCURACY_COARSE);
    }
    return criteria;
}

export class GPS extends GPSCommon {
    enabled = this.isEnabled();
    broadcastRegistered = false;
    registerBroadcast() {
        if (this.broadcastRegistered) {
            return;
        }
        this.broadcastRegistered = true;
        if (Trace.isEnabled()) {
            CLog(CLogTypes.info, 'Android Bluetooth  registering for state change');
        }

        const onBroadcastReceiver = () => {
            const oldValue = this.enabled;
            if (Trace.isEnabled()) {
                CLog(CLogTypes.debug, 'onBroadcastReceiver', oldValue);
            }
            const newValue = this.isEnabled();
            if (oldValue !== newValue) {
                this.enabled = newValue;
                this.notify({
                    eventName: GPSCommon.gps_status_event,
                    object: this,
                    data: {
                        enabled: newValue,
                    },
                });
            }
        };
        andApp.registerBroadcastReceiver(android.location.LocationManager.PROVIDERS_CHANGED_ACTION, onBroadcastReceiver);
        andApp.registerBroadcastReceiver(android.location.LocationManager.MODE_CHANGED_ACTION, onBroadcastReceiver);
    }
    unregisterBroadcast() {
        if (!this.broadcastRegistered) {
            return;
        }
        this.broadcastRegistered = false;
        andApp.unregisterBroadcastReceiver(android.location.LocationManager.PROVIDERS_CHANGED_ACTION);
        andApp.unregisterBroadcastReceiver(android.location.LocationManager.MODE_CHANGED_ACTION);
    }
    onListenerAdded(eventName, count) {
        if (Trace.isEnabled()) {
            CLog(CLogTypes.info, 'onListenerAdded', eventName, count);
        }
        if (eventName === GPSCommon.gps_status_event) {
            this.registerBroadcast();
        }
    }
    onListenerRemoved(eventName, count) {
        if (Trace.isEnabled()) {
            CLog(CLogTypes.info, 'onListenerRemoved', eventName, count);
        }
        if (eventName === GPSCommon.gps_status_event && count === 0) {
            this.unregisterBroadcast();
        }
    }
    stop() {
        this.unregisterBroadcast();
    }
    async prepareForRequest(options: Options) {
        if (Trace.isEnabled()) {
            CLog(CLogTypes.debug, 'prepareForRequest', options, this.isEnabled());
        }
        if (options.skipPermissionCheck === true) {
            return true;
        }
        const auth = await this.isAuthorized();
        if (!auth) {
            await request('location');
        }
        if (!this.isEnabled()) {
            if (options.dontOpenSettings !== true) {
                return this.openGPSSettings();
            } else {
                throw new Error('location_service_not_enabled');
            }
        } else {
            return true;
        }
    }
    openGPSSettings() {
        if (Trace.isEnabled()) {
            CLog(CLogTypes.debug, 'openGPSSettings', this.isEnabled());
        }
        const activity = andApp.foregroundActivity || andApp.startActivity;
        return new Promise<boolean>((resolve, reject) => {
            if (!this.isEnabled()) {
                const onActivityResultHandler = (data: AndroidActivityResultEventData) => {
                    if (data.requestCode === 5340) {
                        andApp.off(AndroidApplication.activityResultEvent, onActivityResultHandler);
                        if (Trace.isEnabled()) {
                            CLog(CLogTypes.debug, 'openGPSSettingsCore done', data.requestCode, this.isEnabled());
                        }
                        resolve(this.isEnabled());
                        // if (this.isEnabled()) {
                        //     resolve();
                        // } else {
                        //     reject('location_service_not_enabled');
                        // }
                    }
                };
                andApp.on(AndroidApplication.activityResultEvent, onActivityResultHandler);
                activity.startActivityForResult(new android.content.Intent(android.provider.Settings.ACTION_LOCATION_SOURCE_SETTINGS), 5340);
            } else {
                resolve(true);
            }
        });
    }

    async watchLocation<T = DefaultLatLonKeys>(successCallback: successCallbackType<T>, errorCallback: errorCallbackType, options: Options) {
        if (Trace.isEnabled()) {
            CLog(CLogTypes.debug, 'watchLocation', options);
        }
        await this.prepareForRequest(options);
        if (Trace.isEnabled()) {
            CLog(CLogTypes.debug, 'watchLocation prepared', options);
        }
        const locListener = LocationMonitor.createListenerWithCallbackAndOptions<T>(successCallback, options);
        try {
            LocationMonitor.startLocationMonitoring(options, locListener);
        } catch (e) {
            if (Trace.isEnabled()) {
                CLog(CLogTypes.debug, 'watchLocationCore error', e);
            }
            LocationMonitor.stopLocationMonitoring((locListener as any).id);
            errorCallback(e);
            throw e;
        }
        return (locListener as any).id;
    }

    hasGPS() {
        const currentContext = andApp.context as android.content.Context;
        if (!currentContext) {
            return false;
        }
        return currentContext.getPackageManager().hasSystemFeature(android.content.pm.PackageManager.FEATURE_LOCATION_GPS);
    }

    getCurrentLocation<T = DefaultLatLonKeys>(options: Options): Promise<GenericGeoLocation<T>> {
        options = options || {};
        if (Trace.isEnabled()) {
            CLog(CLogTypes.debug, 'getCurrentLocation', options);
        }

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

        return this.prepareForRequest(options).then(() => new Promise<GenericGeoLocation<T>>(function (resolve, reject) {
            let timerId;
            const stopTimerAndMonitor = function (locListenerId: number) {
                if (timerId !== undefined) {
                    clearTimeout(timerId);
                }
                LocationMonitor.stopLocationMonitoring(locListenerId);
            };
            const successCallback = function (location: GenericGeoLocation<T>) {
                let readyToStop = false;
                if (options && typeof options.maximumAge === 'number') {
                    if (location.timestamp.valueOf() + options.maximumAge > new Date().valueOf()) {
                        resolve(location);
                        readyToStop = true;
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
                }, options.timeout || defaultGetLocationTimeout);
            }
        }));
    }

    clearWatch(watchId: number): void {
        LocationMonitor.stopLocationMonitoring(watchId);
    }

    enable() {
        if (Trace.isEnabled()) {
            CLog(CLogTypes.debug, 'enable');
        }
        return this.openGPSSettings();
    }

    isGPSEnabled(): boolean {
        const result = getAndroidLocationManager().isProviderEnabled(android.location.LocationManager.GPS_PROVIDER);
        if (Trace.isEnabled()) {
            CLog(CLogTypes.debug, 'isGPSEnabled', result);
        }
        return result;
    }
    isEnabled(): boolean {
        // due to bug in android API getProviders() with criteria parameter overload should be called (so most loose accuracy is used).
        const enabledProviders = getAndroidLocationManager().getProviders(true);
        const nbProviders = enabledProviders.size();

        let acceptableProviders = 0;
        for (let index = 0; index < enabledProviders.size(); index++) {
            const provider = enabledProviders.get(index);
            if (Trace.isEnabled()) {
                CLog(CLogTypes.debug, 'enabled provider:', enabledProviders.get(index));
            }
            if (provider !== 'local_database' && provider !== 'passive') {
                acceptableProviders++;
            }
        }
        if (Trace.isEnabled()) {
            CLog(CLogTypes.debug, 'isLocationServiceEnabled', enabledProviders.size(), nbProviders, acceptableProviders);
        }
        return acceptableProviders > 0;
    }

    distance<T = DefaultLatLonKeys>(loc1: GenericGeoLocation<T>, loc2: GenericGeoLocation<T>): number {
        const andLoc1 = loc1.android || androidLocationFromLocation<T>(loc1);
        const andLoc2 = loc2.android || androidLocationFromLocation<T>(loc2);
        return andLoc1.distanceTo(andLoc2);
    }
    getLastKnownLocation<T = DefaultLatLonKeys>(): GenericGeoLocation<T> {
        return LocationMonitor.getLastKnownLocation();
    }
}

export class LocationMonitor implements LocationMonitorDef {
    static getLastKnownLocation<T = DefaultLatLonKeys>(): GenericGeoLocation<T> {
        const providers = getAndroidLocationManager().getProviders(false);
        let androidLocation: android.location.Location;
        for (let index = 0; index < providers.size(); index++) {
            const provider = providers.get(index);
            const tempLocation = getAndroidLocationManager().getLastKnownLocation(provider);
            if (!tempLocation) {
                continue;
            }
            if (!androidLocation || tempLocation.getTime() > androidLocation.getTime() || tempLocation.getAccuracy() < androidLocation.getAccuracy()) {
                androidLocation = tempLocation;
            }
        }
        if (androidLocation) {
            return locationFromAndroidLocation<T>(androidLocation);
        }
        return null;
    }

    static startLocationMonitoring<T = DefaultLatLonKeys>(options: Options, listener: LocationListener<T>): void {
        const updateTime = options && typeof options.minimumUpdateTime === 'number' ? options.minimumUpdateTime : minTimeUpdate;
        const updateDistance = options && typeof options.updateDistance === 'number' ? options.updateDistance : minRangeUpdate;
        const manager = getAndroidLocationManager();

        const looper: android.os.Looper = android.os.Looper.myLooper();
        if (Trace.isEnabled()) {
            CLog(CLogTypes.debug, 'requestLocationUpdates', options.provider, updateTime, updateDistance, looper, looper=== android.os.Looper.getMainLooper());
        }
        if (options.provider) {
            manager.requestLocationUpdates(options.provider, updateTime, updateDistance, listener, looper);
        } else {
            manager.requestLocationUpdates(updateTime, updateDistance, criteriaFromOptions(options), listener, looper);
        }
        if (listener._nmeaListener) {
            manager.addNmeaListener(listener._nmeaListener as any);
        }
    }

    static createListenerWithCallbackAndOptions<T = DefaultLatLonKeys>(successCallback: successCallbackType<T>, options: Options) {
        return createLocationListener<T>(successCallback, options);
    }

    static getLocationMonitoring(locListenerId: number)  {
        return getAndroidLocationManager();
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
