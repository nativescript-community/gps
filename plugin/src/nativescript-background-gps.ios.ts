import * as enums from 'tns-core-modules/ui/enums/enums';
import * as timer from 'tns-core-modules/timer/timer';
import { GeoLocation } from './location';
import { LocationMonitor as LocationMonitorDef, Options, successCallbackType, errorCallbackType, deferredCallbackType } from './location-monitor';
import * as common from './nativescript-background-gps.common';
global.moduleMerge(common, exports);

export { Options, successCallbackType, errorCallbackType, deferredCallbackType };

var locationManagers = {};
var locationListeners = {};
var watchId = 0;
var minRangeUpdate = 0; // 0 meters
var defaultGetLocationTimeout = 5 * 60 * 1000; // 5 minutes

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
        let listener = <LocationListenerImpl>LocationListenerImpl.new();
        watchId++;
        listener.id = watchId;
        listener._onLocation = successCallback;
        listener._onError = error;
        listener._onDeferred = options.onDeferred;

        return listener;
    }

    public static initWithPromiseCallbacks(resolve: () => void, reject: (error: Error) => void, authorizeAlways: boolean = false): LocationListenerImpl {
        let listener = <LocationListenerImpl>LocationListenerImpl.new();
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
                let location = locationFromCLLocation(<CLLocation>locations.objectAtIndex(i));
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
    let location = new common.GeoLocation();
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
    let timeIntervalSince1970 = NSDate.dateWithTimeIntervalSinceDate(0, clLocation.timestamp).timeIntervalSince1970;
    location.timestamp = new Date(timeIntervalSince1970 * 1000);
    location.ios = clLocation;
    return location;
}

function clLocationFromLocation(location: GeoLocation): CLLocation {
    let hAccuracy = location.horizontalAccuracy ? location.horizontalAccuracy : -1;
    let vAccuracy = location.verticalAccuracy ? location.verticalAccuracy : -1;
    let speed = location.speed ? location.speed : -1;
    let course = location.bearing ? location.bearing : -1;
    let altitude = location.altitude ? location.altitude : -1;
    let timestamp = location.timestamp ? NSDate.dateWithTimeIntervalSince1970(location.timestamp.getTime() / 1000) : null;
    let iosLocation = CLLocation.alloc().initWithCoordinateAltitudeHorizontalAccuracyVerticalAccuracyCourseSpeedTimestamp(
        CLLocationCoordinate2DMake(location.latitude, location.longitude),
        altitude,
        hAccuracy,
        vAccuracy,
        course,
        speed,
        <any>timestamp
    );
    return iosLocation;
}

// options - desiredAccuracy, updateDistance, minimumUpdateTime, maximumAge, timeout
export function getCurrentLocation(options: Options): Promise<GeoLocation> {
    options = options || {};
    if (options.timeout === 0) {
        // we should take any cached location e.g. lastKnownLocation
        return new Promise(function(resolve, reject) {
            let lastLocation = LocationMonitor.getLastKnownLocation();
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

    return new Promise(function(resolve, reject) {
        if (!isEnabled()) {
            reject(new Error('Location service is disabled'));
        }

        let stopTimerAndMonitor = function(locListenerId) {
            if (timerId !== undefined) {
                timer.clearTimeout(timerId);
            }

            LocationMonitor.stopLocationMonitoring(locListenerId);
        };

        let successCallback = function(location: GeoLocation) {
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

        var locListener = LocationListenerImpl.initWithLocationError(successCallback, null, options);
        try {
            LocationMonitor.startLocationMonitoring(options, locListener);
        } catch (e) {
            stopTimerAndMonitor(locListener.id);
            reject(e);
        }

        if (typeof options.timeout === 'number') {
            var timerId = timer.setTimeout(function() {
                LocationMonitor.stopLocationMonitoring(locListener.id);
                reject(new Error('Timeout while searching for location!'));
            }, options.timeout || defaultGetLocationTimeout);
        }
    });
}

export function watchLocation(successCallback: successCallbackType, errorCallback: errorCallbackType, options: Options): number {
    options = options || {};
    let locListener = LocationListenerImpl.initWithLocationError(successCallback, errorCallback, options);
    try {
        let iosLocManager = LocationMonitor.createiOSLocationManager(locListener, options);
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
}

export function clearWatch(watchId: number): void {
    LocationMonitor.stopLocationMonitoring(watchId);
}

export function enableLocationServiceRequest(): Promise<void> {
    if (!isEnabled()) {
        return new Promise(function(resolve, reject) {
            let settingsUrl = NSURL.URLWithString(UIApplicationOpenSettingsURLString);
            if (UIApplication.sharedApplication.canOpenURL(settingsUrl)) {
                UIApplication.sharedApplication.openURLOptionsCompletionHandler(settingsUrl, null, function(success) {
                    if (success) {
                        if (isEnabled()) {
                            return Promise.resolve();
                        } else {
                            return Promise.reject('location disabled');
                        }
                    } else {
                        return Promise.reject("can't open settings");
                    }
                });
            }
        });
    }
    return Promise.resolve();
}
export function enableLocationRequest(always?: boolean): Promise<void> {
    return authorizeLocationRequest(always);
}
export function authorizeLocationRequest(always?: boolean): Promise<void> {
    return new Promise<void>(function(resolve, reject) {
        if (isLocationServiceAuthorized()) {
            resolve();
            return;
        }

        always = true;
        let listener = LocationListenerImpl.initWithPromiseCallbacks(resolve, reject, always);
        try {
            let manager = LocationMonitor.createiOSLocationManager(listener, null);
            if (always) {
                manager.requestAlwaysAuthorization();
            } else {
                manager.requestWhenInUseAuthorization();
            }
        } catch (e) {
            LocationMonitor.stopLocationMonitoring(listener.id);
            reject(e);
        }
    });
}

export function isLocationServiceEnabled(): boolean {
    return CLLocationManager.locationServicesEnabled();
}
export function isLocationServiceAuthorized(): boolean {
    return (
        CLLocationManager.authorizationStatus() === CLAuthorizationStatus.kCLAuthorizationStatusAuthorizedWhenInUse ||
        CLLocationManager.authorizationStatus() === CLAuthorizationStatus.kCLAuthorizationStatusAuthorizedAlways ||
        CLLocationManager.authorizationStatus() === CLAuthorizationStatus.kCLAuthorizationStatusAuthorized
    );
}

export function isEnabled(): boolean {
    return isLocationServiceEnabled() && isLocationServiceAuthorized();
}

export function distance(loc1: GeoLocation, loc2: GeoLocation): number {
    if (!loc1.ios) {
        loc1.ios = clLocationFromLocation(loc1);
    }
    if (!loc2.ios) {
        loc2.ios = clLocationFromLocation(loc2);
    }
    return loc1.ios.distanceFromLocation(loc2.ios);
}

export class LocationMonitor implements LocationMonitorDef {
    static getLastKnownLocation(): GeoLocation {
        let iosLocation: CLLocation;
        for (let locManagerId in locationManagers) {
            if (locationManagers.hasOwnProperty(locManagerId)) {
                let tempLocation = locationManagers[locManagerId].location;
                if (!iosLocation || tempLocation.timestamp > iosLocation.timestamp) {
                    iosLocation = tempLocation;
                }
            }
        }
        common.CLog(common.CLogTypes.info, `gps.LocationMonitor: getLastKnownLocation(${iosLocation})`);

        if (iosLocation) {
            return locationFromCLLocation(iosLocation);
        }

        let locListener = LocationListenerImpl.initWithLocationError(null);
        iosLocation = LocationMonitor.createiOSLocationManager(locListener, null).location;
        if (iosLocation) {
            return locationFromCLLocation(iosLocation);
        }
        return null;
    }

    static startLocationMonitoring(options: Options, locListener: LocationListenerImpl): void {
        let iosLocManager = LocationMonitor.createiOSLocationManager(locListener, options);
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
        let iosLocManager = new CLLocationManager();
        iosLocManager.delegate = locListener;
        iosLocManager.desiredAccuracy = options ? options.desiredAccuracy : enums.Accuracy.high;
        iosLocManager.distanceFilter = options ? options.updateDistance : minRangeUpdate;
        locationManagers[locListener.id] = iosLocManager;
        locationListeners[locListener.id] = locListener;
        return iosLocManager;
    }
}
