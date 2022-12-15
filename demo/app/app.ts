import { Trace } from '@nativescript/core';
import * as application from '@nativescript/core/application';
import {GPSTraceCategory }from '@nativescript-community/gps';

Trace.addCategories(GPSTraceCategory)
Trace.enable()
application.run({ moduleName: 'main-page' });
