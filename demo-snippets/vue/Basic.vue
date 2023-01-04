<template>
    <Page>
        <ActionBar>
            <Label text="Basic GPS demo" />
        </ActionBar>

        <StackLayout>
    <Label :text="message" class="message" textWrap="true"/>

    <ListView :items="gpsPoints">
      <ListView.itemTemplate>
        <Label :text="item.name"  />
      </ListView.itemTemplate>
    </ListView>
  </StackLayout>
    </Page>
</template>

<script lang="typescript">
import { ObservableArray } from '@nativescript/core/data/observable-array';
import { GPS } from '@nativescript-community/gps';
const gps = new GPS();
export default {
    mounted() {
        this.gpsPoints = new ObservableArray([]);
        gps.on(GPS.gps_status_event, (e) => {
            console.log('gps_status_event', e['data']);
        });

        this.enableLocation()
            .then(() => {
                console.log('enableLocation done');
                gps.watchLocation(this.locationReceived.bind(this), this.error, {
                    provider: 'gps',
                    minimumUpdateTime: 1000
                }).then((watchId) => (this.watchId = watchId));
            })
            .catch(this.error);
    
    },
    computed: {
        message() {
            return 'Blank {N}-Vue app';
        },
        items() {
            return new Array(100).fill({ title: 'My profile' });
        }
    },
    data:function( ) {
        return {
            message:'Tracking location',
            gpsPoints:[]
        }
    },
    methods: {

    enableLocation() {
        if (!gps.isEnabled()) {
            console.log('Location not enabled, requesting.');
            return gps.authorize(true).then(() => gps.enable());
        } else {
            return Promise.resolve(true);
        }
    },

    getLocation() {
        if (gps.isEnabled()) {
            return gps.getCurrentLocation({
                minimumUpdateTime: 1000
            });
        }
        return Promise.reject('Geolocation not enabled.');
    },

    locationReceived (position: any) {
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
    },

    error(err) {
        console.log('Error: ' + JSON.stringify(err));
    },

    formatDate(date: Date) {
        return date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds();
    }
    }
};
</script>

<style scoped lang="scss">
ActionBar {
    background-color: #42b883;
    color: white;
}
Button {
    background-color: #42b883;
    color: white;
}
.avatar {
    background-color: #42b883;
    border-radius: 40;
    height: 80;
    vertical-align: middle;
    Label {
        vertical-align: middle;
        horizontal-align: center;
        font-size: 30;
        color: white;
    }
}
.drawer {
    Button {
        background-color: transparent;
        margin: 0;
        padding: 0;
        border-color: #ccc;
        z-index: 0;
        border-width: 0 0 0.5 0;
        color: #222222;
        text-align: left;
        padding-left: 25;
        height: 50;
        font-size: 14;
    }
    Button:highlighted {
        background-color: #eeeeee;
        color: #222222;
    }
}
</style>
