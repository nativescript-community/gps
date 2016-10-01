/**
 * iOS and Android apis should match.
 * It doesn't matter if you export `.ios` or `.android`, either one but only one.
 */
export * from "./nativescript-background-gps.ios";

// Export any shared classes, constants, etc.
export * from "./nativescript-background-gps.common";

export * from "./location";
export * from "./location-monitor";
