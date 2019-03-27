import * as appModule from 'tns-core-modules/application/application';
import * as platform from 'tns-core-modules/platform/platform';
import * as enums from 'tns-core-modules/ui/enums/enums';
import * as timer from 'tns-core-modules/timer/timer';
import * as trace from 'tns-core-modules/trace/trace';
import * as common from './nativescript-gps.common';
import { errorCallbackType, LocationMonitor as LocationMonitorDef, Options, successCallbackType } from './location-monitor';
global.moduleMerge(common, exports);

const locationListeners = {};
let watchId = 0;
let androidLocationManager: android.location.LocationManager;
const minTimeUpdate = 1 * 60 * 1000; // 1 minute
const minRangeUpdate = 0; // 0 meters

function getAndroidLocationManager(): android.location.LocationManager {
    if (!androidLocationManager) {
        androidLocationManager = (appModule.android.context as android.content.Context).getSystemService(android.content.Context.LOCATION_SERVICE) as android.location.LocationManager;
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

function watchLocationCore(successCallback: successCallbackType, errorCallback: errorCallbackType, options: Options, locListener: android.location.LocationListener): void {
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
        errorCallback(e);
    }
}

function openGPSSettingsCore(successCallback?, successArgs?, errorCallback?: errorCallbackType, errorArgs?): void {
    const currentContext = appModule.android.currentContext as android.app.Activity;
    if (!isEnabled()) {
        const onActivityResultHandler = function(data: appModule.AndroidActivityResultEventData) {
            appModule.android.off(appModule.AndroidApplication.activityResultEvent, onActivityResultHandler);
            if (data.requestCode === 0) {
                if (isEnabled()) {
                    if (successCallback) {
                        successCallback.apply(this, successArgs);
                    }
                } else {
                    if (errorCallback) {
                        errorCallback.apply(this, errorArgs || [new Error('Location service is not enabled.')]);
                    }
                }
            }
        };
        appModule.android.on(appModule.AndroidApplication.activityResultEvent, onActivityResultHandler);
        currentContext.startActivityForResult(new android.content.Intent(android.provider.Settings.ACTION_LOCATION_SOURCE_SETTINGS), 0);
    } else {
        if (successCallback) {
            successCallback.apply(this, successArgs);
        }
    }
}

function authorizeLocationRequestCore(successCallback?, successArgs?, errorCallback?: errorCallbackType, errorArgs?): void {
    const currentContext = appModule.android.currentContext as android.app.Activity;
    if (currentContext && parseInt(platform.device.sdkVersion, 10) >= 23) {
        const res = android.support.v4.content.ContextCompat.checkSelfPermission(currentContext, (android as any).Manifest.permission.ACCESS_FINE_LOCATION);
        if (res === -1) {
            const cb = (data: appModule.AndroidActivityRequestPermissionsEventData) => {
                appModule.android.off(appModule.AndroidApplication.activityRequestPermissionsEvent, cb);
                if (data.requestCode === 5000) {
                    if (data.grantResults.length > 0 && data.grantResults[0] === android.content.pm.PackageManager.PERMISSION_GRANTED) {
                        common.CLog(common.CLogTypes.debug, 'permission granted!!!');
                        successCallback.apply(this, successArgs);
                    } else {
                        common.CLog(common.CLogTypes.debug, 'permission not granted!!!');
                        if (errorCallback) {
                            errorCallback.apply(this, errorArgs);
                        }
                    }
                }
            };
            appModule.android.on(appModule.AndroidApplication.activityRequestPermissionsEvent, cb);
            (android['support'].v4.app as any).ActivityCompat.requestPermissions(currentContext, ['android.permission.ACCESS_FINE_LOCATION'], 5000);
        } else {
            successCallback.apply(this, successArgs);
        }
    } else {
        successCallback.apply(this, successArgs);
    }
}
function enableLocationRequestCore(successCallback?, successArgs?, errorCallback?: errorCallbackType, errorArgs?): void {
    const currentContext = appModule.android.currentContext as android.app.Activity;
    if (currentContext && parseInt(platform.device.sdkVersion, 10) >= 23) {
        appModule.android.on(appModule.AndroidApplication.activityRequestPermissionsEvent, (data: appModule.AndroidActivityRequestPermissionsEventData) => {
            common.CLog(common.CLogTypes.debug, 'requestCode: ' + data.requestCode + ' permissions: ' + data.permissions + ' grantResults: ' + data.grantResults);
            if (data.requestCode === 5000) {
                if (data.grantResults.length > 0 && data.grantResults[0] === android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    openGPSSettingsCore(successCallback, successArgs, errorCallback, errorArgs);
                } else {
                    if (errorCallback) {
                        errorCallback.apply(this, errorArgs || [new Error('Location service is not granted.')]);
                    }
                }
            }
        });
        const res = android.support.v4.content.ContextCompat.checkSelfPermission(currentContext, (android as any).Manifest.permission.ACCESS_FINE_LOCATION);
        if (res === -1) {
            android.support.v4.app.ActivityCompat.requestPermissions(currentContext, ['android.permission.ACCESS_FINE_LOCATION'], 5000);
        } else {
            openGPSSettingsCore(successCallback, successArgs, errorCallback, errorArgs);
        }
    } else {
        openGPSSettingsCore(successCallback, successArgs, errorCallback, errorArgs);
    }
}

export function watchLocation(successCallback: successCallbackType, errorCallback: errorCallbackType, options: Options): number {
    const locListener = createLocationListener(successCallback);
    if (!isLocationServiceAuthorized()) {
        const notGrantedError = new Error('Location service is not granted.');
        if (options.skipPermissionCheck !== true) {
            authorizeLocationRequestCore(watchLocationCore, [successCallback, errorCallback, options, locListener], errorCallback, [notGrantedError]);
        } else {
            if (errorCallback) {
                errorCallback.apply(this, [notGrantedError]);
            }
        }
    } else if (!isLocationServiceEnabled()) {
        const notGrantedError = new Error('Location service is not enabled');
        if (options.skipPermissionCheck !== true) {
            openGPSSettingsCore(watchLocationCore, [successCallback, errorCallback, options, locListener], errorCallback, [notGrantedError]);
        } else {
            if (errorCallback) {
                errorCallback.apply(this, [notGrantedError]);
            }
        }
    } else {
        watchLocationCore(successCallback, errorCallback, options, locListener);
    }
    return (locListener as any).id;
}

export function hasGPS() {
    const currentContext = appModule.android.currentContext as android.app.Activity;
    if (!currentContext) {
        return false;
    }
    return currentContext.getPackageManager().hasSystemFeature(android.content.pm.PackageManager.FEATURE_LOCATION_GPS);
}

export function getCurrentLocation(options: Options): Promise<common.GeoLocation> {
    options = options || {};

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

    return new Promise(function(resolve, reject) {
        let timerId;
        const stopTimerAndMonitor = function(locListenerId: number) {
            if (timerId !== undefined) {
                timer.clearTimeout(timerId);
            }
            LocationMonitor.stopLocationMonitoring(locListenerId);
        };

        const enabledCallback = function(resolve, reject, options) {
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
        };
        const permissionDeniedCallback = function(reject) {
            reject(new Error('Location service is not enabled or using it is not granted.'));
        };

        if (!isEnabled()) {
            if (options.skipPermissionCheck !== true) {
                enableLocationRequestCore(enabledCallback, [resolve, reject, options], permissionDeniedCallback, [reject]);
            } else {
                permissionDeniedCallback(reject);
            }
        } else {
            enabledCallback(resolve, reject, options);
        }
    });
}

export function clearWatch(watchId: number): void {
    LocationMonitor.stopLocationMonitoring(watchId);
}

export function enable(): Promise<void> {
    common.CLog(common.CLogTypes.debug, 'enable');
    return openGPSSettings();
}
export function authorize(always?: boolean): Promise<void> {
    common.CLog(common.CLogTypes.debug, 'authorize', always);
    return authorizeLocationServiceRequest(always);
}

export function openGPSSettings(): Promise<void> {
    common.CLog(common.CLogTypes.debug, 'enableLocationServiceRequest');
    return new Promise<void>(function(resolve, reject) {
        if (isLocationServiceEnabled()) {
            resolve();
            return;
        }

        const enabledCallback = function(resolve, reject) {
            resolve();
        };
        const permissionDeniedCallback = function(err) {
            reject(err);
        };

        openGPSSettingsCore(enabledCallback, [resolve], permissionDeniedCallback);
    });
}
export function authorizeLocationServiceRequest(always?: boolean): Promise<void> {
    common.CLog(common.CLogTypes.debug, 'authorizeLocationServiceRequest', always);
    return new Promise<void>(function(resolve, reject) {
        if (isLocationServiceAuthorized()) {
            resolve();
            return;
        }

        const enabledCallback = function(resolve, reject) {
            resolve();
        };
        const permissionDeniedCallback = function(err) {
            reject(err);
        };

        authorizeLocationRequestCore(enabledCallback, [resolve], permissionDeniedCallback);
    });
}

export function isEnabled(): boolean {
    return isLocationServiceEnabled();
}
export function isAuthorized(): boolean {
    return isLocationServiceAuthorized();
}

export function isGPSEnabled(): boolean {
    const result = getAndroidLocationManager().isProviderEnabled(android.location.LocationManager.GPS_PROVIDER);
    common.CLog(common.CLogTypes.debug, 'isGPSEnabled', result);
    return result;
}
export function isLocationServiceEnabled(): boolean {
    // let criteria = new android.location.Criteria();
    // criteria.setAccuracy(android.location.Criteria.ACCURACY_COARSE);
    // due to bug in android API getProviders() with criteria parameter overload should be called (so most loose accuracy is used).
    const enabledProviders = getAndroidLocationManager().getProviders(true);
    const nbProviders = enabledProviders.size();
    // let result = true;
    // if (nbProviders === 0) {
    //     result = false;
    //     // result = common.isMockEnabled();
    // } else if (nbProviders === 1 && enabledProviders.get(0).toString() === 'local_database') {
    //     result = false;
    // }
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
export function isLocationServiceAuthorized(): boolean {
    const currentContext = appModule.android.currentContext as android.app.Activity;
    if (!currentContext) {
        return false;
    }
    return android.support.v4.content.ContextCompat.checkSelfPermission(currentContext, android.Manifest.permission.ACCESS_FINE_LOCATION) !== -1;
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
