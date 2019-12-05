import * as enums from '@nativescript/core/ui/enums';
import * as timer from '@nativescript/core/timer';
import { DefaultLatLonKeys, GeoLocation, GenericGeoLocation } from './location';
import { deferredCallbackType, errorCallbackType, LocationMonitor as LocationMonitorDef, Options, successCallbackType } from './location-monitor';
import * as common from './nativescript-gps.common';
import * as perms from 'nativescript-perms';
import * as appModule from '@nativescript/core/application';
export * from './nativescript-gps.common';

export { Options, successCallbackType, errorCallbackType, deferredCallbackType };

const locationManagers = {};
const locationListeners = {};
let watchId = 0;
const minRangeUpdate = 0; // 0 meters
const defaultGetLocationTimeout = 5 * 60 * 1000; // 5 minutes

export class LocationChangeListenerImpl extends NSObject implements CLLocationManagerDelegate {
    public static ObjCProtocols = [CLLocationManagerDelegate];
    owner: WeakRef<GPS>;
    public static initWithOwner(owner: WeakRef<GPS>) {
        const listener = LocationChangeListenerImpl.new() as LocationChangeListenerImpl;
        listener.owner = owner;
        return listener;
    }

    public locationManagerDidChangeAuthorizationStatus(manager: CLLocationManager, status: CLAuthorizationStatus) {
        common.CLog(common.CLogTypes.info, `LocationListenerImpl.locationManagerDidChangeAuthorizationStatus(${status})`);
        const owner = this.owner && this.owner.get();
        if (owner) {
            const enabled = status === CLAuthorizationStatus.kCLAuthorizationStatusAuthorizedAlways || status === CLAuthorizationStatus.kCLAuthorizationStatusAuthorizedWhenInUse;
            owner.notify({
                eventName: common.GPSCommon.gps_status_event,
                object: owner,
                data: {
                    enabled,
                    authorizationStatus: status
                }
            });
        }
        common.CLog(common.CLogTypes.info, `LocationListenerImpl.locationManagerDidChangeAuthorizationStatus(${status}) done`);
    }
}

export class LocationListenerImpl<T = DefaultLatLonKeys> extends NSObject implements CLLocationManagerDelegate {
    public static ObjCProtocols = [CLLocationManagerDelegate];

    public authorizeAlways: boolean;
    public id: number;
    private _onLocation: successCallbackType<T>;
    private _onError: errorCallbackType;
    private _onDeferred: deferredCallbackType;
    // private _resolve: () => void;
    // private _reject: (error: Error) => void;

    public static initWithLocationError<T = DefaultLatLonKeys>(successCallback: successCallbackType<T>, error?: errorCallbackType, options?: Options): LocationListenerImpl<T> {
        const listener = LocationListenerImpl.new() as LocationListenerImpl<T>;
        watchId++;
        listener.id = watchId;
        listener._onLocation = successCallback;
        listener._onError = error;
        listener._onDeferred = options && options.onDeferred;

        return listener;
    }

    // public static initWithPromiseCallbacks(resolve: () => void, reject: (error: Error) => void, authorizeAlways: boolean = false): LocationListenerImpl {
    //     const listener = LocationListenerImpl.new() as LocationListenerImpl;
    //     watchId++;
    //     listener.id = watchId;
    //     listener._resolve = resolve;
    //     listener._reject = reject;
    //     listener.authorizeAlways = authorizeAlways;

    //     return listener;
    // }

    public locationManagerDidUpdateLocations(manager: CLLocationManager, locations: NSArray<CLLocation>): void {
        common.CLog(common.CLogTypes.info, `LocationListenerImpl.locationManagerDidUpdateLocations(${locations})`);
        if (this._onLocation) {
            for (let i = 0, count = locations.count; i < count; i++) {
                const location = locationFromCLLocation<T>(locations.objectAtIndex(i));
                this._onLocation(location, manager);
            }
        }
    }
    public locationManagerDidFinishDeferredUpdatesWithError(manager: CLLocationManager, error: NSError): void {
        if (this._onDeferred) {
            common.CLog(common.CLogTypes.info, `LocationListenerImpl.locationManagerDidFinishDeferredUpdatesWithError(${error})`);
            this._onDeferred(error ? new Error(error.localizedDescription) : null);
        }
    }

    public locationManagerDidFailWithError(manager: CLLocationManager, error: NSError): void {
        common.CLog(common.CLogTypes.info, `LocationListenerImpl.locationManagerDidFailWithError(${error})`);
        if (this._onError) {
            this._onError(new Error(error.localizedDescription));
        }
    }

    // public locationManagerDidChangeAuthorizationStatus(manager: CLLocationManager, status: CLAuthorizationStatus) {
    //     common.CLog(common.CLogTypes.info, `LocationListenerImpl.locationManagerDidChangeAuthorizationStatus(${status})`);
    //     switch (status) {
    //         case CLAuthorizationStatus.kCLAuthorizationStatusNotDetermined:
    //             break;

    //         case CLAuthorizationStatus.kCLAuthorizationStatusRestricted:
    //             break;

    //         case CLAuthorizationStatus.kCLAuthorizationStatusDenied:
    //             if (this._reject) {
    //                 LocationMonitor.stopLocationMonitoring(this.id);
    //                 this._reject(new Error('Authorization Denied.'));
    //             }
    //             break;

    //         case CLAuthorizationStatus.kCLAuthorizationStatusAuthorizedAlways:
    //             if (this.authorizeAlways && this._resolve) {
    //                 LocationMonitor.stopLocationMonitoring(this.id);
    //                 this._resolve();
    //             } else if (this._reject) {
    //                 LocationMonitor.stopLocationMonitoring(this.id);
    //                 this._reject(new Error('Authorization Denied.'));
    //             }
    //             break;

    //         case CLAuthorizationStatus.kCLAuthorizationStatusAuthorizedWhenInUse:
    //             if (!this.authorizeAlways && this._resolve) {
    //                 LocationMonitor.stopLocationMonitoring(this.id);
    //                 this._resolve();
    //             } else if (this._reject) {
    //                 LocationMonitor.stopLocationMonitoring(this.id);
    //                 this._reject(new Error('Authorization Denied.'));
    //             }
    //             break;

    //         default:
    //             break;
    //     }
    // }
}

function locationFromCLLocation<T = DefaultLatLonKeys>(clLocation: CLLocation): GenericGeoLocation<T> {
    const location = {} as GenericGeoLocation<T>;
    location[common.LatitudeKey] = clLocation.coordinate.latitude;
    location[common.LongitudeKey] = clLocation.coordinate.longitude;
    location[common.AltitudeKey] = clLocation.altitude;
    location.horizontalAccuracy = clLocation.horizontalAccuracy;
    location.verticalAccuracy = clLocation.verticalAccuracy;
    if (clLocation.speed >= 0) {
        location.speed = clLocation.speed;
    }
    if (clLocation.course >= 0) {
        location.bearing = clLocation.course;
    }
    const ms = NSDate.dateWithTimeIntervalSinceDate(0, clLocation.timestamp).timeIntervalSince1970 * 1000;
    const bootElapsedms = (NSDate as any).bootTimeTimeIntervalSinceReferenceDate() * 1000;
    const deltams = Math.max(Date.now() - ms, 0);
    location.timestamp = ms;
    location.age = deltams;
    location.elapsedBoot = bootElapsedms - deltams;
    // console.log('locationFromCLLocation', timeIntervalSince1970, ms, (NSDate as any).bootTimeTimeIntervalSinceReferenceDate, bootElapsed, delta, bootElapsed - delta);
    location.ios = clLocation;
    return location;
}

function clLocationFromLocation<T>(location: GenericGeoLocation<T>): CLLocation {
    const hAccuracy = location.horizontalAccuracy ? location.horizontalAccuracy : -1;
    const vAccuracy = location.verticalAccuracy ? location.verticalAccuracy : -1;
    const speed = location.speed ? location.speed : -1;
    const course = location.bearing ? location.bearing : -1;
    const altitude = location[common.AltitudeKey] ? location[common.AltitudeKey] : -1;
    const timestamp = location.timestamp ? NSDate.dateWithTimeIntervalSince1970(location.timestamp / 1000) : null;
    const iosLocation = CLLocation.alloc().initWithCoordinateAltitudeHorizontalAccuracyVerticalAccuracyCourseSpeedTimestamp(
        CLLocationCoordinate2DMake(location[common.LatitudeKey], location[common.LongitudeKey]),
        altitude,
        hAccuracy,
        vAccuracy,
        course,
        speed,
        timestamp as any
    );
    return iosLocation;
}

export class GPS extends common.GPSCommon {
    enabled = false;
    iosChangeLocManager: CLLocationManager;
    iosChangeLocListener: LocationChangeListenerImpl;
    constructor() {
        super();
        common.CLog(common.CLogTypes.debug, '*** iOS GPS Constructor ***');
        this.enabled = this.isEnabled();
    }
    onListenerAdded(eventName: string, count: number) {
        common.CLog(common.CLogTypes.debug, 'onListenerAdded', eventName, count);
        if (eventName === GPS.gps_status_event) {
            if (!this.iosChangeLocManager) {
                this.iosChangeLocManager = new CLLocationManager();
                common.CLog(common.CLogTypes.debug, 'GPS created iosChangeLocManager', this.iosChangeLocManager);
                this.iosChangeLocListener = LocationChangeListenerImpl.initWithOwner(new WeakRef(this));
                common.CLog(common.CLogTypes.debug, 'GPS created delegate', this.iosChangeLocListener);
                this.iosChangeLocManager.delegate = this.iosChangeLocListener;
            }
        }
    }
    onListenerRemoved(eventName: string, count: number) {
        common.CLog(common.CLogTypes.debug, 'onListenerRemoved', eventName, count);
        if (eventName === GPS.gps_status_event && count === 0) {
            if (this.iosChangeLocManager) {
                common.CLog(common.CLogTypes.debug, 'deleting', 'iosChangeLocManager');
                this.iosChangeLocManager.delegate = null;
                this.iosChangeLocManager = null;
                this.iosChangeLocListener = null;
            }
        }
    }
    prepareForRequest(options: Options) {
        common.CLog(common.CLogTypes.debug, 'prepareForRequest', options);
        return Promise.resolve()
            .then(() => {
                return this.isAuthorized().then(auth => {
                    if (!auth) {
                        if (options.skipPermissionCheck !== true) {
                            common.CLog(common.CLogTypes.debug, 'requesting location permission');
                            return perms.request('location');
                        } else {
                            return Promise.reject(new Error('Location service is not granted.'));
                        }
                    }
                    return undefined;
                });
            })
            .then(() => {
                common.CLog(common.CLogTypes.debug, 'finished authorize', this.isEnabled());
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
    // options - desiredAccuracy, updateDistance, minimumUpdateTime, maximumAge, timeout
    getCurrentLocation<T = DefaultLatLonKeys>(options: Options): Promise<GenericGeoLocation<T>> {
        options = options || {};
        common.CLog(common.CLogTypes.debug, 'getCurrentLocation', options);
        if (options.timeout === 0) {
            // we should take any cached location e.g. lastKnownLocation
            return new Promise(function(resolve, reject) {
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
        return this.prepareForRequest(options).then(() => {
            return new Promise<GenericGeoLocation<T>>((resolve, reject) => {
                let timerId;
                if (!this.isEnabled()) {
                    reject(new Error('Location service is disabled'));
                }

                const stopTimerAndMonitor = function(locListenerId) {
                    if (timerId !== undefined) {
                        timer.clearTimeout(timerId);
                    }

                    LocationMonitor.stopLocationMonitoring(locListenerId);
                };

                const successCallback = function(location: GenericGeoLocation<T>) {
                    let readyToStop = false;
                    if (typeof options.maximumAge === 'number') {
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
                        stopTimerAndMonitor(locListener.id);
                    }
                };

                const locListener = LocationListenerImpl.initWithLocationError<T>(successCallback, null, options);
                try {
                    LocationMonitor.startLocationMonitoring<T>(options, locListener);
                } catch (e) {
                    stopTimerAndMonitor(locListener.id);
                    reject(e);
                }

                if (typeof options.timeout === 'number') {
                    timerId = timer.setTimeout(function() {
                        LocationMonitor.stopLocationMonitoring(locListener.id);
                        resolve(null);
                    }, options.timeout || defaultGetLocationTimeout);
                }
            });
        });
    }

    watchLocation<T = DefaultLatLonKeys>(successCallback: successCallbackType<T>, errorCallback: errorCallbackType, options: Options) {
        return this.prepareForRequest(options).then(() => {
            options = options || {};
            const locListener = LocationListenerImpl.initWithLocationError(successCallback, errorCallback, options);
            try {
                const iosLocManager = LocationMonitor.createiOSLocationManager<T>(locListener, options);
                // if (options.background) {
                iosLocManager.allowsBackgroundLocationUpdates = options.allowsBackgroundLocationUpdates === true;
                iosLocManager.pausesLocationUpdatesAutomatically = options.pausesLocationUpdatesAutomatically !== false;
                iosLocManager.activityType = options.activityType || CLActivityType.Fitness;

                // }
                common.CLog(common.CLogTypes.info, `gps: watchLocation(${options}, ${locListener})`);
                iosLocManager.startUpdatingLocation();
                if (!!options.deferredLocationUpdates) {
                    iosLocManager.allowDeferredLocationUpdatesUntilTraveledTimeout(options.deferredLocationUpdates.traveled, options.deferredLocationUpdates.timeout);
                }
                return locListener.id;
            } catch (e) {
                LocationMonitor.stopLocationMonitoring(locListener.id);
                errorCallback(e);
                return null;
            }
        });
    }

    clearWatch(watchId: number): void {
        LocationMonitor.stopLocationMonitoring(watchId);
    }
    hasGPS() {
        return true;
    }
    openGPSSettings(): Promise<void> {
        common.CLog(common.CLogTypes.debug, 'openGPSSettings');
        if (!this.isEnabled()) {
            return new Promise((resolve, reject) => {
                const settingsUrl = NSURL.URLWithString(UIApplicationOpenSettingsURLString);
                if (UIApplication.sharedApplication.canOpenURL(settingsUrl)) {
                    UIApplication.sharedApplication.openURLOptionsCompletionHandler(settingsUrl, null, success => {
                        common.CLog(common.CLogTypes.debug, 'openGPSSettings', 'did open settings', success);
                        // we get the callback for opening the URL, not enabling the GPS!
                        if (success) {
                            const onResume = () => {
                                common.CLog(common.CLogTypes.debug, 'openGPSSettings', 'resume');
                                appModule.off(appModule.resumeEvent, onResume);
                                if (this.isEnabled()) {
                                    resolve();
                                } else {
                                    reject('location_service_not_enabled');
                                }
                            };
                            appModule.on(appModule.resumeEvent, onResume);
                            return Promise.reject(undefined);
                            // }
                        } else {
                            return Promise.reject('cant_open_settings');
                        }
                    });
                }
            });
        }
        return Promise.resolve();
    }
    enable(): Promise<void> {
        common.CLog(common.CLogTypes.debug, 'enable');
        return this.openGPSSettings();
    }
    authorize(always?: boolean): Promise<boolean> {
        common.CLog(common.CLogTypes.debug, 'authorize', always);
        return perms
            .request('location', {
                type: always ? 'always' : undefined
            })
            .then(s => s === 'authorized');
    }
    // authorizeLocationRequest(always?: boolean): Promise<void> {
    //     return new Promise<void>(function(resolve, reject) {
    //         if (isLocationServiceAuthorized()) {
    //             resolve();
    //             return;
    //         }

    //         const listener = LocationListenerImpl.initWithPromiseCallbacks(resolve, reject, always);
    //         try {
    //             const manager = LocationMonitor.createiOSLocationManager(listener, null);
    //             if (always) {
    //                 manager.requestAlwaysAuthorization();
    //             } else {
    //                 manager.requestWhenInUseAuthorization();
    //             }
    //         } catch (e) {
    //             LocationMonitor.stopLocationMonitoring(listener.id);
    //             reject(e);
    //         }
    //     }).catch(err => {
    //         console.log('test promise authorizeLocationRequest error', err);
    //         return Promise.reject(err);
    //     });
    // }

    isEnabled(): boolean {
        return CLLocationManager.locationServicesEnabled();
    }

    isAuthorized() {
        return perms.check('location').then(s => s === 'authorized');
    }

    distance<T = DefaultLatLonKeys>(loc1: GenericGeoLocation<T>, loc2: GenericGeoLocation<T>): number {
        const iosdLoc1 = loc1.android || clLocationFromLocation<T>(loc1);
        const iosLoc2 = loc2.android || clLocationFromLocation<T>(loc2);
        return iosdLoc1.distanceFromLocation(iosLoc2);
    }
}
export class LocationMonitor implements LocationMonitorDef {
    static getLastKnownLocation<T = DefaultLatLonKeys>(): GenericGeoLocation<T> {
        let iosLocation: CLLocation;
        for (const locManagerId in locationManagers) {
            if (locationManagers.hasOwnProperty(locManagerId)) {
                const tempLocation = locationManagers[locManagerId].location;
                if (!iosLocation || tempLocation.timestamp > iosLocation.timestamp) {
                    iosLocation = tempLocation;
                }
            }
        }
        common.CLog(common.CLogTypes.info, `gps.LocationMonitor: getLastKnownLocation(${iosLocation})`);

        if (iosLocation) {
            return locationFromCLLocation(iosLocation);
        }

        const locListener = LocationListenerImpl.initWithLocationError(null);
        iosLocation = LocationMonitor.createiOSLocationManager(locListener, null).location;
        if (iosLocation) {
            return locationFromCLLocation(iosLocation);
        }
        return null;
    }

    static startLocationMonitoring<T = DefaultLatLonKeys>(options: Options, locListener: LocationListenerImpl<T>): void {
        const iosLocManager = LocationMonitor.createiOSLocationManager<T>(locListener, options);
        common.CLog(common.CLogTypes.info, `gps.LocationMonitor: startLocationMonitoring(${options})`);
        iosLocManager.startUpdatingLocation();
    }

    static stopLocationMonitoring(iosLocManagerId: number) {
        if (locationManagers[iosLocManagerId]) {
            locationManagers[iosLocManagerId].stopUpdatingLocation();
            locationManagers[iosLocManagerId].delegate = null;
            delete locationManagers[iosLocManagerId];
            delete locationListeners[iosLocManagerId];
        }
    }

    static createiOSLocationManager<T = DefaultLatLonKeys>(locListener: LocationListenerImpl<T>, options: Options): CLLocationManager {
        const iosLocManager = new CLLocationManager();
        iosLocManager.delegate = locListener;
        iosLocManager.desiredAccuracy = options ? options.desiredAccuracy : enums.Accuracy.high;
        iosLocManager.distanceFilter = options ? options.updateDistance : minRangeUpdate;
        locationManagers[locListener.id] = iosLocManager;
        locationListeners[locListener.id] = locListener;
        return iosLocManager;
    }
}
