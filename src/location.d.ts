/**
 * A data class that encapsulates common properties for a geolocation.
 */


export type DefaultLatLonKeys = {
    latitude: number;
    longitude: number;
    altitude?: number;
};

type GenericGeoLocation<T = DefaultLatLonKeys> = {
    [P in keyof T]: number;
} & {
    /**
     * The latitude of the geolocation, in degrees.
     */

    /**
     * The horizontal accuracy, in meters.
     */
    horizontalAccuracy: number;

    /**
     * The vertical accuracy, in meters.
     */
    verticalAccuracy: number;

    /**
     * The speed, in meters/second over ground.
     */
    speed: number;

    /**
     * The bearing (course), in degrees.
     */
    bearing: number;

    /**
     * The time at which this location was determined in ms since epoch
     */
    timestamp: number;

    /**
     * the location time in elapsed ms since boot (lot more accurate)
     */
    elapsedBoot?: number;

    /**
     * the location age from the moment it was received
     */
    age?: number;

    /**
     * [android only]: the provider of the location
     */
    provider?: string;

    /**
     * The android-specific [location](http://developer.android.com/reference/android/location/Location.html) object.
     */
    android?: any; // android.location.Location;

    /**
     * The ios-specific [CLLocation](https://developer.apple.com/library/ios/documentation/CoreLocation/Reference/CLLocation_Class/) object.
     */
    ios?: any; // CLLocation;
};

type GeoLocation = GenericGeoLocation<DefaultLatLonKeys>;
