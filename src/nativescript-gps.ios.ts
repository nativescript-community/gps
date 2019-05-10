import * as enums from 'tns-core-modules/ui/enums/enums';
import * as timer from 'tns-core-modules/timer';
import { GeoLocation } from './location';
import { deferredCallbackType, errorCallbackType, LocationMonitor as LocationMonitorDef, Options, successCallbackType } from './location-monitor';
import * as common from './nativescript-gps.common';
import * as perms from 'nativescript-perms';
import * as appModule from 'tns-core-modules/application';
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
        common.CLog(common.CLogTypes.info, `gps.LocationChangeListenerImpl: locationManagerDidChangeAuthorizationStatus(${status})`);
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
    }
}

export class LocationListenerImpl extends NSObject implements CLLocationManagerDelegate {
    public static ObjCProtocols = [CLLocationManagerDelegate];

    public authorizeAlways: boolean;
    public id: number;
    private _onLocation: successCallbackType;
    private _onError: errorCallbackType;
    private _onDeferred: deferredCallbackType;
    private _resolve: () => void;
    private _reject: (error: Error) => void;

    public static initWithLocationError(successCallback: successCallbackType, error?: errorCallbackType, options?: Options): LocationListenerImpl {
        const listener = LocationListenerImpl.new() as LocationListenerImpl;
        watchId++;
        listener.id = watchId;
        listener._onLocation = successCallback;
        listener._onError = error;
        listener._onDeferred = options.onDeferred;

        return listener;
    }

    public static initWithPromiseCallbacks(resolve: () => void, reject: (error: Error) => void, authorizeAlways: boolean = false): LocationListenerImpl {
        const listener = LocationListenerImpl.new() as LocationListenerImpl;
        watchId++;
        listener.id = watchId;
        listener._resolve = resolve;
        listener._reject = reject;
        listener.authorizeAlways = authorizeAlways;

        return listener;
    }

    public locationManagerDidUpdateLocations(manager: CLLocationManager, locations: NSArray<CLLocation>): void {
        common.CLog(common.CLogTypes.info, `gps.LocationListenerImpl: locationManagerDidUpdateLocations(${locations})`);
        if (this._onLocation) {
            for (let i = 0, count = locations.count; i < count; i++) {
                const location = locationFromCLLocation(locations.objectAtIndex(i));
                this._onLocation(location, manager);
            }
        }
    }
    public locationManagerDidFinishDeferredUpdatesWithError(manager: CLLocationManager, error: NSError): void {
        if (this._onDeferred) {
            common.CLog(common.CLogTypes.info, `gps.LocationListenerImpl: locationManagerDidFinishDeferredUpdatesWithError(${error})`);
            this._onDeferred(error ? new Error(error.localizedDescription) : null);
        }
    }

    public locationManagerDidFailWithError(manager: CLLocationManager, error: NSError): void {
        common.CLog(common.CLogTypes.info, `gps.LocationListenerImpl: locationManagerDidFailWithError(${error})`);
        if (this._onError) {
            this._onError(new Error(error.localizedDescription));
        }
    }

    public locationManagerDidChangeAuthorizationStatus(manager: CLLocationManager, status: CLAuthorizationStatus) {
        common.CLog(common.CLogTypes.info, `gps.LocationListenerImpl: locationManagerDidChangeAuthorizationStatus(${status})`);
        switch (status) {
            case CLAuthorizationStatus.kCLAuthorizationStatusNotDetermined:
                break;

            case CLAuthorizationStatus.kCLAuthorizationStatusRestricted:
                break;

            case CLAuthorizationStatus.kCLAuthorizationStatusDenied:
                if (this._reject) {
                    LocationMonitor.stopLocationMonitoring(this.id);
                    this._reject(new Error('Authorization Denied.'));
                }
                break;

            case CLAuthorizationStatus.kCLAuthorizationStatusAuthorizedAlways:
                if (this.authorizeAlways && this._resolve) {
                    LocationMonitor.stopLocationMonitoring(this.id);
                    this._resolve();
                } else if (this._reject) {
                    LocationMonitor.stopLocationMonitoring(this.id);
                    this._reject(new Error('Authorization Denied.'));
                }
                break;

            case CLAuthorizationStatus.kCLAuthorizationStatusAuthorizedWhenInUse:
                if (!this.authorizeAlways && this._resolve) {
                    LocationMonitor.stopLocationMonitoring(this.id);
                    this._resolve();
                } else if (this._reject) {
                    LocationMonitor.stopLocationMonitoring(this.id);
                    this._reject(new Error('Authorization Denied.'));
                }
                break;

            default:
                break;
        }
    }
}

function locationFromCLLocation(clLocation: CLLocation): GeoLocation {
    const location = new common.GeoLocation();
    location.latitude = clLocation.coordinate.latitude;
    location.longitude = clLocation.coordinate.longitude;
    location.altitude = clLocation.altitude;
    location.horizontalAccuracy = clLocation.horizontalAccuracy;
    location.verticalAccuracy = clLocation.verticalAccuracy;
    if (clLocation.speed >= 0) {
        location.speed = clLocation.speed;
    }
    if (clLocation.course >= 0) {
        location.bearing = clLocation.course;
    }
    const timeIntervalSince1970 = NSDate.dateWithTimeIntervalSinceDate(0, clLocation.timestamp).timeIntervalSince1970;
    location.timestamp = new Date(timeIntervalSince1970 * 1000);
    location.ios = clLocation;
    return location;
}

function clLocationFromLocation(location: GeoLocation): CLLocation {
    const hAccuracy = location.horizontalAccuracy ? location.horizontalAccuracy : -1;
    const vAccuracy = location.verticalAccuracy ? location.verticalAccuracy : -1;
    const speed = location.speed ? location.speed : -1;
    const course = location.bearing ? location.bearing : -1;
    const altitude = location.altitude ? location.altitude : -1;
    const timestamp = location.timestamp ? NSDate.dateWithTimeIntervalSince1970(location.timestamp.getTime() / 1000) : null;
    const iosLocation = CLLocation.alloc().initWithCoordinateAltitudeHorizontalAccuracyVerticalAccuracyCourseSpeedTimestamp(
        CLLocationCoordinate2DMake(location.latitude, location.longitude),
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
        common.CLog(common.CLogTypes.info, '*** iOS GPS Constructor ***');
        this.enabled = this.isEnabled();
        const manager = this.iosChangeLocManager = new CLLocationManager();
        common.CLog(common.CLogTypes.info, 'Constructor GPS created iosChangeLocManager', manager);
        const listener = this.iosChangeLocListener = LocationChangeListenerImpl.initWithOwner(new WeakRef(this));
        common.CLog(common.CLogTypes.info, 'Constructor GPS created delegate', listener);
        manager.delegate = listener;
    }
    prepareForRequest(options: Options) {
        return Promise.resolve()
            .then(() => {
                return this.isAuthorized().then(auth => {
                    if (!auth) {
                        if (options.skipPermissionCheck !== true) {
                            return perms.request('location');
                        } else {
                            return Promise.reject(new Error('Location service is not granted.'));
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
    // options - desiredAccuracy, updateDistance, minimumUpdateTime, maximumAge, timeout
    getCurrentLocation(options: Options): Promise<GeoLocation> {
        options = options || {};
        common.CLog(common.CLogTypes.debug, 'getCurrentLocation', options);
        if (options.timeout === 0) {
            // we should take any cached location e.g. lastKnownLocation
            return new Promise(function(resolve, reject) {
                const lastLocation = LocationMonitor.getLastKnownLocation();
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
            return new Promise<GeoLocation>(function(resolve, reject) {
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

                const successCallback = function(location: GeoLocation) {
                    stopTimerAndMonitor(locListener.id);
                    if (typeof options.maximumAge === 'number') {
                        if (location.timestamp.valueOf() + options.maximumAge > new Date().valueOf()) {
                            resolve(location);
                        } else {
                            reject(new Error('New location is older than requested maximum age!'));
                        }
                    } else {
                        resolve(location);
                    }
                };

                const locListener = LocationListenerImpl.initWithLocationError(successCallback, null, options);
                try {
                    LocationMonitor.startLocationMonitoring(options, locListener);
                } catch (e) {
                    stopTimerAndMonitor(locListener.id);
                    reject(e);
                }

                if (typeof options.timeout === 'number') {
                    timerId = timer.setTimeout(function() {
                        LocationMonitor.stopLocationMonitoring(locListener.id);
                        reject(new Error('Timeout while searching for location!'));
                    }, options.timeout || defaultGetLocationTimeout);
                }
            });
        });
    }

    watchLocation(successCallback: successCallbackType, errorCallback: errorCallbackType, options: Options) {
        return this.prepareForRequest(options).then(() => {
            options = options || {};
            const locListener = LocationListenerImpl.initWithLocationError(successCallback, errorCallback, options);
            try {
                const iosLocManager = LocationMonitor.createiOSLocationManager(locListener, options);
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
        if (!this.isEnabled()) {
            return new Promise(function(resolve, reject) {
                const settingsUrl = NSURL.URLWithString(UIApplicationOpenSettingsURLString);
                if (UIApplication.sharedApplication.canOpenURL(settingsUrl)) {
                    UIApplication.sharedApplication.openURLOptionsCompletionHandler(settingsUrl, null, function(success) {
                        // we get the callback for opening the URL, not enabling the GPS!
                        if (success) {
                            const onResume = () => {
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

    distance(loc1: GeoLocation, loc2: GeoLocation): number {
        if (!loc1.ios) {
            loc1.ios = clLocationFromLocation(loc1);
        }
        if (!loc2.ios) {
            loc2.ios = clLocationFromLocation(loc2);
        }
        return loc1.ios.distanceFromLocation(loc2.ios);
    }
}
export class LocationMonitor implements LocationMonitorDef {
    static getLastKnownLocation(): GeoLocation {
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

    static startLocationMonitoring(options: Options, locListener: LocationListenerImpl): void {
        const iosLocManager = LocationMonitor.createiOSLocationManager(locListener, options);
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

    static createiOSLocationManager(locListener: LocationListenerImpl, options: Options): CLLocationManager {
        const iosLocManager = new CLLocationManager();
        iosLocManager.delegate = locListener;
        iosLocManager.desiredAccuracy = options ? options.desiredAccuracy : enums.Accuracy.high;
        iosLocManager.distanceFilter = options ? options.updateDistance : minRangeUpdate;
        locationManagers[locListener.id] = iosLocManager;
        locationListeners[locListener.id] = locListener;
        return iosLocManager;
    }
}
