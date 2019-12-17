import { Observable } from 'tns-core-modules/data/observable';
import { ObservableArray } from 'tns-core-modules/data/observable-array';
import * as application from 'tns-core-modules/application';
import { GPS } from 'nativescript-gps';
const gps = new GPS();
gps.debug = true;
export class HelloWorldModel extends Observable {
    public message: string;
    public gpsPoints: ObservableArray<any>;
    private watchId: number;
    private uiApplication: any;

    constructor() {
        super();

        // this.uiApplication = application.ios.nativeApp;

        this.message = 'Tracking location';

        this.gpsPoints = new ObservableArray([]);

        this.enableLocation()
            .then(() => {
                console.log('enableLocation done');
                gps.watchLocation(this.locationReceived, this.error, {
                    provider:'gps',
                    minimumUpdateTime: 1000
                }).then(watchId => (this.watchId = watchId));
            })
            .catch(this.error);
    }

    enableLocation() {
        if (!gps.isEnabled()) {
            console.log('Location not enabled, requesting.');
            return gps
                .authorize(true)
                .then(() => gps.enable())
                .then(() => gps.isEnabled());
        } else {
            return Promise.resolve(true);
        }
    }

    getLocation() {
        if (gps.isEnabled()) {
            return gps.getCurrentLocation({
                minimumUpdateTime: 1000
            });
        }
        return Promise.reject('Geolocation not enabled.');
    }

    locationReceived = (position: any) => {
        console.log('GPS Update Received');
        // {
        //   "latitude": 33.52077361638753,
        //   "longitude": -111.89930240833577,
        //   "altitude": 384.0000915527344,
        //   "horizontalAccuracy": 65,
        //   "verticalAccuracy": 10,
        //   "speed": -1,
        //   "direction": -1,
        //   "timestamp": "2016-10-04T00:22:59.316Z",
        //   "ios": {}
        // }

        console.log(JSON.stringify(position));
        console.log(JSON.stringify(position.latitude));
        console.log(JSON.stringify(position.longitude));

        const gpsTime: Date = new Date(position.timestamp);
        const logTime: Date = new Date();
        const difference: number = (logTime.getTime() - gpsTime.getTime()) / 1000;
        this.message = `last location:${difference},${position.latitude},${position.longitude}`;
        this.gpsPoints.unshift({ name: gpsTime });
    };

    error(err) {
        console.log('Error: ' + JSON.stringify(err));
    }

    formatDate(date: Date) {
        return date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds();
    }
}
