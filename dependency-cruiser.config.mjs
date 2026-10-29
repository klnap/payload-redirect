/** @type {import('dependency-cruiser').IConfiguration} */
const config = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'core-redirects-no-plugin',
      severity: 'error',
      from: { path: '^src/core/redirects/' },
      to: { path: '^src/plugin/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: {
      fileName: 'tsconfig.json',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
}

export default config
