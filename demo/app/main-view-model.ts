import {Observable} from "data/observable";
import application = require("application");
let gps = require('nativescript-background-gps');
var ObservableArray = require("data/observable-array").ObservableArray;

export class HelloWorldModel extends Observable {
  public message: string;
  public gpsPoints: any[];
  private watchId: number;
  private uiApplication: any;

  constructor() {
    super();

    this.uiApplication = application.ios.nativeApp;

    this.message = "Tracking location";

    this.gpsPoints = new ObservableArray([
      {name: 'backgroundRefreshStatus: ' + this.uiApplication.backgroundRefreshStatus }
    ]);

    this.enableLocation()
        .then(() => {
          this.watchId = gps.watchLocation(this.locationReceived, this.error, {
            background: true,
            minimumUpdateTime: 10000
          });
        })
        .catch(this.error);
  }

  enableLocation() {
    if (!gps.isEnabled()) {
      console.log('Location not enabled, requesting.');
      return gps.enableLocationRequest(true);
    } else {
      return Promise.resolve(true);
    }
  }

  getLocation() {
    if (gps.isEnabled()) {
      return gps.getCurrentLocation({
        minimumUpdateTime: 10000
      })
    }
    return Promise.reject('Geolocation not enabled.');
  }

  locationReceived = (position:any) => {
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
    console.log(JSON.stringify(position.ios));

    let gpsTime:Date = new Date(position.timestamp);
    let logTime:Date = new Date();
    let difference:number = (logTime.getTime() - gpsTime.getTime()) / 1000;

    this.gpsPoints.unshift({name: '(' + this.uiApplication.backgroundRefreshStatus + ') ' + difference + ' = ' + this.formatDate(logTime) + ' - ' + this.formatDate(gpsTime)});
  };

  error(err) {
    console.log('Error: ' + JSON.stringify(err));
  }

  formatDate(date:Date) {
    return date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds();
  }
}