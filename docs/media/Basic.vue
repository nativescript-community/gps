<template>
    <Page>
        <ActionBar>
            <Label text="Basic GPS demo" />
        </ActionBar>

        <StackLayout>
            <Label :text="message" class="message" textWrap="true" />

            <ListView :items="gpsPoints">
                <v-template>
                    <Label :text="item.name" />
                </v-template>
            </ListView>
        </StackLayout>
    </Page>
</template>

<script lang="ts">
import Vue from 'vue';
import { ObservableArray } from '@nativescript/core';
import { GPS } from '@nativescript-community/gps';
const gps = new GPS();
export default Vue.extend({
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
    destroyed() {
        if (this.watchId) {
            console.log('clearWatch');
            gps.clearWatch(this.watchId);
        }
    },
    data() {
        return {
            watchId: null,
            message: 'Tracking location',
            gpsPoints: []
        };
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

        locationReceived(position: any) {
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
            alert(err);
        },

        formatDate(date: Date) {
            return date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds();
        }
    }
});
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
</style>
