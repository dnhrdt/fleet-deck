import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/plugin.ts',
  output: {
    file: 'com.fleet.deck.sdPlugin/bin/plugin.js',
    format: 'es',
    sourcemap: true
  },
  plugins: [
    resolve({
      preferBuiltins: true
    }),
    commonjs(),
    typescript()
  ],
  external: [
    'node:child_process',
    'node:fs',
    'node:path',
    'node:url',
    'node:http',
    'node:https',
    'node:zlib',
    'node:stream',
    'node:buffer',
    'node:util',
    'node:net',
    'node:tls',
    'node:crypto',
    'node:events'
  ]
};
