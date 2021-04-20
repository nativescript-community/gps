# Nativescript GPS Plugin

## NOTE

This is a plugin to receive gps location updates regardless of the app state.
It differentiates itself from `nativescript-geolocation``` by NOT using google play services

## Getting started

If using N < 8.0:
`tns plugin add @nativescript-community/gps@2.1.8`

Else 
`tns plugin add @nativescript-community/gps`

You are responsible for updating permissions your `AndroidManifest.xml` and `Info.plist`

## Usage

Here is a simple example. You can find more in the doc [here](https://nativescript-community.github.io/gps)

```typescript
import { GPS } from '@nativescript-community/gps';

const gps = new GPS();
const location = await gps.getCurrentLocation<LatLonKeys>({
    minimumUpdateTime,
    desiredAccuracy,
    timeout,
    skipPermissionCheck: true
});
```

