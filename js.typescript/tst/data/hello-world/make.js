module.exports =  {
  is: "project",
  name: "Hello World",
  description: "Hello to the world of TypeScript",
  "ts=": { is: 'environment' },
  "Files=": {
    is: 'group',
    elements: [
      { is: 'file', name: 'main.ts' }
    ]
  },
  "Hello World=": {
    is: 'target',
    type: "javascript",
    compiler: "typescript",
    files: ["=Files"],
    environments: ["=ts"]
  }
};
