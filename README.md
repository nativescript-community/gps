# Nativescript GPS Plugin

## NOTE

This is a plugin to receive gps location updates regardless of the app state.
It differentiates itself from `nativescript-geolocation``` by NOT using google play services

## Getting started

1. `tns plugin add @nativescript-community/gps`

You are responsible for updating correction your `AndroidManifest.xml` and `Info.plist`

## Usage

`import * as gps from '@nativescript-community/gps';`
