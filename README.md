# @paychex/platform-browser

Provides agnostic JavaScript functionality for use in all browser-based applications.

## Installation

```bash
npm install @paychex/platform-browser
```

## Importing

### esm

```js
import { crossOrigin, stores } from '@paychex/platform-browser';
```

### cjs

```js
const { crossOrigin, stores } = require('@paychex/platform-browser');
```

### amd

```js
define(['@paychex/platform-browser'], function(browser) { ... });
define(['@paychex/platform-browser'], function({ crossOrigin, stores }) { ... });
```

```js
require(['@paychex/platform-browser'], function(browser) { ... });
require(['@paychex/platform-browser'], function({ crossOrigin, stores }) { ... });
```

### iife (browser)

```js
const { crossOrigin, stores } = window['@paychex/platform-browser'];
```

## Commands

To install the necessary dependencies:

```bash
npm install
```

To generate documentation files:

```bash
npm run docs
```

## Modules

The @paychex/platform-browser library contains functionality separated into various modules:

name | description
:--- | :---
[crossOrigin]{@link crossOrigin} | Enables safe asynchronous communication across different origins.
[stores]{@link stores} | Provides browser-specific Stores to persist and retrieve data on the user's machine.
