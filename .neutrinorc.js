module.exports = {
  use: [
    '@neutrinojs/airbnb-base',
    [
      '@neutrinojs/library',
      {
        name: 'inputhub',
        target: 'web',
        polyfills: {
          async: true,
        },
        babel: {
          presets: [
            ['babel-preset-env', {
              // Passing in browser targets to babel-preset-env will replace them
              // instead of merging them when using the 'web' target
              targets: {
                browsers: [
                  '> 0.2%',
                  'last 1 version',
                  'Firefox ESR',
                  'not dead',
                ],
              },
            }],
          ],
        },
      },
    ],
    '@neutrinojs/jest',
  ],
};
