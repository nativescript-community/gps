{{ load:../../tools/readme/edit-warning.md }}
{{ template:title }}
{{ template:badges }}
{{ template:description }}

| <img src="https://raw.githubusercontent.com/nativescript-community/gps/master/images/demo-ios.gif" height="500" /> | <img src="https://raw.githubusercontent.com/nativescript-community/gps/master/images/demo-android.gif" height="500" /> |
| --- | ----------- |
| iOS Demo | Android Demo |

{{ template:toc }}

## Installation
Run the following command from the root of your project:

`ns plugin add {{ pkg.name }}`

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

### Examples:

- [Basic](demo-snippets/vue/Basic.vue)
  - A basic sliding drawer.
{{ load:../../tools/readme/demos-and-development.md }}
{{ load:../../tools/readme/questions.md }}