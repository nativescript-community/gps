# Nativescript Background GPS Plugin

## NOTE
This plugin does not currently work in the background.  The project is exploratory to create a simple background GPS service, but thus far it is not working.


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