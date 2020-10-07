import React from 'react'

/**
 * Couple of things to note:
 * - width and height is set to 1em
 * - fill is `currentColor` - this will ensure that the icon looks uniform and
 *   that the hover/active state works. You can of course render anything you
 *   would like here, but for plugins that are to be used in more than one
 *   studio, we suggest these rules are followed
 **/
export default () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 46.063 46.063">
    <path
      fill="currentColor"
      d="M18.022 38.676v2.813h-1.21q-4.864 0-6.525-1.447-1.64-1.445-1.64-5.762v-4.666q0-2.95-1.055-4.083-1.055-1.13-3.828-1.13h-1.19v-2.794h1.19q2.793 0 3.828-1.114 1.055-1.132 1.055-4.043V11.76q0-4.316 1.64-5.742 1.66-1.446 6.524-1.446h1.212v2.793h-1.328q-2.754 0-3.594.86-.84.86-.84 3.613v4.844q0 3.066-.898 4.453-.88 1.387-3.028 1.875 2.168.527 3.047 1.914.88 1.387.88 4.434v4.843q0 2.754.84 3.614.84.86 3.594.86h1.328zM28.04 38.676h1.368q2.735 0 3.555-.84.84-.84.84-3.633V29.36q0-3.047.88-4.434.878-1.387 3.046-1.914-2.17-.488-3.048-1.875-.88-1.387-.88-4.453V11.84q0-2.773-.84-3.613-.82-.86-3.554-.86H28.04V4.574h1.232q4.863 0 6.484 1.446 1.64 1.426 1.64 5.742v4.687q0 2.91 1.055 4.042 1.056 1.114 3.83 1.114h1.21V24.4h-1.21q-2.774 0-3.83 1.13-1.053 1.134-1.053 4.084v4.667q0 4.318-1.64 5.763-1.622 1.446-6.485 1.446h-1.23v-2.814z"
    />
  </svg>
)
