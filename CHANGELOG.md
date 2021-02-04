# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

## [2.1.7](https://github.com/nativescript-community/gps/compare/v2.1.6...v2.1.7) (2021-02-04)


### Bug Fixes

* **android:** prevent crash in getLastKnownLocation [#8](https://github.com/nativescript-community/gps/issues/8) ([1cea4ad](https://github.com/nativescript-community/gps/commit/1cea4adc5558d7e5020f13ce50aa2d2342c23612))





## [2.1.6](https://github.com/nativescript-community/gps/compare/v2.1.5...v2.1.6) (2021-01-13)


### Bug Fixes

* **android:** openSettings resolve with a boolean (isEnabled) ([db4d6d2](https://github.com/nativescript-community/gps/commit/db4d6d2bfdb5d135599b00021191d97e751243b5))





## [2.1.5](https://github.com/nativescript-community/gps/compare/v2.1.4...v2.1.5) (2020-11-26)


### Bug Fixes

* fix after trace mode change ([1b626ee](https://github.com/nativescript-community/gps/commit/1b626eefdf638af3403e3385924ad395bfd34695))





## [2.1.4](https://github.com/nativescript-community/gps/compare/v2.1.3...v2.1.4) (2020-11-23)

**Note:** Version bump only for package @nativescript-community/gps





## [2.1.3](https://github.com/nativescript-community/gps/compare/v2.1.2...v2.1.3) (2020-11-22)

**Note:** Version bump only for package @nativescript-community/gps





## [2.1.2](https://github.com/nativescript-community/gps/compare/v2.1.1...v2.1.2) (2020-11-17)


### Bug Fixes

* android fix for pre 24 devices with nmeaAltitude option ([492e28b](https://github.com/nativescript-community/gps/commit/492e28bf9a210188655095e1061c3ffaef9f363e))





## [2.1.1](https://github.com/nativescript-community/gps/compare/v2.1.0...v2.1.1) (2020-11-06)


### Bug Fixes

* android fix crash  < 24 for now ([0bb2e3d](https://github.com/nativescript-community/gps/commit/0bb2e3d7737363388893e3b32444a90a5460cf96))





# 2.1.0 (2020-09-06)


### Bug Fixes

* better handle of skip permissions ([04b2981](https://github.com/nativescript-community/gps/commit/04b29811a3756cc22cb0aaca60b8f89ab86a8476))
* bring back debug mode ([a64fc6b](https://github.com/nativescript-community/gps/commit/a64fc6b83e12eecb5757f55cd894bf81a9024144))
* context fix ([2390abd](https://github.com/nativescript-community/gps/commit/2390abd1d25f7c9408100901d342817110b5fa5e))
* correctly support always feature ([e9a34b5](https://github.com/nativescript-community/gps/commit/e9a34b5aded554e9a2628b13df3f2c3ea6dfd1a8))
* disable boottime for now as it is wrong ([0e9cbaa](https://github.com/nativescript-community/gps/commit/0e9cbaa61d4a1ec44b595c2012e5a937dca53901))
* dont check enabled to open settions ([4e1b4bc](https://github.com/nativescript-community/gps/commit/4e1b4bc69784b1a46f132be8b6f3dcab38b26dab))
* dont modify the original object to compute distance ([9284fbb](https://github.com/nativescript-community/gps/commit/9284fbbf846e766c6d9922908a2090ae117c273c))
* dont use getTime() ([a472ce9](https://github.com/nativescript-community/gps/commit/a472ce9768b6f59d989763d21757c90d6a7ff1a5))
* esm using import for tree shaking ([bd6f052](https://github.com/nativescript-community/gps/commit/bd6f0528a0dc251a7d2a57e5fd0d75135f3302f0))
* full esm support ([f6f8ab2](https://github.com/nativescript-community/gps/commit/f6f8ab2c8ec93ca65aaaaa2e7bc6f5d92f72641e))
* getCurrentLocation with maximumAge: wait for a valid location ([a3bafce](https://github.com/nativescript-community/gps/commit/a3bafcea4688c50c2aafd9af837759c5b2023672))
* sideEffects for tree shacking ([daaef8c](https://github.com/nativescript-community/gps/commit/daaef8c8eb8550df1e6a2c1ad9850dbc95e13ad0))
* **ios:** wrongly return permission not granted ([52eda8b](https://github.com/nativescript-community/gps/commit/52eda8b073fb2adb35680a00d571f0ccf7735d74))
* missing files for ios ([b3085f6](https://github.com/nativescript-community/gps/commit/b3085f647a05650e6151a36fb596189ca80cb4d6))
* renamed option ([29e6fc7](https://github.com/nativescript-community/gps/commit/29e6fc7b06340d260a9d8770f39e642d70d38fe4))
* renamed option ([5cb0f64](https://github.com/nativescript-community/gps/commit/5cb0f64a998ff7d8805c475855395c03674ffd0b))
* store location age in case it is needed to debug ([60ea89e](https://github.com/nativescript-community/gps/commit/60ea89e55ffd3c87568528c3ce6ffb7b3d12d5aa))
* timestamp is now a number (epoch) ([42c3f0b](https://github.com/nativescript-community/gps/commit/42c3f0b76f5cfc880a02563366a30988b2986f57))
* typo ([b6056ca](https://github.com/nativescript-community/gps/commit/b6056caadf2e676295c7fe55307c83e1e0be9795))
* use interface instead of class ([be18201](https://github.com/nativescript-community/gps/commit/be182016cfd126fef4771b34192caed011c606a6))


### Features

* elapsedBoot support ([13dd7c6](https://github.com/nativescript-community/gps/commit/13dd7c6e83eb112c7dacffdce3fdd94603922fd5))
* N7 and new plugin name ([8f10fba](https://github.com/nativescript-community/gps/commit/8f10fba053643485251855a41cb22deff461f3eb))
* nmea support ([e7362f7](https://github.com/nativescript-community/gps/commit/e7362f7f145a3f1eceb5c417d128345971bbaefa))
