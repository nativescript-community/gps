# Nativescript Background GPS Plugin

This is a plugin to receive gps location updates regardless of the app state.

## Getting started

1. `tns plugin add nativescript-background-gps`

## Usage

`import { gps } from 'nativescript-background-gps';`

`gps.on(function (location) {
    console.log(location);
}`

## Changes

This project uses source code from [nativescript-geolocation](https://github.com/NativeScript/nativescript-geolocation) under the Apache 2.0 license.
Changes can be found in the `CHANGES.md` file.