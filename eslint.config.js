const js = require('@eslint/js');
const globals = require('globals');

// Lint scope: the SDK / toolkit sources, the repository scripts and the Node tests.
// Examples, workshops, starter templates, generated docs and vendored libraries are
// out of scope (they are either third-party code or student-facing snippets).
module.exports = [
  {
    ignores: [
      'node_modules/',
      'api_doc/',
      'docs/',
      'examples/',
      'starter-templates/',
      'tutorial/',
      'ws/',
      'apps/',
      // vendored third-party libraries shipped under js/
      'js/p5.js',
      'js/quaternion.js',
      'js/float16.min.js',
      'js/bootstrap.bundle.min.js',
      'js/run_prettify.js',
    ],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...globals.node,
        // vendored libraries loaded via <script> (js/quaternion.js, js/float16.min.js, bootstrap)
        Quaternion: 'readonly',
        float16: 'readonly',
        bootstrap: 'readonly',
        // js/BleSharedBridge.js (optional, loaded via <script>)
        BleSharedBridge: 'readonly',
        // js/ORPHE-CORE.js / js/CoreToolkit.js top-level globals shared across <script> tags
        Orphe: 'writable',
        bles: 'writable',
        cores: 'writable',
        orphe_js_version_date: 'writable',
        coreToolkit_version_date: 'writable',
        buildCoreToolkit: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-empty': 'warn',
      'no-prototype-builtins': 'off',
      'no-redeclare': 'off',
      // Japanese JSDoc comments legitimately contain full-width spaces (U+3000); keep the rule for code.
      'no-irregular-whitespace': ['error', { skipComments: true }],
    },
  },
];
