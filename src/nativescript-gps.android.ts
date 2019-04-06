import * as application from 'tns-core-modules/application/application';
// import * as platform from 'tns-core-modules/platform/platform';
import * as enums from 'tns-core-modules/ui/enums/enums';
import * as timer from 'tns-core-modules/timer/timer';
import * as trace from 'tns-core-modules/trace/trace';
import * as common from './nativescript-gps.common';
import { errorCallbackType, LocationMonitor as LocationMonitorDef, Options, successCallbackType } from './location-monitor';
import * as perms from 'nativescript-perms';
global.moduleMerge(common, exports);

const locationListeners = {};
let watchId = 0;
let androidLocationManager: android.location.LocationManager;
const minTimeUpdate = 1 * 60 * 1000; // 1 minute
const minRangeUpdate = 0; // 0 meters

function getAndroidLocationManager(): android.location.LocationManager {
    if (!androidLocationManager) {
        androidLocationManager = (application.android.context as android.content.Context).getSystemService(android.content.Context.LOCATION_SERVICE) as android.location.LocationManager;
    }
    return androidLocationManager;
}

function createLocationListener(successCallback: successCallbackType) {
    const locationListener = new android.location.LocationListener({
        onLocationChanged(location: android.location.Location) {
            common.CLog(common.CLogTypes.debug, 'onLocationChanged', location);

            const locationCallback: successCallbackType = this._onLocation;
            if (locationCallback) {
                locationCallback(locationFromAndroidLocation(location));
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
        }
    });
    watchId++;
    (locationListener as any)._onLocation = successCallback;
    (locationListener as any).id = watchId;
    locationListeners[watchId] = locationListener;
    return locationListener;
}

function locationFromAndroidLocation(androidLocation: android.location.Location): common.GeoLocation {
    const location = new common.GeoLocation();
    location.latitude = androidLocation.getLatitude();
    location.longitude = androidLocation.getLongitude();
    if (androidLocation.hasAltitude()) {
        location.altitude = androidLocation.getAltitude();
    }
    location.horizontalAccuracy = androidLocation.getAccuracy();
    location.verticalAccuracy = androidLocation.getAccuracy();
    if (androidLocation.hasSpeed()) {
        location.speed = androidLocation.getSpeed();
    }
    if (androidLocation.hasBearing()) {
        location.bearing = androidLocation.getBearing();
    }
    // if (androidLocation.hasBearingAccuracy()) {
    //     location.bearing = androidLocation.getBearing();
    // }
    location.timestamp = new Date(androidLocation.getTime());
    location.android = androidLocation;
    return location;
}

function androidLocationFromLocation(location: common.GeoLocation): android.location.Location {
    const androidLocation = new android.location.Location('custom');
    androidLocation.setLatitude(location.latitude);
    androidLocation.setLongitude(location.longitude);
    if (location.altitude !== undefined) {
        androidLocation.setAltitude(location.altitude);
    }
    if (location.speed >= 0) {
        androidLocation.setSpeed(float(location.speed));
    }
    if (location.bearing >= 0) {
        androidLocation.setBearing(float(location.bearing));
    }
    if (location.timestamp) {
        try {
            androidLocation.setTime(long(location.timestamp.getTime()));
        } catch (e) {
            console.error('invalid location timestamp');
        }
    }
    return androidLocation;
}

function criteriaFromOptions(options: Options): android.location.Criteria {
    const criteria = new android.location.Criteria();
    if (options && options.desiredAccuracy <= enums.Accuracy.high) {
        criteria.setAccuracy(android.location.Criteria.ACCURACY_FINE);
    } else {
        criteria.setAccuracy(android.location.Criteria.ACCURACY_COARSE);
    }
    return criteria;
}

function watchLocationCore(options: Options, locListener: android.location.LocationListener): void {
    const criteria = criteriaFromOptions(options);
    common.CLog(common.CLogTypes.debug, 'watchLocationCore', criteria, options, locListener);
    try {
        const updateTime = options && typeof options.minimumUpdateTime === 'number' ? options.minimumUpdateTime : minTimeUpdate;
        const updateDistance = options && typeof options.updateDistance === 'number' ? options.updateDistance : minRangeUpdate;
        if (options.provider) {
            getAndroidLocationManager().requestLocationUpdates(options.provider, updateTime, updateDistance, locListener, null);
        } else {
            getAndroidLocationManager().requestLocationUpdates(updateTime, updateDistance, criteria, locListener, null);
        }
    } catch (e) {
        common.CLog(common.CLogTypes.debug, 'watchLocationCore error', e);
        LocationMonitor.stopLocationMonitoring((locListener as any).id);
        throw e;
    }
}

function openGPSSettings() {
    common.CLog(common.CLogTypes.debug, 'openGPSSettings', isEnabled());
    const activity = application.android.foregroundActivity || application.android.startActivity;
    return new Promise((resolve, reject) => {
        if (!isEnabled()) {
            const onActivityResultHandler = function(data: application.AndroidActivityResultEventData) {
                if (data.requestCode === 5340) {
                    application.android.off(application.AndroidApplication.activityResultEvent, onActivityResultHandler);
                    common.CLog(common.CLogTypes.debug, 'openGPSSettingsCore done', data.requestCode, isEnabled());

                    if (isEnabled()) {
                        resolve();
                    } else {
                        reject('location_service_not_enabled');

                    }
                }
            };
            application.android.on(application.AndroidApplication.activityResultEvent, onActivityResultHandler);
            activity.startActivityForResult(new android.content.Intent(android.provider.Settings.ACTION_LOCATION_SOURCE_SETTINGS), 5340);
        } else {
            resolve();
        }
    });

}

function prepareForRequest(options: Options) {
    common.CLog(common.CLogTypes.debug, 'prepareForRequest', options, isEnabled());
    return Promise.resolve()
        .then(() => {
            return isAuthorized().then(auth => {
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
            if (!isEnabled()) {
                if (options.dontOpenSettings !== true) {
                    return openGPSSettings();
                } else {
                    return Promise.reject('location_service_not_enabled');
                }
            }
            return undefined;
        });
}

export function watchLocation(successCallback: successCallbackType, errorCallback: errorCallbackType, options: Options) {
    common.CLog(common.CLogTypes.debug, 'watchLocation', options);
    return prepareForRequest(options).then(() => {
        const locListener = createLocationListener(successCallback);
        watchLocationCore(options, locListener);
        return (locListener as any).id;
    });
}

export function hasGPS() {
    const currentContext = application.android.context as android.content.Context;
    if (!currentContext) {
        return false;
    }
    return currentContext.getPackageManager().hasSystemFeature(android.content.pm.PackageManager.FEATURE_LOCATION_GPS);
}

export function getCurrentLocation(options: Options): Promise<common.GeoLocation> {
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

    return prepareForRequest(options).then(() => {
        return new Promise<common.GeoLocation>(function(resolve, reject) {
            let timerId;
            const stopTimerAndMonitor = function(locListenerId: number) {
                if (timerId !== undefined) {
                    timer.clearTimeout(timerId);
                }
                LocationMonitor.stopLocationMonitoring(locListenerId);
            };
            const successCallback = function(location: common.GeoLocation) {
                stopTimerAndMonitor((locListener as any).id);
                if (options && typeof options.maximumAge === 'number') {
                    if (location.timestamp.valueOf() + options.maximumAge > new Date().valueOf()) {
                        resolve(location);
                    } else {
                        reject(new Error('New location is older than requested maximum age!'));
                    }
                } else {
                    resolve(location);
                }
            };

            const locListener = LocationMonitor.createListenerWithCallbackAndOptions(successCallback, options);
            try {
                LocationMonitor.startLocationMonitoring(options, locListener);
            } catch (e) {
                stopTimerAndMonitor((locListener as any).id);
                reject(e);
            }

            if (options && typeof options.timeout === 'number') {
                timerId = timer.setTimeout(function() {
                    LocationMonitor.stopLocationMonitoring((locListener as any).id);
                    reject(new Error('Timeout while searching for location!'));
                }, options.timeout || common.defaultGetLocationTimeout);
            }
        });
    });
}

export function clearWatch(watchId: number): void {
    LocationMonitor.stopLocationMonitoring(watchId);
}

export function enable() {
    common.CLog(common.CLogTypes.debug, 'enable');
    return openGPSSettings();
}
export function authorize(always?: boolean) {
    common.CLog(common.CLogTypes.debug, 'authorize', always);
    return perms.request('location').then(s => s === 'authorized');
}

export function isAuthorized() {
    return perms.check('location').then(s => s === 'authorized');
}

export function isGPSEnabled(): boolean {
    const result = getAndroidLocationManager().isProviderEnabled(android.location.LocationManager.GPS_PROVIDER);
    common.CLog(common.CLogTypes.debug, 'isGPSEnabled', result);
    return result;
}
export function isEnabled(): boolean {
    // due to bug in android API getProviders() with criteria parameter overload should be called (so most loose accuracy is used).
    const enabledProviders = getAndroidLocationManager().getProviders(true);
    const nbProviders = enabledProviders.size();

    let acceptableProviders = 0;
    for (let index = 0; index < enabledProviders.size(); index++) {
        const provider = enabledProviders.get(index);
        common.CLog(common.CLogTypes.debug, 'provider:', enabledProviders.get(index));
        if (provider !== 'local_database' && provider !== 'passive') {
            acceptableProviders++;
        }
    }
    common.CLog(common.CLogTypes.debug, 'isLocationServiceEnabled', enabledProviders.size(), nbProviders, acceptableProviders);
    return acceptableProviders > 0;
}

export function distance(loc1: common.GeoLocation, loc2: common.GeoLocation): number {
    if (!loc1.android) {
        loc1.android = androidLocationFromLocation(loc1);
    }
    if (!loc2.android) {
        loc2.android = androidLocationFromLocation(loc2);
    }
    return loc1.android.distanceTo(loc2.android);
}

export class LocationMonitor implements LocationMonitorDef {
    static getLastKnownLocation(): common.GeoLocation {
        const criteria = new android.location.Criteria();
        criteria.setAccuracy(android.location.Criteria.ACCURACY_COARSE);
        try {
            const iterator = getAndroidLocationManager()
                .getProviders(criteria, false)
                .iterator();
            let androidLocation;
            while (iterator.hasNext()) {
                const provider = iterator.next() as string;
                const tempLocation = getAndroidLocationManager().getLastKnownLocation(provider);
                if (!androidLocation || tempLocation.getTime() > androidLocation.getTime()) {
                    androidLocation = tempLocation;
                }
            }
            if (androidLocation) {
                return locationFromAndroidLocation(androidLocation);
            }
        } catch (e) {
            trace.write('Error: ' + e.message, 'Error');
        }
        return null;
    }

    static startLocationMonitoring(options: Options, listener): void {
        const updateTime = options && typeof options.minimumUpdateTime === 'number' ? options.minimumUpdateTime : minTimeUpdate;
        const updateDistance = options && typeof options.updateDistance === 'number' ? options.updateDistance : minRangeUpdate;
        getAndroidLocationManager().requestLocationUpdates(updateTime, updateDistance, criteriaFromOptions(options), listener, null);
    }

    static createListenerWithCallbackAndOptions(successCallback: successCallbackType, options: Options) {
        return createLocationListener(successCallback);
    }

    static stopLocationMonitoring(locListenerId: number): void {
        const listener = locationListeners[locListenerId];
        if (listener) {
            getAndroidLocationManager().removeUpdates(listener);
            delete locationListeners[locListenerId];
        }
    }
}
