module.exports =  {
  is: "project",
  name: "Hello World",
  description: "Hello to the world of JavaScript",
  "js=": { is: 'environment' },
  "Files=": {
    is: 'group',
    elements: [
      { is: 'file', name: 'main.js' }
    ]
  },
  "Hello World=": {
    is: 'target',
    type: "javascript",
    files: ["=Files"],
    environments: ["=js"]
  }
};
