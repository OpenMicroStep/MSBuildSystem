import {VersionedObject, VersionedObjectConstructor, FarImplementation, Invocation} from '@microstep/aspects';

export interface DataSourceConstructor<C extends DataSource> extends VersionedObjectConstructor<C> {
  category(name: 'local', implementation: DataSource.ImplCategories.local<DataSource>);
  category(name: 'client_', implementation: DataSource.ImplCategories.client_<DataSource>);
  category(name: 'server_', implementation: DataSource.ImplCategories.server_<DataSource>);
  category(name: 'safe', implementation: DataSource.ImplCategories.safe<DataSource>);
  category(name: 'raw', implementation: DataSource.ImplCategories.raw<DataSource>);
  category(name: 'implementation', implementation: DataSource.ImplCategories.implementation<DataSource>);
}
export interface DataSource extends VersionedObject {

}
const definition = {
  "is": "class",
  "name": "DataSource",
  "version": 0,
  "attributes": [],
  "categories": [
    {
      "is": "category",
      "name": "local",
      "methods": [
        {
          "is": "method",
          "name": "filter",
          "argumentTypes": [
            [
              "0",
              "*",
              "VersionedObject"
            ],
            "dictionary"
          ],
          "returnType": [
            "0",
            "*",
            "VersionedObject"
          ]
        }
      ]
    }
  ],
  "farCategories": [
    {
      "is": "farCategory",
      "name": "client_",
      "methods": [
        {
          "is": "method",
          "name": "query",
          "argumentTypes": [
            "dictionary"
          ],
          "returnType": {
            "*": [
              "0",
              "*",
              "VersionedObject"
            ]
          }
        },
        {
          "is": "method",
          "name": "load",
          "argumentTypes": [
            {
              "objects": [
                "0",
                "*",
                "VersionedObject"
              ],
              "scope": [
                "0",
                "*",
                "string"
              ]
            }
          ],
          "returnType": [
            "0",
            "*",
            "VersionedObject"
          ]
        },
        {
          "is": "method",
          "name": "save",
          "argumentTypes": [
            [
              "0",
              "*",
              "VersionedObject"
            ]
          ],
          "returnType": [
            "0",
            "*",
            "VersionedObject"
          ]
        }
      ]
    },
    {
      "is": "farCategory",
      "name": "server_",
      "methods": [
        {
          "is": "method",
          "name": "distantQuery",
          "argumentTypes": [
            "dictionary"
          ],
          "returnType": {
            "*": [
              "0",
              "*",
              "VersionedObject"
            ]
          }
        },
        {
          "is": "method",
          "name": "distantLoad",
          "argumentTypes": [
            {
              "objects": [
                "0",
                "*",
                "VersionedObject"
              ],
              "scope": [
                "0",
                "*",
                "string"
              ]
            }
          ],
          "returnType": [
            "0",
            "*",
            "VersionedObject"
          ]
        },
        {
          "is": "method",
          "name": "distantSave",
          "argumentTypes": [
            [
              "0",
              "*",
              "VersionedObject"
            ]
          ],
          "returnType": [
            "0",
            "*",
            "VersionedObject"
          ]
        }
      ]
    },
    {
      "is": "farCategory",
      "name": "safe",
      "methods": [
        {
          "is": "method",
          "name": "safeQuery",
          "argumentTypes": [
            "dictionary"
          ],
          "returnType": {
            "*": [
              "0",
              "*",
              "VersionedObject"
            ]
          }
        },
        {
          "is": "method",
          "name": "safeLoad",
          "argumentTypes": [
            {
              "objects": [
                "0",
                "*",
                "VersionedObject"
              ],
              "scope": [
                "0",
                "*",
                "string"
              ]
            }
          ],
          "returnType": [
            "0",
            "*",
            "VersionedObject"
          ]
        },
        {
          "is": "method",
          "name": "safeSave",
          "argumentTypes": [
            [
              "0",
              "*",
              "VersionedObject"
            ]
          ],
          "returnType": [
            "0",
            "*",
            "VersionedObject"
          ]
        }
      ]
    },
    {
      "is": "farCategory",
      "name": "raw",
      "methods": [
        {
          "is": "method",
          "name": "rawQuery",
          "argumentTypes": [
            "dictionary"
          ],
          "returnType": {
            "*": [
              "0",
              "*",
              "VersionedObject"
            ]
          }
        },
        {
          "is": "method",
          "name": "rawLoad",
          "argumentTypes": [
            {
              "objects": [
                "0",
                "*",
                "VersionedObject"
              ],
              "scope": [
                "0",
                "*",
                "string"
              ]
            }
          ],
          "returnType": [
            "0",
            "*",
            "VersionedObject"
          ]
        },
        {
          "is": "method",
          "name": "rawSave",
          "argumentTypes": [
            [
              "0",
              "*",
              "VersionedObject"
            ]
          ],
          "returnType": [
            "0",
            "*",
            "VersionedObject"
          ]
        }
      ]
    },
    {
      "is": "farCategory",
      "name": "implementation",
      "methods": [
        {
          "is": "method",
          "name": "implQuery",
          "argumentTypes": [
            [
              "0",
              "*",
              "ObjectSet"
            ]
          ],
          "returnType": {
            "*": [
              "0",
              "*",
              "VersionedObject"
            ]
          }
        },
        {
          "is": "method",
          "name": "implLoad",
          "argumentTypes": [
            {
              "objects": [
                "0",
                "*",
                "VersionedObject"
              ],
              "scope": [
                "0",
                "*",
                "string"
              ]
            }
          ],
          "returnType": [
            "0",
            "*",
            "VersionedObject"
          ]
        },
        {
          "is": "method",
          "name": "implSave",
          "argumentTypes": [
            [
              "0",
              "*",
              "VersionedObject"
            ]
          ],
          "returnType": [
            "0",
            "*",
            "VersionedObject"
          ]
        }
      ]
    }
  ],
  "aspects": [
    {
      "is": "aspect",
      "name": "client",
      "categories": [
        "local",
        "client_"
      ],
      "farCategories": [
        "server_"
      ]
    },
    {
      "is": "aspect",
      "name": "server",
      "categories": [
        "local",
        "server_",
        "safe",
        "raw"
      ],
      "farCategories": []
    },
    {
      "is": "aspect",
      "name": "impl",
      "categories": [
        "implementation"
      ],
      "farCategories": []
    }
  ]
};
export const DataSource: DataSourceConstructor<DataSource> = VersionedObject.extends(VersionedObject, definition);

export namespace DataSource {
  export namespace Categories {
    export interface local extends DataSource {
      filter(arg0: VersionedObject[], arg1: { [k: string]: any }): VersionedObject[];
    }
    export interface client_ extends DataSource {
      farCallback(this: DataSource, method: 'query', argument: { [k: string]: any }, callback: (envelop: Invocation<DataSource, {[k: string]: VersionedObject[]}>) => void);
      farEvent(this: DataSource, method: 'query', argument: { [k: string]: any }, eventName: string, onObject?: Object);
      farPromise(this: DataSource, method: 'query', argument: { [k: string]: any }): Promise<Invocation<DataSource, {[k: string]: VersionedObject[]}>>;
      farCallback(this: DataSource, method: 'load', argument: {objects?: VersionedObject[], scope?: string[]}, callback: (envelop: Invocation<DataSource, VersionedObject[]>) => void);
      farEvent(this: DataSource, method: 'load', argument: {objects?: VersionedObject[], scope?: string[]}, eventName: string, onObject?: Object);
      farPromise(this: DataSource, method: 'load', argument: {objects?: VersionedObject[], scope?: string[]}): Promise<Invocation<DataSource, VersionedObject[]>>;
      farCallback(this: DataSource, method: 'save', argument: VersionedObject[], callback: (envelop: Invocation<DataSource, VersionedObject[]>) => void);
      farEvent(this: DataSource, method: 'save', argument: VersionedObject[], eventName: string, onObject?: Object);
      farPromise(this: DataSource, method: 'save', argument: VersionedObject[]): Promise<Invocation<DataSource, VersionedObject[]>>;
    }
    export interface server_ extends DataSource {
      farCallback(this: DataSource, method: 'distantQuery', argument: { [k: string]: any }, callback: (envelop: Invocation<DataSource, {[k: string]: VersionedObject[]}>) => void);
      farEvent(this: DataSource, method: 'distantQuery', argument: { [k: string]: any }, eventName: string, onObject?: Object);
      farPromise(this: DataSource, method: 'distantQuery', argument: { [k: string]: any }): Promise<Invocation<DataSource, {[k: string]: VersionedObject[]}>>;
      farCallback(this: DataSource, method: 'distantLoad', argument: {objects?: VersionedObject[], scope?: string[]}, callback: (envelop: Invocation<DataSource, VersionedObject[]>) => void);
      farEvent(this: DataSource, method: 'distantLoad', argument: {objects?: VersionedObject[], scope?: string[]}, eventName: string, onObject?: Object);
      farPromise(this: DataSource, method: 'distantLoad', argument: {objects?: VersionedObject[], scope?: string[]}): Promise<Invocation<DataSource, VersionedObject[]>>;
      farCallback(this: DataSource, method: 'distantSave', argument: VersionedObject[], callback: (envelop: Invocation<DataSource, VersionedObject[]>) => void);
      farEvent(this: DataSource, method: 'distantSave', argument: VersionedObject[], eventName: string, onObject?: Object);
      farPromise(this: DataSource, method: 'distantSave', argument: VersionedObject[]): Promise<Invocation<DataSource, VersionedObject[]>>;
    }
    export interface safe extends DataSource {
      farCallback(this: DataSource, method: 'safeQuery', argument: { [k: string]: any }, callback: (envelop: Invocation<DataSource, {[k: string]: VersionedObject[]}>) => void);
      farEvent(this: DataSource, method: 'safeQuery', argument: { [k: string]: any }, eventName: string, onObject?: Object);
      farPromise(this: DataSource, method: 'safeQuery', argument: { [k: string]: any }): Promise<Invocation<DataSource, {[k: string]: VersionedObject[]}>>;
      farCallback(this: DataSource, method: 'safeLoad', argument: {objects?: VersionedObject[], scope?: string[]}, callback: (envelop: Invocation<DataSource, VersionedObject[]>) => void);
      farEvent(this: DataSource, method: 'safeLoad', argument: {objects?: VersionedObject[], scope?: string[]}, eventName: string, onObject?: Object);
      farPromise(this: DataSource, method: 'safeLoad', argument: {objects?: VersionedObject[], scope?: string[]}): Promise<Invocation<DataSource, VersionedObject[]>>;
      farCallback(this: DataSource, method: 'safeSave', argument: VersionedObject[], callback: (envelop: Invocation<DataSource, VersionedObject[]>) => void);
      farEvent(this: DataSource, method: 'safeSave', argument: VersionedObject[], eventName: string, onObject?: Object);
      farPromise(this: DataSource, method: 'safeSave', argument: VersionedObject[]): Promise<Invocation<DataSource, VersionedObject[]>>;
    }
    export interface raw extends DataSource {
      farCallback(this: DataSource, method: 'rawQuery', argument: { [k: string]: any }, callback: (envelop: Invocation<DataSource, {[k: string]: VersionedObject[]}>) => void);
      farEvent(this: DataSource, method: 'rawQuery', argument: { [k: string]: any }, eventName: string, onObject?: Object);
      farPromise(this: DataSource, method: 'rawQuery', argument: { [k: string]: any }): Promise<Invocation<DataSource, {[k: string]: VersionedObject[]}>>;
      farCallback(this: DataSource, method: 'rawLoad', argument: {objects?: VersionedObject[], scope?: string[]}, callback: (envelop: Invocation<DataSource, VersionedObject[]>) => void);
      farEvent(this: DataSource, method: 'rawLoad', argument: {objects?: VersionedObject[], scope?: string[]}, eventName: string, onObject?: Object);
      farPromise(this: DataSource, method: 'rawLoad', argument: {objects?: VersionedObject[], scope?: string[]}): Promise<Invocation<DataSource, VersionedObject[]>>;
      farCallback(this: DataSource, method: 'rawSave', argument: VersionedObject[], callback: (envelop: Invocation<DataSource, VersionedObject[]>) => void);
      farEvent(this: DataSource, method: 'rawSave', argument: VersionedObject[], eventName: string, onObject?: Object);
      farPromise(this: DataSource, method: 'rawSave', argument: VersionedObject[]): Promise<Invocation<DataSource, VersionedObject[]>>;
    }
    export interface implementation extends DataSource {
      farCallback(this: DataSource, method: 'implQuery', argument: ObjectSet[], callback: (envelop: Invocation<DataSource, {[k: string]: VersionedObject[]}>) => void);
      farEvent(this: DataSource, method: 'implQuery', argument: ObjectSet[], eventName: string, onObject?: Object);
      farPromise(this: DataSource, method: 'implQuery', argument: ObjectSet[]): Promise<Invocation<DataSource, {[k: string]: VersionedObject[]}>>;
      farCallback(this: DataSource, method: 'implLoad', argument: {objects?: VersionedObject[], scope?: string[]}, callback: (envelop: Invocation<DataSource, VersionedObject[]>) => void);
      farEvent(this: DataSource, method: 'implLoad', argument: {objects?: VersionedObject[], scope?: string[]}, eventName: string, onObject?: Object);
      farPromise(this: DataSource, method: 'implLoad', argument: {objects?: VersionedObject[], scope?: string[]}): Promise<Invocation<DataSource, VersionedObject[]>>;
      farCallback(this: DataSource, method: 'implSave', argument: VersionedObject[], callback: (envelop: Invocation<DataSource, VersionedObject[]>) => void);
      farEvent(this: DataSource, method: 'implSave', argument: VersionedObject[], eventName: string, onObject?: Object);
      farPromise(this: DataSource, method: 'implSave', argument: VersionedObject[]): Promise<Invocation<DataSource, VersionedObject[]>>;
    }
  }
  export namespace ImplCategories {
    export interface local<C extends DataSource> extends DataSource {
      filter: (this: C, arg0: VersionedObject[], arg1: { [k: string]: any }) => VersionedObject[];
    }
    export interface client_<C extends DataSource> extends DataSource {
      query: FarImplementation<C, { [k: string]: any }, {[k: string]: VersionedObject[]}>;
      load: FarImplementation<C, {objects?: VersionedObject[], scope?: string[]}, VersionedObject[]>;
      save: FarImplementation<C, VersionedObject[], VersionedObject[]>;
    }
    export interface server_<C extends DataSource> extends DataSource {
      distantQuery: FarImplementation<C, { [k: string]: any }, {[k: string]: VersionedObject[]}>;
      distantLoad: FarImplementation<C, {objects?: VersionedObject[], scope?: string[]}, VersionedObject[]>;
      distantSave: FarImplementation<C, VersionedObject[], VersionedObject[]>;
    }
    export interface safe<C extends DataSource> extends DataSource {
      safeQuery: FarImplementation<C, { [k: string]: any }, {[k: string]: VersionedObject[]}>;
      safeLoad: FarImplementation<C, {objects?: VersionedObject[], scope?: string[]}, VersionedObject[]>;
      safeSave: FarImplementation<C, VersionedObject[], VersionedObject[]>;
    }
    export interface raw<C extends DataSource> extends DataSource {
      rawQuery: FarImplementation<C, { [k: string]: any }, {[k: string]: VersionedObject[]}>;
      rawLoad: FarImplementation<C, {objects?: VersionedObject[], scope?: string[]}, VersionedObject[]>;
      rawSave: FarImplementation<C, VersionedObject[], VersionedObject[]>;
    }
    export interface implementation<C extends DataSource> extends DataSource {
      implQuery: FarImplementation<C, ObjectSet[], {[k: string]: VersionedObject[]}>;
      implLoad: FarImplementation<C, {objects?: VersionedObject[], scope?: string[]}, VersionedObject[]>;
      implSave: FarImplementation<C, VersionedObject[], VersionedObject[]>;
    }
  }
  export namespace Aspects {
    export type client = Categories.local & Categories.client_ & Categories.server_;
    export type server = Categories.local & Categories.server_ & Categories.safe & Categories.raw;
    export type impl = Categories.implementation;
  }
}
